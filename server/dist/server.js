"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const lobby_1 = require("./lobby");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: { origin: '*' }
});
const lobbyManager = new lobby_1.LobbyManager(io);
io.on('connection', socket => {
    socket.on('createLobby', (playerName, ack) => {
        const code = lobbyManager.createLobby(socket.id, playerName);
        socket.join(code);
        ack(code);
        // Send current lobby state directly to creator (in addition to broadcast already done at creation)
        const lobby = lobbyManager.getLobby(code);
        if (lobby)
            socket.emit('lobbyState', lobby.state);
    });
    socket.on('joinLobby', (data, ack) => {
        const code = data.code.toUpperCase();
        const res = lobbyManager.joinLobby(code, socket.id, data.playerName);
        if ('ok' in res) {
            socket.join(code);
            const lobby = lobbyManager.getLobby(code);
            if (lobby) {
                // Immediately send the full state to the new socket so they don't depend on broadcast timing
                socket.emit('lobbyState', lobby.state);
            }
        }
        ack(res);
    });
    socket.on('startRaceNow', (code) => {
        const lobby = lobbyManager.getLobby(code);
        if (!lobby)
            return;
        if (lobby.state.hostId !== socket.id)
            return;
        lobbyManager.startRaceNow(code);
    });
    socket.on('resetRace', (code) => {
        const lobby = lobbyManager.getLobby(code);
        if (!lobby)
            return;
        if (lobby.state.hostId !== socket.id)
            return;
        lobbyManager.resetRace(code);
    });
    socket.on('disconnect', () => {
        lobbyManager.removePlayer(socket.id);
    });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
});
