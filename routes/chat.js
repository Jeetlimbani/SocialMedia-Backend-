// conversationRoutes.js

import express from "express";
import { protect } from "../middleware/authMiddleware.js"; // Adjust path as needed
import {
  getConversations,
  createOrGetConversation,
  sendMessage,
  getMessages,
  markMessagesAsRead,
  searchUsers,
  getConversationDetails,
} from "../controllers/conversationController.js"; // Adjust path as needed

const router = express.Router();

// Get all conversations for current user
router.get("/conversations", protect, getConversations);

// Get or create conversation with another user
router.post("/conversations", protect, createOrGetConversation);

// Send a message to a conversation
router.post("/conversations/:conversationId/messages", protect, sendMessage);

// Get messages for a specific conversation
router.get("/conversations/:conversationId/messages", protect, getMessages);

// Mark messages as read
router.patch(
  "/conversations/:conversationId/messages/read",
  protect,
  markMessagesAsRead,
);

// Search users for starting new conversations (consider a more specific path if this is part of conversations, e.g., /conversations/users/search)
router.get("/users/search", protect, searchUsers);

// Get conversation details
router.get("/conversations/:conversationId", protect, getConversationDetails);

export default router;
