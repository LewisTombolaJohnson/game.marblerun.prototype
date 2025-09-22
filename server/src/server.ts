import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { LobbyManager } from './lobby';
import { ClientToServerEvents, ServerToClientEvents } from '../../shared/events';

const app = express();
const server = http.createServer(app);
const io: Server<ClientToServerEvents, ServerToClientEvents> = new Server(server, {
  cors: { origin: '*' }
});

const lobbyManager = new LobbyManager(io);

io.on('connection', socket => {
  socket.on('createLobby', (playerName, ack) => {
    const code = lobbyManager.createLobby(socket.id, playerName);
    socket.join(code);
    ack(code);
    // Send current lobby state directly to creator (in addition to broadcast already done at creation)
    const lobby = lobbyManager.getLobby(code);
    if (lobby) socket.emit('lobbyState', lobby.state);
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
    ack(res as any);
  });

  socket.on('startRaceNow', (code) => {
    const lobby = lobbyManager.getLobby(code);
    if (!lobby) return;
    if (lobby.state.hostId !== socket.id) return;
    lobbyManager.startRaceNow(code);
  });

  socket.on('resetRace', (code) => {
    const lobby = lobbyManager.getLobby(code);
    if (!lobby) return;
    if (lobby.state.hostId !== socket.id) return;
    lobbyManager.resetRace(code);
  });

  socket.on('disconnect', () => {
    lobbyManager.removePlayer(socket.id);
  });
});

// Static hosting of built client (expects client build output in ../client/dist)
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
// Fallback to index.html for SPA behavior
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
