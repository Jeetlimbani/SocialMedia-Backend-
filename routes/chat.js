import express from "express";
import { PrismaClient } from "@prisma/client";
import { protect } from "../middleware/authMiddleware.js"; // Ensure this file uses ES6 export

const router = express.Router();
const prisma = new PrismaClient();

// Get all conversations for current user
router.get("/conversations", protect, async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId: req.user.id,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                senderId: { not: req.user.id },
                isRead: false,
              },
            },
          },
        },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    // Format conversations for frontend
    const formattedConversations = conversations.map((conv) => {
      const otherParticipant = conv.participants.find(
        (p) => p.userId !== req.user.id,
      );
      return {
        id: conv.id,
        participant: otherParticipant?.user,
        lastMessage: conv.messages[0] || null,
        unreadCount: conv._count.messages,
        lastMessageAt: conv.lastMessageAt,
      };
    });

    res.json(formattedConversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
});

// Get or create conversation with another user
router.post("/conversations", protect, async (req, res) => {
  try {
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({ message: "Participant ID is required" });
    }

    if (participantId === req.user.id) {
      return res
        .status(400)
        .json({ message: "Cannot create conversation with yourself" });
    }

    // Check if conversation already exists
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        participants: {
          every: {
            userId: { in: [req.user.id, participantId] },
          },
        },
        AND: [
          {
            participants: {
              some: { userId: req.user.id },
            },
          },
          {
            participants: {
              some: { userId: participantId },
            },
          },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (existingConversation) {
      const otherParticipant = existingConversation.participants.find(
        (p) => p.userId !== req.user.id,
      );
      return res.json({
        id: existingConversation.id,
        participant: otherParticipant?.user,
      });
    }

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId: req.user.id }, { userId: participantId }],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    const otherParticipant = conversation.participants.find(
      (p) => p.userId !== req.user.id,
    );
    res.status(201).json({
      id: conversation.id,
      participant: otherParticipant?.user,
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ message: "Failed to create conversation" });
  }
});

// Send a message to a conversation (REST API endpoint)
router.post(
  "/conversations/:conversationId/messages",
  protect,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { content, type = "TEXT" } = req.body;

      if (!content || content.trim().length === 0) {
        return res
          .status(400)
          .json({ message: "Message content cannot be empty" });
      }

      // Verify user is participant in conversation
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          userId: req.user.id,
          conversationId,
        },
      });

      if (!participant) {
        return res
          .status(403)
          .json({
            message: "Not authorized to send message in this conversation",
          });
      }

      // Create the message
      const message = await prisma.message.create({
        data: {
          content: content.trim(),
          type,
          senderId: req.user.id,
          conversationId,
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      });

      // Update conversation's lastMessageAt
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });

      res.status(201).json(message);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  },
);

// Get messages for a specific conversation
router.get(
  "/conversations/:conversationId/messages",
  protect,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      // Verify user is participant in conversation
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          userId: req.user.id,
          conversationId,
        },
      });

      if (!participant) {
        return res
          .status(403)
          .json({ message: "Not authorized to view this conversation" });
      }

      const messages = await prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * parseInt(limit),
        take: parseInt(limit),
      });

      res.json(messages.reverse()); // Reverse to show oldest first
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  },
);

// Mark messages as read
router.patch(
  "/conversations/:conversationId/messages/read",
  protect,
  async (req, res) => {
    try {
      const { conversationId } = req.params;

      // Verify user is participant in conversation
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          userId: req.user.id,
          conversationId,
        },
      });

      if (!participant) {
        return res
          .status(403)
          .json({ message: "Not authorized to access this conversation" });
      }

      // First, let's check what messages exist and their current state
      const unreadMessages = await prisma.message.findMany({
        where: {
          conversationId,
          senderId: { not: req.user.id },
          isRead: false,
        },
        select: {
          id: true,
          content: true,
          isRead: true,
          senderId: true,
        },
      });

      console.log("Found unread messages:", unreadMessages.length);
      console.log("Messages to update:", unreadMessages);

      if (unreadMessages.length === 0) {
        return res.json({
          message: "No unread messages to update",
          updatedCount: 0,
          foundMessages: 0,
        });
      }

      // Try explicit boolean true instead of just true
      const updatedMessages = await prisma.message.updateMany({
        where: {
          conversationId,
          senderId: { not: req.user.id },
          isRead: false,
        },
        data: {
          isRead: true,
          // Add timestamp if this field exists
        },
      });

      console.log("Update result:", updatedMessages);

      // Verify the update worked by checking again
      const stillUnreadCount = await prisma.message.count({
        where: {
          conversationId,
          senderId: { not: req.user.id },
          isRead: false,
        },
      });

      res.json({
        message: "Messages marked as read",
        updatedCount: updatedMessages.count,
        foundMessages: unreadMessages.length,
        stillUnreadCount: stillUnreadCount,
        success: updatedMessages.count > 0,
      });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      console.error("Error details:", error.message);
      res.status(500).json({
        message: "Failed to mark messages as read",
        error: error.message,
      });
    }
  },
);

// Search users for starting new conversations
router.get("/users/search", protect, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: req.user.id } }, // Exclude current user
          { isActive: true }, // Only active users
          {
            OR: [
              { username: { contains: q, mode: "insensitive" } },
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
      },
      take: 10,
    });

    res.json(users);
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).json({ message: "Failed to search users" });
  }
});

// Get conversation details
router.get("/conversations/:conversationId", protect, async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: { userId: req.user.id },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const otherParticipant = conversation.participants.find(
      (p) => p.userId !== req.user.id,
    );
    res.json({
      id: conversation.id,
      participant: otherParticipant?.user,
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ message: "Failed to fetch conversation" });
  }
});

export default router;
