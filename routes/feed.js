import express from "express";
import { getPublicFeed } from "../controllers/feedController.js";

const router = express.Router();

router.get("/public-feed", getPublicFeed);

export default router;
