import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import {
  getMyProfile,
  getUserByIdOrUsername,
  updateUserProfile,
  uploadAvatar,
} from "../controllers/avatarController.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Multer config for avatar upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "..", "uploads", "avatars");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Routes
router.get("/me/profile", protect, getMyProfile);
router.get("/:identifier", protect, getUserByIdOrUsername);
router.put("/update", protect, updateUserProfile);
router.post("/avatar", protect, upload.single("avatar"), uploadAvatar);

export default router;
