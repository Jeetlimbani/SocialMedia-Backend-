// src/controllers/authController.js
import bcrypt from "bcryptjs";
import { validationResult } from "express-validator"; // Keep validationResult here for handler-specific validation access

import { prisma } from "../config/db.js"; // Adjust path as needed
import { sendEmail } from "../utils/emailService.js"; // Adjust path as needed
import {
  generateAccessToken,
  generateRefreshToken,
  generateRandomToken,
} from "../utils/generateToken.js"; // Adjust path as needed

// Helper to calculate token expiry (1 hour from now for activation/reset, dynamic for refresh)
const getExpiryDate = (hours) => {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
};

// Helper to calculate token expiry from days
const getExpiryDateInDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

// @desc    Register user & send activation email
// @access  Public
export const registerUser = async (req, res) => {
  console.log("----- Inside registerUser controller -----");
  console.log("Request body inside controller:", req.body);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log("Validation Errors:", errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password } = req.body;

  try {
    console.log("Attempting to find existing user...");
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: email }, { username: username }],
      },
    });

    if (existingUser) {
      console.log("User already exists:", existingUser.email);
      if (existingUser.email === email) {
        return res.status(400).json({ message: "Email already registered." });
      }
      if (existingUser.username === username) {
        return res.status(400).json({ message: "Username already taken." });
      }
    }

    console.log("Hashing password...");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    console.log("Generating activation token...");
    const activationToken = generateRandomToken();
    const activationTokenExpires = getExpiryDate(1); // 1 hour

    console.log("Creating new user in database...");
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        isActive: false,
        activationToken,
        activationTokenExpires,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log("User created:", user.id);

    if (!process.env.FRONTEND_URL) {
      console.error(
        "FRONTEND_URL is not defined in .env! Activation link will be incomplete.",
      );
    }
    const activationLink = `${process.env.FRONTEND_URL}/activate?token=${activationToken}`;

    const emailContent = `
            <p>Hello ${user.username},</p>
            <p>Thank you for registering. Please click the link below to activate your account:</p>
            <p><a href="${activationLink}">Activate My Account</a></p>
            <p>If the link above doesn't work, copy and paste this URL into your browser:</p>
            <p>${activationLink}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not register, please ignore this email.</p>
        `;

    console.log("Sending activation email...");
    await sendEmail(user.email, "Account Activation", emailContent);

    res
      .status(201)
      .json({
        message:
          "Registration successful! Please check your email to activate your account.",
      });
  } catch (err) {
    console.error("Server Error in registerUser:", err.message);
    res.status(500).send("Server Error");
  }
};

// @desc    Activate user account
// @access  Public
export const activateAccount = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: "Activation token is missing." });
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        activationToken: token,
        isActive: false,
        activationTokenExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return res
        .status(400)
        .json({
          message:
            "Invalid or expired activation link or account already active.",
        });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isActive: true,
        activationToken: null,
        activationTokenExpires: null,
        updatedAt: new Date(),
      },
    });

    res
      .status(200)
      .json({ message: "Account activated successfully! You can now log in." });
  } catch (err) {
    console.error("Error activating account:", err.message);
    res.status(500).send("Server Error");
  }
};

// @desc    Authenticate user & get token
// @access  Public
export const loginUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { identifier, password } = req.body;

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    if (!user.isActive) {
      return res
        .status(403)
        .json({
          message:
            "Account not active. Please check your email for activation link.",
        });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const accessToken = generateAccessToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);
    const refreshTokenExpires = getExpiryDateInDays(
      parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN.replace("d", "")),
    );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: newRefreshToken,
        refreshTokenExpires: refreshTokenExpires,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      },
    });

    res.json({
      message: "Login successful!",
      token: accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isActive: user.isActive,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        bio: user.bio,
      },
    });
  } catch (err) {
    console.error("Error logging in user:", err.message);
    res.status(500).send("Server Error");
  }
};

// @desc    Send password reset link to user's email
// @access  Public
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res
        .status(200)
        .json({
          message:
            "If an account with that email exists, a password reset link has been sent.",
        });
    }

    const resetPasswordToken = generateRandomToken();
    const resetPasswordExpires = getExpiryDate(1); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken,
        resetPasswordExpires,
        updatedAt: new Date(),
      },
    });

    if (!process.env.FRONTEND_URL) {
      console.error(
        "FRONTEND_URL is not defined in .env! Reset link will be incomplete.",
      );
    }
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetPasswordToken}`;

    const emailContent = `
            <p>Hello ${user.username},</p>
            <p>You have requested to reset your password. Please click the link below to set a new password:</p>
            <p><a href="${resetLink}">Reset My Password</a></p>
            <p>If the link above doesn't work, copy and paste this URL into your browser:</p>
            <p>${resetLink}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request a password reset, please ignore this email.</p>
        `;

    await sendEmail(user.email, "Password Reset Request", emailContent);

    res
      .status(200)
      .json({
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
  } catch (err) {
    console.error("Error in forgotPassword:", err.message);
    res.status(500).send("Server Error");
  }
};

// @desc    Reset user password using token
// @access  Public
export const resetPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { token, newPassword } = req.body;

  try {
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired password reset link." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        updatedAt: new Date(),
      },
    });

    res
      .status(200)
      .json({
        message:
          "Password has been reset successfully. You can now log in with your new password.",
      });
  } catch (err) {
    console.error("Error in resetPassword:", err.message);
    res.status(500).send("Server Error");
  }
};

// @desc    Log out user (invalidate refresh token)
// @access  Protected
export const logoutUser = async (req, res) => {
  try {
    if (req.user && req.user.id) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          refreshToken: null,
          refreshTokenExpires: null,
          updatedAt: new Date(),
        },
      });
      res.status(200).json({ message: "Logged out successfully." });
    } else {
      res.status(400).json({ message: "User not identified for logout." });
    }
  } catch (err) {
    console.error("Error logging out user:", err.message);
    res.status(500).send("Server Error");
  }
};

// @desc    Get current logged in user (example of protected route)
// @access  Private
export const getMe = async (req, res) => {
  try {
    res.json(req.user);
  } catch (err) {
    console.error("Error getting user data:", err.message);
    res.status(500).send("Server Error");
  }
};
