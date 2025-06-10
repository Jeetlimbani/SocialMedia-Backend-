import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  savePost,
  unsavePost,
  getSavedPosts,
} from "../controllers/savedPostController.js";

const router = express.Router();

router.post("/:postId/save", protect, savePost);
router.delete("/:postId/unsave", protect, unsavePost);
router.get("/saved", protect, getSavedPosts);

export default router;
