import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  addComment,
  getComments,
  updateComment,
  deleteComment,
} from "../controllers/commentController.js";

const router = express.Router();

router.post("/:postId/comments", protect, addComment);
router.get("/:postId/comments", getComments); // Optional auth
router.put("/:postId/comments/:commentId", protect, updateComment);
router.delete("/:postId/comments/:commentId", protect, deleteComment);

export default router;
