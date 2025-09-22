import { Server } from 'socket.io';
import type { RaceInstance } from './race';
import { LobbyCode, LobbyState, PlayerInfo, ClientToServerEvents, ServerToClientEvents, generateLobbyCode, MIN_PLAYERS_TO_START } from '../../shared/events';

interface InternalLobby {
  state: LobbyState;
  playerMap: Map<string, PlayerInfo>; // socket.id -> player
  createdAt: number;
  race?: RaceInstance;
}

export class LobbyManager {
  private lobbies = new Map<LobbyCode, InternalLobby>();
  constructor(private io: Server<ClientToServerEvents, ServerToClientEvents>) {}

  createLobby(hostSocketId: string, playerName: string): LobbyCode {
    const code = this.generateUniqueCode();
    const player: PlayerInfo = { id: hostSocketId, name: sanitizeName(playerName), color: randomColor() };
    const lobby: InternalLobby = {
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

  joinLobby(code: LobbyCode, socketId: string, playerName: string): { ok: true } | { error: string } {
    const lobby = this.lobbies.get(code);
    if (!lobby) return { error: 'Lobby not found' };
  if (lobby.state.status !== 'waiting') return { error: 'Game already started' };
    if (lobby.playerMap.has(socketId)) return { error: 'Already joined' };
    const player: PlayerInfo = { id: socketId, name: sanitizeName(playerName), color: randomColor() };
    lobby.playerMap.set(socketId, player);
    lobby.state.players.push(player);
    this.broadcastLobbyState(lobby);
    return { ok: true };
  }

  startRaceNow(code: LobbyCode) {
    const lobby = this.lobbies.get(code);
    if (!lobby) return;
    if (lobby.state.status !== 'waiting') return;
    this.beginRace(lobby);
  }

  private beginRace(lobby: InternalLobby) {
    lobby.state.status = 'racing';
    this.broadcastLobbyState(lobby);
    const { createRace } = require('./race');
    lobby.race = createRace(this.io, lobby);
    lobby.race.start();
  }

  resetRace(code: LobbyCode) {
    const lobby = this.lobbies.get(code);
    if (!lobby) return;
    // Reset lobby state to waiting, preserve players & host.
    lobby.state.status = 'waiting';
    // Clear race reference
    lobby.race = undefined;
    this.broadcastLobbyState(lobby);
  }

  removePlayer(socketId: string) {
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

  private broadcastLobbyState(lobby: InternalLobby) {
    this.io.to(lobby.state.code).emit('lobbyState', lobby.state);
  }

  getLobby(code: LobbyCode) { return this.lobbies.get(code); }

  private generateUniqueCode(): LobbyCode {
    let code: LobbyCode;
    do { code = generateLobbyCode(); } while (this.lobbies.has(code));
    return code;
  }
}

function sanitizeName(name: string): string {
  const trimmed = name.trim().substring(0, 16);
  return trimmed || 'Player';
}

function randomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue} 70% 50%)`;
}

export type { InternalLobby };
