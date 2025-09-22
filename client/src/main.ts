import { Network } from './network';
import { setupScene, updateSceneWithSnapshot, setPlayerColor, focusOnPlayer, updateNameTags, tickCameraFollow, setNameLookup, showLobbyPreview, clearPreview, setTrackData } from './scene2d';

const net = new Network();

// UI elements
const screenSelect = document.getElementById('screen-lobby-select')!;
const screenLobby = document.getElementById('screen-lobby')!;
const screenRace = document.getElementById('screen-race')!;
const lobbyPlayersDiv = document.getElementById('lobbyPlayers')!;
const lobbyCodeSpan = document.getElementById('lobbyCode')!;
const lobbyStatusDiv = document.getElementById('lobbyStatus')!;
const raceTimerDiv = document.getElementById('raceTimer')!;
const resultsDiv = document.getElementById('results')!;

const playerNameInput = document.getElementById('playerName') as HTMLInputElement;
const joinCodeInput = document.getElementById('joinCode') as HTMLInputElement;
const createLobbyBtn = document.getElementById('createLobbyBtn') as HTMLButtonElement;
const joinLobbyBtn = document.getElementById('joinLobbyBtn') as HTMLButtonElement;
const startNowBtn = document.getElementById('startNowBtn') as HTMLButtonElement;
const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
const resetBtnRace = document.getElementById('resetBtnRace') as HTMLButtonElement;

let myPlayerId: string | null = null;
let raceStartTime: number | null = null;

createLobbyBtn.onclick = async () => {
  try {
    const code = await net.createLobby(getPlayerName());
  myPlayerId = net.socket.id || null;
    enterLobby(code);
  } catch (e) { alert(e); }
};

joinLobbyBtn.onclick = async () => {
  const code = joinCodeInput.value.trim().toUpperCase();
  if (!code) return;
  try {
    await net.joinLobby(code, getPlayerName());
  myPlayerId = net.socket.id || null;
    enterLobby(code);
  } catch (e) { alert(e); }
};

startNowBtn.onclick = () => {
  if (net.lobbyState) net.startRaceNow(net.lobbyState.code);
};

resetBtn.onclick = () => {
  if (net.lobbyState) net.resetRace(net.lobbyState.code);
};
resetBtnRace.onclick = () => {
  if (net.lobbyState) net.resetRace(net.lobbyState.code);
};

function getPlayerName() {
  return playerNameInput.value.trim() || 'Player';
}

function enterLobby(code: string) {
  screenSelect.classList.add('hidden');
  screenLobby.classList.remove('hidden');
  lobbyCodeSpan.textContent = code;
}

net.onLobbyState = (state) => {
  setNameLookup(id => state.players.find(p=>p.id===id)?.name || id.substring(0,4));
  // Determine host privilege
  const isHost = state.hostId === myPlayerId;
  const showStart = isHost && state.status === 'waiting';
  startNowBtn.style.display = showStart ? 'inline-block' : 'none';
  resetBtn.style.display = isHost ? 'inline-block' : 'none';
  resetBtnRace.style.display = isHost ? 'inline-block' : 'none';
  lobbyStatusDiv.textContent = `Status: ${state.status}`;
  lobbyPlayersDiv.innerHTML = '';
  state.players.forEach(p => {
    if (p.id === myPlayerId) setPlayerColor(p.id, p.color);
    const span = document.createElement('span');
    span.textContent = `${p.name}`;
    lobbyPlayersDiv.appendChild(span);
  });
  // Update lobby preview (only while waiting / countdown)
  if (state.status === 'waiting') {
    // Return to lobby UI if coming from race/finish
    screenRace.classList.add('hidden');
    screenLobby.classList.remove('hidden');
    // Clear previous race results/timer
    resultsDiv.innerHTML = '';
    raceTimerDiv.textContent = '';
    showLobbyPreview(state.players.map(p=>p.id));
    updateNameTags();
  }
  if (state.status === 'racing') {
    clearPreview();
    screenLobby.classList.add('hidden');
    screenRace.classList.remove('hidden');
  }
  // countdown removed
};

// countdown removed

net.onRaceStarted = (startTime) => {
  raceStartTime = startTime;
  // Fresh race: clear results & timer in case of back-to-back starts
  resultsDiv.innerHTML = '';
  raceTimerDiv.textContent = '';
};

net.onTrackData = (data) => {
  setTrackData(data);
};

net.onRaceSnapshot = (snap) => {
  updateSceneWithSnapshot(snap, myPlayerId);
  updateNameTags();
  if (raceStartTime) {
    raceTimerDiv.textContent = `${((Date.now() - raceStartTime)/1000).toFixed(1)}s`;
  }
};

net.onPlayerFinished = (res) => {
  const p = document.createElement('div');
  p.textContent = `#${res.rank} ${res.name} ${(res.timeMs/1000).toFixed(2)}s`;
  resultsDiv.appendChild(p);
};

net.onRaceFinished = (all) => {
  const header = document.createElement('h4');
  header.textContent = 'Final Results';
  resultsDiv.appendChild(header);
  all.sort((a,b) => a.rank - b.rank).forEach(r => {
    const d = document.createElement('div');
    d.textContent = `#${r.rank} ${r.name} ${(r.timeMs/1000).toFixed(2)}s`;
    resultsDiv.appendChild(d);
  });
};

// Scene setup
setupScene();

function animate() {
  requestAnimationFrame(animate);
  tickCameraFollow();
}
animate();
