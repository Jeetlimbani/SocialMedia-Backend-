import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import {
  createPost,
  deletePost,
  updatePost,
} from "../controllers/postController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Multer configuration
const postStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "..", "uploads", "posts");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `post-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const postUpload = multer({
  storage: postStorage,
  fileFilter: (req, file, cb) => {
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new Error("Only image files allowed"));
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 4 },
});

// Routes
router.post("/create", protect, postUpload.array("images", 4), createPost);
router.delete("/delete/:postId", protect, deletePost);
router.put("/update/:postId", protect, updatePost);

export default router;
