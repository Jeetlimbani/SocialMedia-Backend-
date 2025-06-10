import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";

// Get User Profile by ID or Username
export const getUserProfile = async (req, res) => {
  try {
    const { identifier } = req.params;
    const currentUserId = req.headers.authorization
      ? jwt.decode(req.headers.authorization.split(" ")[1])?.id
      : null;

    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        identifier,
      );

    const user = await prisma.user.findUnique({
      where: isUUID ? { id: identifier } : { username: identifier },
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
        posts: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            content: true,
            images: true,
            createdAt: true,
            _count: {
              select: {
                likes: true,
                comments: true,
              },
            },
            likes: currentUserId
              ? {
                  where: { userId: currentUserId },
                  select: { id: true },
                }
              : false,
            saves: currentUserId
              ? {
                  where: { userId: currentUserId },
                  select: { id: true },
                }
              : false,
          },
        },
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    let isFollowing = false;
    if (currentUserId && currentUserId !== user.id) {
      const followRelation = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: user.id,
          },
        },
      });
      isFollowing = !!followRelation;
    }

    const formattedPosts = user.posts.map((post) => ({
      ...post,
      isLiked: post.likes?.length > 0,
      isSaved: post.saves?.length > 0,
      likes: undefined,
      saves: undefined,
    }));

    res.json({
      ...user,
      posts: formattedPosts,
      isFollowing,
      isOwnProfile: currentUserId === user.id,
      followersCount: user._count.followers,
      followingCount: user._count.following,
      postsCount: user._count.posts,
      _count: undefined,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update Profile Info
export const updateUserProfile = async (req, res) => {
  try {
    const { username, firstName, lastName, bio } = req.body;
    const userId = req.user.id;

    if (username && username.length > 30)
      return res
        .status(400)
        .json({ error: "Username must be 30 characters or less" });

    if (firstName && firstName.length > 50)
      return res
        .status(400)
        .json({ error: "First name must be 50 characters or less" });

    if (lastName && lastName.length > 50)
      return res
        .status(400)
        .json({ error: "Last name must be 50 characters or less" });

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

    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (bio !== undefined) updateData.bio = bio;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        email: true,
      },
    });

    res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Username already taken" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get Current Authenticated User Profile
export const getCurrentUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
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
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      ...user,
      followersCount: user._count.followers,
      followingCount: user._count.following,
      postsCount: user._count.posts,
      _count: undefined,
    });
  } catch (error) {
    console.error("Get current user profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
