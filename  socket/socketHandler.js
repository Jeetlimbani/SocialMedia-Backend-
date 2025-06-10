import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const socketHandler = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        return next(new Error("User not found or inactive"));
      }

      socket.userId = user.id;
      socket.user = user;
      next();
    } catch (error) {
      console.error("Socket authentication error:", error);
      next(new Error("Authentication error"));
    }
  });

  // Connection handler
  io.on("connection", (socket) => {
    console.log(`User ${socket.user.username} (${socket.userId}) connected`);

    socket.join(`user_${socket.userId}`);

    socket.on("join_conversation", async (conversationId) => {
      try {
        const participant = await prisma.conversationParticipant.findFirst({
          where: {
            userId: socket.userId,
            conversationId,
          },
        });

        if (participant) {
          socket.join(`conversation_${conversationId}`);
          console.log(
            `User ${socket.user.username} joined conversation ${conversationId}`,
          );
        } else {
          socket.emit("error", {
            message: "Not authorized to join this conversation",
          });
        }
      } catch (error) {
        console.error("Error joining conversation:", error);
        socket.emit("error", { message: "Failed to join conversation" });
      }
    });

    socket.on("leave_conversation", (conversationId) => {
      socket.leave(`conversation_${conversationId}`);
      console.log(
        `User ${socket.user.username} left conversation ${conversationId}`,
      );
    });

    socket.on("send_message", async (data) => {
      try {
        const { conversationId, content, type = "TEXT" } = data;

        if (!content || content.trim().length === 0) {
          socket.emit("error", { message: "Message content cannot be empty" });
          return;
        }

        const participant = await prisma.conversationParticipant.findFirst({
          where: {
            userId: socket.userId,
            conversationId,
          },
        });

        if (!participant) {
          socket.emit("error", {
            message: "Not authorized to send message in this conversation",
          });
          return;
        }

        const message = await prisma.message.create({
          data: {
            content: content.trim(),
            type,
            senderId: socket.userId,
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

        io.to(`conversation_${conversationId}`).emit("new_message", message);

        const participants = await prisma.conversationParticipant.findMany({
          where: {
            conversationId,
            userId: { not: socket.userId },
          },
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
        });

        participants.forEach((participant) => {
          io.to(`user_${participant.userId}`).emit("new_message_notification", {
            conversationId,
            message,
            fromUser: socket.user,
          });
        });
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    socket.on("typing_start", ({ conversationId }) => {
      socket.to(`conversation_${conversationId}`).emit("user_typing", {
        userId: socket.userId,
        username: socket.user.username,
        conversationId,
      });
    });

    socket.on("typing_stop", ({ conversationId }) => {
      socket.to(`conversation_${conversationId}`).emit("user_stop_typing", {
        userId: socket.userId,
        conversationId,
      });
    });

    socket.on("mark_messages_read", async ({ conversationId }) => {
      try {
        const updatedMessages = await prisma.message.updateMany({
          where: {
            conversationId,
            senderId: { not: socket.userId },
            isRead: false,
          },
          data: { isRead: true },
        });

        if (updatedMessages.count > 0) {
          socket.to(`conversation_${conversationId}`).emit("messages_read", {
            conversationId,
            readBy: socket.userId,
            readByUser: socket.user,
          });
        }
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    });

    socket.on("user_online", () => {
      socket.broadcast.emit("user_status_change", {
        userId: socket.userId,
        username: socket.user.username,
        status: "online",
      });
    });

    socket.on("disconnect", (reason) => {
      console.log(`User ${socket.user.username} disconnected: ${reason}`);
      socket.broadcast.emit("user_status_change", {
        userId: socket.userId,
        username: socket.user.username,
        status: "offline",
      });
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });
  });
};

export default socketHandler;
