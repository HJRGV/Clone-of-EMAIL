const socketIO = require("socket.io");

let io;

const initSocket = (server) => {
  io = socketIO(server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    socket.on("join", (userId) => {
      socket.join(userId);
    });
  });
};

const emitNewMessage = (receiverId, message) => {
  if (io) {
    io.to(receiverId.toString()).emit("newMessage", message);
  }
};

module.exports = { initSocket, emitNewMessage };
