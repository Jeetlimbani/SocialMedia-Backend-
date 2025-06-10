import express from "express";
import { body } from "express-validator"; // Keep body here for validation rules

import { protect } from "../middleware/authMiddleware.js"; // Adjust path as needed
import {
  registerUser,
  activateAccount,
  loginUser,
  forgotPassword,
  resetPassword,
  logoutUser,
  getMe,
} from "../controllers/authController.js"; // Import controller functions

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register user & send activation email
// @access  Public
router.post(
  "/register",
  [
    body("username")
      .isAlphanumeric()
      .withMessage("Username must be alphanumeric.")
      .isLength({ min: 3 })
      .withMessage("Username must be at least 3 characters long."),
    body("email")
      .isEmail()
      .withMessage("Please enter a valid email.")
      .normalizeEmail(),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long.")
      .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/)
      .withMessage(
        "Password must include uppercase, lowercase, number, and a symbol.",
      ),
    body("confirmPassword").custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Password confirmation does not match password.");
      }
      return true;
    }),
  ],
  registerUser, // Use the imported controller function
);

// @route   POST /api/auth/activate
// @desc    Activate user account
// @access  Public
router.post("/activate", activateAccount); // Use the imported controller function

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post(
  "/login",
  [
    body("identifier").notEmpty().withMessage("Username or email is required."),
    body("password").notEmpty().withMessage("Password is required."),
  ],
  loginUser, // Use the imported controller function
);

// @route   POST /api/auth/forgot-password
// @desc    Send password reset link to user's email
// @access  Public
router.post("/forgot-password", forgotPassword); // Use the imported controller function

router.post(
  "/reset-password",
  [
    body("token").notEmpty().withMessage("Reset token is missing."),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long.")
      .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/)
      .withMessage(
        "Password must include uppercase, lowercase, number, and a symbol.",
      ),
    body("confirmNewPassword").custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("Password confirmation does not match new password.");
      }
      return true;
    }),
  ],
  resetPassword, // Use the imported controller function
);
router.post("/logout", protect, logoutUser); // Use the imported controller function
router.get("/me", protect, getMe); // Use the imported controller function

export default router;
