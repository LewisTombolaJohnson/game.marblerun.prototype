import { Server } from 'socket.io';
import type { RaceInstance } from './race';
import { LobbyCode, LobbyState, PlayerInfo, ClientToServerEvents, ServerToClientEvents } from '../../shared/events';
interface InternalLobby {
    state: LobbyState;
    playerMap: Map<string, PlayerInfo>;
    createdAt: number;
    race?: RaceInstance;
}
export declare class LobbyManager {
    private io;
    private lobbies;
    constructor(io: Server<ClientToServerEvents, ServerToClientEvents>);
    createLobby(hostSocketId: string, playerName: string): LobbyCode;
    joinLobby(code: LobbyCode, socketId: string, playerName: string): {
        ok: true;
    } | {
        error: string;
    };
    startRaceNow(code: LobbyCode): void;
    private beginRace;
    resetRace(code: LobbyCode): void;
    removePlayer(socketId: string): void;
    private broadcastLobbyState;
    getLobby(code: LobbyCode): InternalLobby | undefined;
    private generateUniqueCode;
}
export type { InternalLobby };
