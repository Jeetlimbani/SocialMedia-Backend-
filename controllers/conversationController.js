// conversationController.js

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Get all conversations for current user
export const getConversations = async (req, res) => {
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
};

// Get or create conversation with another user
export const createOrGetConversation = async (req, res) => {
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
};

// Send a message to a conversation (REST API endpoint)
export const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, type = "TEXT" } = req.body;

    if (!content || content.trim().length === 0) {
      return res
        .status(400)
        .json({ message: "Message content cannot be empty" });
    }

    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        userId: req.user.id,
        conversationId,
      },
    });

    if (!participant) {
      return res.status(403).json({
        message: "Not authorized to send message in this conversation",
      });
    }

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

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    res.status(201).json(message);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
};

// Get messages for a specific conversation
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

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

    res.json(messages.reverse());
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
};

// Mark messages as read
export const markMessagesAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;

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

    const updatedMessages = await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: req.user.id },
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    console.log("Update result:", updatedMessages);

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
};

// Search users for starting new conversations
export const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: req.user.id } },
          { isActive: true },
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
};

// Get conversation details
export const getConversationDetails = async (req, res) => {
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
};
