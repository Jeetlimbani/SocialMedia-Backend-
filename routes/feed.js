import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getUserFeed, getPublicFeed } from "../controllers/feedController.js";

const router = express.Router();

router.get("/feed", protect, getUserFeed);
router.get("/public-feed", getPublicFeed);

export default router;
