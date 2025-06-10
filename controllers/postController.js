// controllers/postController.js
import { prisma } from "../config/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { formatTimeAgo } from "../utils/dateUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const createPost = async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Post content is required" });
    }

    if (content.length > 2000) {
      return res
        .status(400)
        .json({ error: "Post content too long (max 2000 characters)" });
    }

    const imageUrls =
      req.files?.map((file) => `/uploads/posts/${file.filename}`) || [];

    const post = await prisma.post.create({
      data: {
        content: content.trim(),
        images: imageUrls,
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
      message: "Post created successfully",
      post: {
        ...post,
        likesCount: 0,
        commentsCount: 0,
        isLiked: false,
        isSaved: false,
      },
    });
  } catch (error) {
    console.error("Create post error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.authorId !== userId)
      return res.status(403).json({ error: "Not authorized" });

    if (post.images?.length) {
      post.images.forEach((imageUrl) => {
        const imagePath = path.join(__dirname, "..", imageUrl);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      });
    }

    await prisma.post.delete({ where: { id: postId } });
    res.json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Delete post error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Post content is required" });
    }

    if (content.length > 2000) {
      return res
        .status(400)
        .json({ error: "Post content too long (max 2000 characters)" });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
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

    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.authorId !== userId)
      return res.status(403).json({ error: "Not authorized" });

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: { content: content.trim(), updatedAt: new Date() },
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
    });

    res.json({
      message: "Post updated successfully",
      post: {
        ...updatedPost,
        likesCount: updatedPost._count.likes,
        commentsCount: updatedPost._count.comments,
        isLiked: updatedPost.likes.length > 0,
        isSaved: updatedPost.saves.length > 0,
        timeAgo: formatTimeAgo(updatedPost.createdAt),
        _count: undefined,
        likes: undefined,
        saves: undefined,
      },
    });
  } catch (error) {
    console.error("Update post error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
