import express from "express";
import { searchUsers } from "../controllers/userSearchController.js";

const router = express.Router();

router.get("/search/users", searchUsers);

export default router;
