// controllers/userSearchController.js
import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";

export const searchUsers = async (req, res) => {
  try {
    const { q: query, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    if (!query || query.trim().length < 1) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const currentUserId = req.headers.authorization
      ? jwt.decode(req.headers.authorization.split(" ")[1])?.id
      : null;

    const searchTerm = query.trim();

    const searchConditions = {
      OR: [{ username: { startsWith: searchTerm, mode: "insensitive" } }],
      isActive: true,
    };

    const users = await prisma.user.findMany({
      where: searchConditions,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        _count: {
          select: {
            followers: true,
            posts: true,
          },
        },
      },
      orderBy: [{ username: "asc" }, { firstName: "asc" }],
      skip: parseInt(skip),
      take: parseInt(limit),
    });

    const usersWithStatus = await Promise.all(
      users.map(async (user) => {
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

        return {
          ...user,
          isFollowing,
          isCurrentUser: currentUserId === user.id,
          followersCount: user._count.followers,
          postsCount: user._count.posts,
          _count: undefined,
        };
      }),
    );

    const totalCount = await prisma.user.count({
      where: searchConditions,
    });

    res.json({
      users: usersWithStatus,
      query: searchTerm,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
