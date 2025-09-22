import { Server } from 'socket.io';
import { InternalLobby } from './lobby';
import { ClientToServerEvents, ServerToClientEvents } from '../../shared/events';
export interface RaceInstance {
    start: () => void;
}
export declare function createRace(io: Server<ClientToServerEvents, ServerToClientEvents>, lobby: InternalLobby): RaceInstance;
