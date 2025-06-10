import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { likePost, unlikePost } from "../controllers/likeController.js";

const router = express.Router();

router.post("/:postId/like", protect, likePost);
router.delete("/:postId/like", protect, unlikePost);

export default router;
