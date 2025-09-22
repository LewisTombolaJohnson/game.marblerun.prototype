"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobbyManager = void 0;
const events_1 = require("../../shared/events");
class LobbyManager {
    constructor(io) {
        this.io = io;
        this.lobbies = new Map();
    }
    createLobby(hostSocketId, playerName) {
        const code = this.generateUniqueCode();
        const player = { id: hostSocketId, name: sanitizeName(playerName), color: randomColor() };
        const lobby = {
            state: {
                code,
                players: [player],
                hostId: hostSocketId,
                status: 'waiting'
            },
            playerMap: new Map([[hostSocketId, player]]),
            createdAt: Date.now()
        };
        this.lobbies.set(code, lobby);
        // Immediately broadcast so creator gets initial lobbyState
        this.broadcastLobbyState(lobby);
        return code;
    }
    joinLobby(code, socketId, playerName) {
        const lobby = this.lobbies.get(code);
        if (!lobby)
            return { error: 'Lobby not found' };
        if (lobby.state.status !== 'waiting')
            return { error: 'Game already started' };
        if (lobby.playerMap.has(socketId))
            return { error: 'Already joined' };
        const player = { id: socketId, name: sanitizeName(playerName), color: randomColor() };
        lobby.playerMap.set(socketId, player);
        lobby.state.players.push(player);
        this.broadcastLobbyState(lobby);
        return { ok: true };
    }
    startRaceNow(code) {
        const lobby = this.lobbies.get(code);
        if (!lobby)
            return;
        if (lobby.state.status !== 'waiting')
            return;
        this.beginRace(lobby);
    }
    beginRace(lobby) {
        lobby.state.status = 'racing';
        this.broadcastLobbyState(lobby);
        const { createRace } = require('./race');
        lobby.race = createRace(this.io, lobby);
        lobby.race.start();
    }
    resetRace(code) {
        const lobby = this.lobbies.get(code);
        if (!lobby)
            return;
        // Reset lobby state to waiting, preserve players & host.
        lobby.state.status = 'waiting';
        // Clear race reference
        lobby.race = undefined;
        this.broadcastLobbyState(lobby);
    }
    removePlayer(socketId) {
        for (const lobby of this.lobbies.values()) {
            if (lobby.playerMap.has(socketId)) {
                lobby.playerMap.delete(socketId);
                lobby.state.players = lobby.state.players.filter(p => p.id !== socketId);
                if (socketId === lobby.state.hostId) {
                    // Transfer host if possible
                    if (lobby.state.players.length > 0) {
                        lobby.state.hostId = lobby.state.players[0].id;
                    }
                }
                this.broadcastLobbyState(lobby);
                break;
            }
        }
    }
    broadcastLobbyState(lobby) {
        this.io.to(lobby.state.code).emit('lobbyState', lobby.state);
    }
    getLobby(code) { return this.lobbies.get(code); }
    generateUniqueCode() {
        let code;
        do {
            code = (0, events_1.generateLobbyCode)();
        } while (this.lobbies.has(code));
        return code;
    }
}
exports.LobbyManager = LobbyManager;
function sanitizeName(name) {
    const trimmed = name.trim().substring(0, 16);
    return trimmed || 'Player';
}
function randomColor() {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue} 70% 50%)`;
}
