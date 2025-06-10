import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
} from "../controllers/followController.js";

const router = express.Router();

router.post("/follow/:userId", protect, followUser);
router.delete("/follow/:userId", protect, unfollowUser);
router.get("/:userId/followers", getFollowers);
router.get("/:userId/following", getFollowing);

export default router;
