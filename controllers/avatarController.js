// File: /controllers/userController.js
import { prisma } from "../config/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        bio: true,
        createdAt: true,
        _count: {
          select: {
            followers: true,
            following: true,
            posts: true,
          },
        },
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      ...user,
      followersCount: user._count.followers,
      followingCount: user._count.following,
      postsCount: user._count.posts,
    });
  } catch (error) {
    console.error("Get current profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getUserByIdOrUsername = async (req, res) => {
  try {
    const { identifier } = req.params;
    const currentUserId = req.user.id;
    const whereClause = identifier.includes("-")
      ? { id: identifier }
      : { username: identifier };

    const user = await prisma.user.findUnique({
      where: whereClause,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        createdAt: true,
        _count: {
          select: {
            followers: true,
            following: true,
            posts: true,
          },
        },
        followers: {
          where: { followerId: currentUserId },
          select: { id: true },
        },
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    const isFollowing = user.followers.length > 0;
    const isOwnProfile = user.id === currentUserId;

    res.json({
      ...user,
      followersCount: user._count.followers,
      followingCount: user._count.following,
      postsCount: user._count.posts,
      isFollowing,
      isOwnProfile,
      followers: undefined,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, bio, username } = req.body;

    if (username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username,
          NOT: { id: userId },
        },
      });
      if (existingUser)
        return res.status(400).json({ error: "Username already taken" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(bio !== undefined && { bio }),
        ...(username && { username }),
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        bio: true,
        createdAt: true,
        _count: {
          select: {
            followers: true,
            following: true,
            posts: true,
          },
        },
      },
    });

    res.json({
      ...updatedUser,
      followersCount: updatedUser._count.followers,
      followingCount: updatedUser._count.following,
      postsCount: updatedUser._count.posts,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const userId = req.user.id;
    const avatarPath = `/uploads/avatars/${req.file.filename}`;

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarPath },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        email: true,
        createdAt: true,
        _count: {
          select: {
            followers: true,
            following: true,
            posts: true,
          },
        },
      },
    });

    if (
      currentUser.avatar &&
      currentUser.avatar !== avatarPath &&
      !currentUser.avatar.includes("default")
    ) {
      const oldAvatarPath = path.join(__dirname, "..", currentUser.avatar);
      try {
        if (fs.existsSync(oldAvatarPath)) fs.unlinkSync(oldAvatarPath);
      } catch (err) {
        console.error("Error deleting old avatar:", err.message);
      }
    }

    res.json({
      message: "Avatar uploaded successfully",
      user: {
        ...updatedUser,
        followersCount: updatedUser._count.followers,
        followingCount: updatedUser._count.following,
        postsCount: updatedUser._count.posts,
      },
    });
  } catch (error) {
    console.error("Avatar upload error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
