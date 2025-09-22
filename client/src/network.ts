import { io, Socket } from 'socket.io-client';

// Vite environment type augmentation (lightweight)
interface ImportMetaEnv { VITE_SERVER_URL?: string; }
interface ImportMeta { env: ImportMetaEnv }
import type { ClientToServerEvents, ServerToClientEvents, LobbyState, RaceSnapshot, FinishResult, TrackData } from '../../shared/events';

export class Network {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  lobbyState?: LobbyState;
  onLobbyState?: (s: LobbyState) => void;
  onRaceSnapshot?: (snap: RaceSnapshot) => void;
  onPlayerFinished?: (res: FinishResult) => void;
  onRaceFinished?: (res: FinishResult[]) => void;
  onRaceStarted?: (startTime: number) => void;
  onTrackData?: (data: TrackData) => void;

  constructor() {
  const url = (import.meta as any).env?.VITE_SERVER_URL || (location.protocol + '//' + location.host);
    this.socket = io(url, {
      path: '/socket.io',
      transports: ['websocket']
    });
    this.socket.on('lobbyState', s => { this.lobbyState = s; this.onLobbyState?.(s); });
    this.socket.on('raceSnapshot', snap => this.onRaceSnapshot?.(snap));
    this.socket.on('playerFinished', r => this.onPlayerFinished?.(r));
    this.socket.on('raceFinished', r => this.onRaceFinished?.(r));
    this.socket.on('raceStarted', t => this.onRaceStarted?.(t));
    this.socket.on('trackData', d => this.onTrackData?.(d));
  }

  createLobby(playerName: string) {
    return new Promise<string>((resolve, reject) => {
      this.socket.emit('createLobby', playerName, resp => {
        if (typeof resp === 'string') resolve(resp); else reject(resp.error);
      });
    });
  }

  joinLobby(code: string, playerName: string) {
    return new Promise<void>((resolve, reject) => {
      this.socket.emit('joinLobby', { code, playerName }, resp => {
        if ('ok' in resp) resolve(); else reject(resp.error);
      });
    });
  }

  startRaceNow(code: string) {
    this.socket.emit('startRaceNow', code);
  }

  resetRace(code: string) {
    this.socket.emit('resetRace', code);
  }
}
