import express from "express";
import http from "http";
import { Server } from "socket.io";
import ACTIONS from "./Actions.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", // Change this to your frontend URL if needed
        methods: ["GET", "POST"],
    },
    pingInterval: 25000, // Send heartbeat every 25 seconds
    pingTimeout: 60000, // Disconnect if no response for 60 seconds
});

const userSocketMap = {};

function getAllConnectedClients(roomId) {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        (socketId) => ({
            socketId,
            username: userSocketMap[socketId],
        })
    );
}

io.on("connection", (socket) => {

    try {
        socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
            userSocketMap[socket.id] = username;
            socket.join(roomId);

            const clients = getAllConnectedClients(roomId);
            clients.forEach(({ socketId }) => {
                io.to(socketId).emit(ACTIONS.JOINED, {
                    clients,
                    username,
                    socketId: socket.id,
                });
            });
        });

        socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
            socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
        });

        socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
            io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
        });

        socket.on("disconnecting", () => {
            const rooms = [...socket.rooms];
            rooms.forEach((roomId) => {
                socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                    socketId: socket.id,
                    username: userSocketMap[socket.id],
                });
            });

            delete userSocketMap[socket.id];
            socket.leave();
        });


    } catch (error) {
        console.error("❌ Socket error:", error);
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

