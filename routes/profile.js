import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getUserProfile,
  updateUserProfile,
  getCurrentUserProfile,
} from "../controllers/userController.js";

const router = express.Router();

router.get("/:identifier", getUserProfile); // Get profile by ID or username
router.put("/update", protect, updateUserProfile); // Update profile info
router.get("/me/profile", protect, getCurrentUserProfile); // Current user profile

export default router;
