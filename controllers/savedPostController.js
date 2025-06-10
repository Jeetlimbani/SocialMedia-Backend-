// controllers/savedPostController.js
import { prisma } from "../config/db.js";
import { formatTimeAgo } from "../utils/dateUtils.js";

export const savePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const existingSave = await prisma.savedPost.findUnique({
      where: {
        userId_postId: { userId, postId },
      },
    });

    if (existingSave)
      return res.status(400).json({ error: "Post already saved" });

    await prisma.savedPost.create({ data: { userId, postId } });

    res.json({ message: "Post saved successfully", isSaved: true });
  } catch (error) {
    console.error("Save post error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const unsavePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const deletedSave = await prisma.savedPost.deleteMany({
      where: { userId, postId },
    });

    if (deletedSave.count === 0) {
      return res.status(400).json({ error: "Post not saved" });
    }

    res.json({ message: "Post removed from saved", isSaved: false });
  } catch (error) {
    console.error("Unsave post error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getSavedPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const savedPosts = await prisma.savedPost.findMany({
      where: { userId },
      include: {
        post: {
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
            _count: {
              select: {
                likes: true,
                comments: true,
              },
            },
            likes: {
              where: { userId },
              select: { id: true },
            },
            saves: {
              where: { userId },
              select: { id: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: parseInt(skip),
      take: parseInt(limit),
    });

    const formattedSavedPosts = savedPosts.map((savedPost) => ({
      id: savedPost.id,
      savedAt: savedPost.createdAt,
      post: {
        ...savedPost.post,
        likesCount: savedPost.post._count.likes,
        commentsCount: savedPost.post._count.comments,
        isLiked: savedPost.post.likes.length > 0,
        isSaved: savedPost.post.saves.length > 0,
        timeAgo: formatTimeAgo(savedPost.post.createdAt),
        _count: undefined,
        likes: undefined,
        saves: undefined,
      },
    }));

    const totalCount = await prisma.savedPost.count({ where: { userId } });

    res.json({
      savedPosts: formattedSavedPosts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Get saved posts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
