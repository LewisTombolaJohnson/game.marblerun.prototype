export type LobbyCode = string;
export interface PlayerInfo {
    id: string;
    name: string;
    color: string;
    ready?: boolean;
}
export interface LobbyState {
    code: LobbyCode;
    players: PlayerInfo[];
    hostId: string;
    status: 'waiting' | 'racing' | 'finished';
}
export interface Vector2Like {
    x: number;
    y: number;
}
export interface MarbleState {
    playerId: string;
    position: Vector2Like;
    velocity: Vector2Like;
}
export interface RaceSnapshot {
    marbles: MarbleState[];
    time: number;
    serverTime: number;
}
export interface TrackObstacleBox {
    id: string;
    type: 'box';
    position: Vector2Like;
    size: {
        x: number;
        y: number;
    };
    rotation?: number;
}
export type TrackObstacle = TrackObstacleBox;
export interface TrackData {
    seed: string;
    obstacles: TrackObstacle[];
    finishLineY: number;
}
export interface FinishResult {
    playerId: string;
    name: string;
    timeMs: number;
    rank: number;
}
export interface ClientToServerEvents {
    createLobby: (playerName: string, ack: (code: LobbyCode | {
        error: string;
    }) => void) => void;
    joinLobby: (data: {
        code: LobbyCode;
        playerName: string;
    }, ack: (resp: {
        ok: true;
    } | {
        error: string;
    }) => void) => void;
    startRaceNow: (code: LobbyCode) => void;
    resetRace: (code: LobbyCode) => void;
}
export interface ServerToClientEvents {
    lobbyState: (state: LobbyState) => void;
    raceStarted: (startTime: number) => void;
    raceSnapshot: (snapshot: RaceSnapshot) => void;
    trackData: (data: TrackData) => void;
    playerFinished: (result: FinishResult) => void;
    raceFinished: (results: FinishResult[]) => void;
    errorMessage: (msg: string) => void;
}
export declare const MIN_PLAYERS_TO_START = 1;
export declare function generateLobbyCode(): LobbyCode;
export {};
