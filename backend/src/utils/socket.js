const socketIo = require("socket.io");
const http = require("http");
const { Message, User, StudyGroup } = require("../db");

const initializeSocket = (app) => {
  const server = http.createServer(app);

  const io = socketIo(server, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("New client connected");

    socket.on("joinGroup", async ({ groupId, userId }) => {
      try {
        const group = await StudyGroup.findById(groupId);

        if (!group || !group.members.includes(userId)) {
          socket.emit("error", {
            message: "You are not authorized to join this group.",
          });
          return;
        }

        socket.join(groupId);
      } catch (error) {
        console.error("Error joining group:", error);
        socket.emit("error", {
          message: "An error occurred while joining the group.",
        });
      }
    });
    socket.on("sendMessage", async ({ groupId, userId, content }) => {
      try {
        const group = await StudyGroup.findById(groupId);

        if (!group || !group.members.includes(userId)) {
          socket.emit("error", {
            message: "You are not authorized to send messages in this group.",
          });
          return;
        }

        const message = new Message({
          group: groupId,
          sender: userId,
          content,
        });
        await message.save();

        const user = await User.findById(userId);
        io.to(groupId).emit("receiveMessage", {
          groupId,
          content,
          sender: {
            _id: user._id,
            username: user.username,
          },
          createdAt: message.createdAt,
        });
      } catch (error) {
        console.error("Error sending message:", error);
      }
    });

    socket.on("typing", async ({ groupId, userId }) => {
      const user = await User.findById(userId);
      const username = user.username;

      socket.to(groupId).emit("userTyping", username);
    });

    socket.on("stopTyping", async ({ groupId, userId }) => {
      const user = await User.findById(userId);
      const username = user.username;

      socket.to(groupId).emit("userStoppedTyping", username);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });

  return server;
};

module.exports = initializeSocket;
