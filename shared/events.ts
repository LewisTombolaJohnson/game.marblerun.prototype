// Shared event & state type definitions for Marble Racer
// These should be imported by both server and client to ensure consistency.

export type LobbyCode = string; // e.g. 6 uppercase letters

export interface PlayerInfo {
  id: string; // socket id
  name: string;
  color: string; // hex color for marble
  ready?: boolean; // reserved for future use
}

export interface LobbyState {
  code: LobbyCode;
  players: PlayerInfo[];
  hostId: string;
  status: 'waiting' | 'racing' | 'finished';
}

export interface Vector2Like { x: number; y: number; }

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

// Track / obstacle data (sent once at race start)
export interface TrackObstacleBox {
  id: string;
  type: 'box';
  position: Vector2Like; // center position (x,y)
  size: { x: number; y: number }; // width (x) and height (y) in world units
  rotation?: number; // radians rotation (counter-clockwise)
}
export type TrackObstacle = TrackObstacleBox;

export interface TrackData {
  seed: string;
  obstacles: TrackObstacle[];
  finishLineY: number; // world y threshold to finish
}

export interface FinishResult {
  playerId: string;
  name: string;
  timeMs: number;
  rank: number;
}

// Client -> Server events
export interface ClientToServerEvents {
  createLobby: (playerName: string, ack: (code: LobbyCode | { error: string }) => void) => void;
  joinLobby: (data: { code: LobbyCode; playerName: string }, ack: (resp: { ok: true } | { error: string }) => void) => void;
  startRaceNow: (code: LobbyCode) => void; // host starts race immediately
  resetRace: (code: LobbyCode) => void; // host resets lobby to waiting
}

// Server -> Client events
export interface ServerToClientEvents {
  lobbyState: (state: LobbyState) => void;
  raceStarted: (startTime: number) => void;
  raceSnapshot: (snapshot: RaceSnapshot) => void; // broadcast ~10-20 Hz
  trackData: (data: TrackData) => void; // sent once after race start
  playerFinished: (result: FinishResult) => void;
  raceFinished: (results: FinishResult[]) => void;
  errorMessage: (msg: string) => void;
}

export const MIN_PLAYERS_TO_START = 1; // adjust as needed

export function generateLobbyCode(): LobbyCode {
  const alphabet = 'ABCDEFGHJKLMNPQRTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

// Ensure treated strictly as a module in CJS contexts
export {};
