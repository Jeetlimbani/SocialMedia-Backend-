import { prisma } from "../config/db.js";
import jwt from "jsonwebtoken";

// Follow a user
export const followUser = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.user.id;

    if (currentUserId === targetUserId) {
      return res.status(400).json({ error: "Cannot follow yourself" });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: targetUserId,
        },
      },
    });

    if (existingFollow) {
      return res.status(400).json({ error: "Already following this user" });
    }

    await prisma.follow.create({
      data: {
        followerId: currentUserId,
        followingId: targetUserId,
      },
    });

    res.json({ message: "User followed successfully", isFollowing: true });
  } catch (error) {
    console.error("Follow user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Unfollow a user
export const unfollowUser = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.user.id;

    const deleted = await prisma.follow.deleteMany({
      where: {
        followerId: currentUserId,
        followingId: targetUserId,
      },
    });

    if (deleted.count === 0) {
      return res.status(400).json({ error: "Not following this user" });
    }

    res.json({ message: "User unfollowed successfully", isFollowing: false });
  } catch (error) {
    console.error("Unfollow user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Followers list
export const getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const currentUserId = req.headers.authorization
      ? jwt.decode(req.headers.authorization.split(" ")[1])?.id
      : null;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      select: {
        follower: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: parseInt(skip),
      take: parseInt(limit),
    });

    const followersWithStatus = await Promise.all(
      followers.map(async ({ follower }) => {
        const isFollowing =
          currentUserId &&
          currentUserId !== follower.id &&
          !!(await prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: currentUserId,
                followingId: follower.id,
              },
            },
          }));

        return {
          ...follower,
          isFollowing,
          isCurrentUser: currentUserId === follower.id,
        };
      }),
    );

    const totalCount = await prisma.follow.count({
      where: { followingId: userId },
    });

    res.json({
      followers: followersWithStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Get followers error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Following list
export const getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const currentUserId = req.headers.authorization
      ? jwt.decode(req.headers.authorization.split(" ")[1])?.id
      : null;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: {
        following: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: parseInt(skip),
      take: parseInt(limit),
    });

    const followingWithStatus = await Promise.all(
      following.map(async ({ following: user }) => {
        const isFollowing =
          currentUserId &&
          currentUserId !== user.id &&
          !!(await prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: currentUserId,
                followingId: user.id,
              },
            },
          }));

        return {
          ...user,
          isFollowing,
          isCurrentUser: currentUserId === user.id,
        };
      }),
    );

    const totalCount = await prisma.follow.count({
      where: { followerId: userId },
    });

    res.json({
      following: followingWithStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Get following error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
