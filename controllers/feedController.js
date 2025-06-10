import { prisma } from "../config/db.js";
import { formatTimeAgo } from "../utils/dateUtils.js";

export const getUserFeed = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const followedUsers = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const followedUserIds = [
      ...new Set([...followedUsers.map((f) => f.followingId), userId]),
    ];

    const posts = await prisma.post.findMany({
      where: { authorId: { in: followedUserIds } },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        _count: { select: { likes: true, comments: true } },
        likes: { where: { userId }, select: { id: true } },
        saves: { where: { userId }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    const formattedPosts = posts.map((post) => ({
      ...post,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      isLiked: post.likes.length > 0,
      isSaved: post.saves.length > 0,
      timeAgo: formatTimeAgo(post.createdAt),
      _count: undefined,
      likes: undefined,
      saves: undefined,
    }));

    const totalCount = await prisma.post.count({
      where: { authorId: { in: followedUserIds } },
    });

    res.json({
      posts: formattedPosts,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1,
      },
      hasMore: formattedPosts.length === limit,
    });
  } catch (error) {
    console.error("Get feed error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getPublicFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await prisma.post.findMany({
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    const formattedPosts = posts.map((post) => ({
      ...post,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      isLiked: false,
      isSaved: false,
      timeAgo: formatTimeAgo(post.createdAt),
      _count: undefined,
    }));

    const totalCount = await prisma.post.count();

    res.json({
      posts: formattedPosts,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1,
      },
      hasMore: formattedPosts.length === limit,
    });
  } catch (error) {
    console.error("Get public feed error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
