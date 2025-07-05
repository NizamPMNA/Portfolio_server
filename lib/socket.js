const { Server } = require("socket.io");
const http = require("http");
const express = require("express");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
      origin: '*',          // ← allow everything
      methods: ['GET', 'POST'],
    },
  });

// STORE ONLINE USERS
const userSocketMap = {};

// console.log(io,'socketttttttttttttt');


// Return socket ID of receiver
const getReceiverSocketId = (userId) => {
    return userSocketMap[userId];
};

io.on("connection", (socket) => {
    console.log("a user connected...........................", socket.id);

    const userId = socket.handshake.query.userId;
    if (userId) userSocketMap[userId] = socket.id;

    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    socket.on("disconnect", () => {
        console.log("a user disconnected", socket.id);
        delete userSocketMap[userId];
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
});

module.exports = {
    io,
    app,
    server,
    getReceiverSocketId,
};
