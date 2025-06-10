import { prisma } from "../config/db.js";
import { formatTimeAgo } from "../utils/dateUtils.js";

export const addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || content.trim().length === 0)
      return res.status(400).json({ error: "Comment content is required" });

    if (content.length > 500)
      return res
        .status(400)
        .json({ error: "Comment too long (max 500 characters)" });

    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) return res.status(404).json({ error: "Post not found" });

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        postId,
        authorId: userId,
      },
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
      },
    });

    res.status(201).json({
      message: "Comment added successfully",
      comment: {
        ...comment,
        timeAgo: "now",
        isOwn: true,
      },
    });
  } catch (error) {
    console.error("Create comment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 20, sort = "newest" } = req.query;
    const skip = (page - 1) * limit;
    const userId = req.user?.id;

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const orderBy =
      sort === "oldest" ? { createdAt: "asc" } : { createdAt: "desc" };

    const comments = await prisma.comment.findMany({
      where: { postId },
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
      },
      orderBy,
      skip: parseInt(skip),
      take: parseInt(limit),
    });

    const formattedComments = comments.map((comment) => ({
      ...comment,
      timeAgo: formatTimeAgo(comment.createdAt),
      isOwn: userId ? comment.authorId === userId : false,
    }));

    const totalCount = await prisma.comment.count({ where: { postId } });

    res.json({
      comments: formattedComments,
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
    console.error("Get comments error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || content.trim().length === 0)
      return res.status(400).json({ error: "Comment content is required" });

    if (content.length > 500)
      return res
        .status(400)
        .json({ error: "Comment too long (max 500 characters)" });

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
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
      },
    });

    if (!comment) return res.status(404).json({ error: "Comment not found" });
    if (comment.postId !== postId)
      return res
        .status(400)
        .json({ error: "Comment does not belong to this post" });
    if (comment.authorId !== userId)
      return res
        .status(403)
        .json({ error: "Not authorized to edit this comment" });

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content: content.trim(),
        updatedAt: new Date(),
      },
      include: { author: true },
    });

    res.json({
      message: "Comment updated successfully",
      comment: {
        ...updatedComment,
        timeAgo: formatTimeAgo(updatedComment.createdAt),
        isOwn: true,
      },
    });
  } catch (error) {
    console.error("Update comment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user.id;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) return res.status(404).json({ error: "Comment not found" });
    if (comment.postId !== postId)
      return res
        .status(400)
        .json({ error: "Comment does not belong to this post" });
    if (comment.authorId !== userId)
      return res
        .status(403)
        .json({ error: "Not authorized to delete this comment" });

    await prisma.comment.delete({ where: { id: commentId } });

    res.json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Delete comment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
