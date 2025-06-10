// controllers/likeController.js
import { prisma } from "../config/db.js";

// Like a post
export const likePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const existingLike = await prisma.like.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existingLike) {
      const likesCount = await prisma.like.count({ where: { postId } });
      return res.json({
        message: "Post already liked",
        isLiked: true,
        likesCount,
      });
    }

    await prisma.like.create({ data: { userId, postId } });
    const likesCount = await prisma.like.count({ where: { postId } });

    res.json({ message: "Post liked successfully", isLiked: true, likesCount });
  } catch (error) {
    console.error("Like post error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Unlike a post
export const unlikePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const deletedLike = await prisma.like.deleteMany({
      where: { userId, postId },
    });
    const likesCount = await prisma.like.count({ where: { postId } });

    if (deletedLike.count === 0) {
      return res.json({
        message: "Post was not liked",
        isLiked: false,
        likesCount,
      });
    }

    res.json({
      message: "Post unliked successfully",
      isLiked: false,
      likesCount,
    });
  } catch (error) {
    console.error("Unlike post error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
