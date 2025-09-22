import type { RaceSnapshot, TrackData, TrackObstacle } from '../../shared/events';

// Canvas 2D top-down renderer mapping physics (x,y) -> canvas (x,y_forward)
// Public API mirrors former 3D scene module.

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let width = window.innerWidth;
let height = window.innerHeight;

interface MarbleVisual {
  playerId: string;
  x: number;
  y: number;
  color: string;
}

const marbles = new Map<string, MarbleVisual>();
const previewMarbles = new Map<string, MarbleVisual>();
let isPreview = false;
let followPlayerId: string | null = null;
let nameLookup: (id: string) => string = (id) => id.slice(0,4);
let worldScale = 20; // reduced to show more horizontal space
let camera = { x: 0, y: 0 }; // center world coords

// --- Trail additions ---
interface TrailPoint { x: number; y: number; t: number; }
let localPlayerId: string | null = null;
const trail: TrailPoint[] = [];
const trailMaxPoints = 80; // shorter trail
const trailLifeMs = 1400; // fade faster
// -----------------------

// Track data & obstacles
let track: TrackData | null = null;

interface ObstacleVisual {
  id: string; type: 'box'; x: number; y: number; w: number; h: number; rotation?: number;
}
const obstacles: ObstacleVisual[] = [];
// Pegs removed (no longer used)
let finishLineY: number | null = null; // physics y of finish
let finishLineProjected: number | null = null;

// Snapshot interpolation buffer
interface SnapshotBuffered { time: number; serverTime: number; marbles: Map<string, { x:number; y:number; vx:number; vy:number }>; }
const snapshotBuffer: SnapshotBuffered[] = [];
// We will render with a delay to allow interpolation between past snapshots.
const interpolationDelayMs = 150; // can tune

export function setNameLookup(fn: (id: string) => string) { nameLookup = fn; }

export function setupScene() {
  canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  ctx = canvas.getContext('2d')!;
  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(loop);
}

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
}

function loop() {
  requestAnimationFrame(loop);
  render();
}

function render() {
  ctx.fillStyle = '#101018';
  ctx.fillRect(0,0,width,height);

  // Update interpolation if racing (not preview)
  if (!isPreview) applyInterpolation();

  // Decide which collection to draw (preview uses previewMarbles only)
  const collection = isPreview ? previewMarbles : marbles;

  // Auto camera follow
  if (followPlayerId && collection.has(followPlayerId)) {
    const m = collection.get(followPlayerId)!;
    camera.x += (m.x - camera.x) * 0.08;
    camera.y += (m.y - camera.y) * 0.08;
  }

  // Draw grid background (optional subtle)
  drawGrid();

  // Draw obstacles behind marbles when racing
  if (!isPreview) {
    drawObstacles();
    drawFinishLine();
  }

  collection.forEach(m => {
    const screen = worldToScreen(m.x, m.y);
    const radius = isPreview ? 14 : 11; // bigger in lobby
    // Marble circle
    ctx.beginPath();
    ctx.fillStyle = m.color || '#ff0000';
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI*2);
    ctx.fill();
    // Outline
    ctx.strokeStyle = '#000000aa';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Name
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(nameLookup(m.playerId), screen.x, screen.y - radius - 6);
  });

  // Trail rendering (after marbles)
  if (!isPreview && localPlayerId && marbles.has(localPlayerId)) {
    const now = Date.now();
    const m = marbles.get(localPlayerId)!;
    trail.push({ x: m.x, y: m.y, t: now });
    while (trail.length > trailMaxPoints) trail.shift();
    while (trail.length && now - trail[0].t > trailLifeMs) trail.shift();
    drawTrail(now);
  }
}

function drawTrail(now: number) {
  if (trail.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i=1;i<trail.length;i++) {
    const a = trail[i-1];
    const b = trail[i];
    const age = now - b.t;
    const alpha = 1 - age / trailLifeMs;
    if (alpha <= 0) continue;
    const sa = worldToScreen(a.x, a.y);
    const sb = worldToScreen(b.x, b.y);
    // Glow
    ctx.strokeStyle = `hsla(200 100% 70% / ${alpha * 0.25})`;
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y); ctx.stroke();
    // Core
    ctx.strokeStyle = `hsla(200 100% 65% / ${alpha})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y); ctx.stroke();
  }
  ctx.restore();
}

function drawGrid() {
  const spacing = 50;
  ctx.strokeStyle = '#ffffff08';
  ctx.lineWidth = 1;
  const camOffsetX = camera.x * worldScale;
  const camOffsetY = camera.y * worldScale;
  const startX = -((camOffsetX) % spacing);
  const startY = -((camOffsetY) % spacing);
  for (let x = startX; x < width; x += spacing) {
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,height); ctx.stroke();
  }
  for (let y = startY; y < height; y += spacing) {
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(width,y); ctx.stroke();
  }
}

function worldToScreen(x: number, y: number) {
  // Invert vertical axis so that decreasing physics y (marbles rolling "down") appears as moving downward on screen.
  return {
    x: (x - camera.x) * worldScale + width / 2,
    y: (camera.y - y) * worldScale + height / 2
  };
}

export function updateSceneWithSnapshot(snapshot: RaceSnapshot, myPlayerId: string | null) {
  if (isPreview) return; // ignore race snapshots while still in preview safety
  const mapped = new Map<string, { x:number; y:number; vx:number; vy:number }>();
  snapshot.marbles.forEach(m => {
    mapped.set(m.playerId, {
      x: m.position.x,
      y: m.position.y,
      vx: m.velocity.x,
      vy: m.velocity.y
    });
    if (myPlayerId && m.playerId === myPlayerId) {
      followPlayerId = m.playerId;
      localPlayerId = m.playerId; // enable trail
    }
  });
  snapshotBuffer.push({ time: snapshot.time, serverTime: snapshot.serverTime, marbles: mapped });
  while (snapshotBuffer.length > 120) snapshotBuffer.shift();
}

function applyInterpolation() {
  if (snapshotBuffer.length < 2) return;
  const now = Date.now();
  const renderTime = now - interpolationDelayMs;
  let older: SnapshotBuffered | null = null;
  let newer: SnapshotBuffered | null = null;
  for (let i = snapshotBuffer.length - 1; i >= 0; i--) {
    const snap = snapshotBuffer[i];
    if (snap.serverTime <= renderTime) { older = snap; newer = snapshotBuffer[i+1] || snap; break; }
  }
  if (!older) { older = snapshotBuffer[0]; newer = snapshotBuffer[1]; }
  if (!newer) newer = older;
  const span = (newer.serverTime - older.serverTime) || 1;
  const t = Math.min(1, Math.max(0, (renderTime - older.serverTime) / span));
  older.marbles.forEach((m, id) => {
    const n = newer!.marbles.get(id) || m;
    const ix = m.x + (n.x - m.x) * t;
    const iy = m.y + (n.y - m.y) * t;
    const existing = marbles.get(id) || { playerId: id, x: ix, y: iy, color: marbles.get(id)?.color || '#ff0000' };
    existing.x = ix; existing.y = iy;
    marbles.set(id, existing);
  });
}

export function setTrackData(data: TrackData) {
  track = data;
  obstacles.length = 0;
  finishLineY = data.finishLineY;
  finishLineProjected = finishLineYToProjected(finishLineY);
  data.obstacles.forEach((o: TrackObstacle) => {
    if (o.type === 'box') {
      obstacles.push({ id: o.id, type: 'box', x: o.position.x, y: o.position.y, w: o.size.x, h: o.size.y, rotation: (o as any).rotation });
    }
  });
}

function drawObstacles() {
  if (!track) return;
  ctx.save();
  obstacles.forEach(o => {
    const isWall = o.id === 'wallL' || o.id === 'wallR';
    const center = worldToScreen(o.x, o.y);
    const w = o.w * worldScale;
    const h = o.h * worldScale;
    ctx.save();
    ctx.translate(center.x, center.y);
    if (o.rotation) ctx.rotate(-o.rotation);
    ctx.fillStyle = isWall ? '#1d4ed8' : '#2c2f55';
    ctx.strokeStyle = isWall ? '#2563eb' : '#555';
    ctx.lineWidth = isWall ? 4 : 2;
    ctx.beginPath();
    ctx.rect(-w/2, -h/2, w, h);
    ctx.fill();
    ctx.stroke();
    if (!isWall && o.rotation) {
      ctx.strokeStyle = '#ffffff18';
      ctx.lineWidth = 1;
      for (let i=-w/2 + 8; i<w/2; i+=8) {
        ctx.beginPath();
        ctx.moveTo(i, -h/2);
        ctx.lineTo(i + h*0.15, h/2);
        ctx.stroke();
      }
    }
    ctx.restore();
  });
  ctx.restore();
}

function drawFinishLine() {
  if (finishLineProjected == null) return;
  const y = worldToScreen(0, finishLineProjected).y;
  const bannerHeight = 20;
  ctx.save();
  ctx.fillStyle = '#666';
  const postW = 8;
  const halfWidthVisual = 14;
  const leftX = worldToScreen(-halfWidthVisual, finishLineProjected).x;
  const rightX = worldToScreen(halfWidthVisual, finishLineProjected).x;
  ctx.fillRect(leftX - postW/2, y - bannerHeight*2, postW, bannerHeight*3);
  ctx.fillRect(rightX - postW/2, y - bannerHeight*2, postW, bannerHeight*3);
  const bannerY = y - bannerHeight;
  const bannerW = rightX - leftX;
  const squareSize = 10;
  for (let bx = 0; bx < bannerW; bx += squareSize) {
    for (let by = 0; by < bannerHeight; by += squareSize) {
      const even = ((bx / squareSize) + (by / squareSize)) % 2 === 0;
      ctx.fillStyle = even ? '#fff' : '#000';
      ctx.fillRect(leftX + bx, bannerY + by, squareSize, squareSize);
    }
  }
  ctx.restore();
}

function finishLineYToProjected(yVal: number): number { return yVal; }

export function setPlayerColor(playerId: string, color: string) {
  const target = marbles.get(playerId) || previewMarbles.get(playerId);
  if (target) target.color = color;
}
export function focusOnPlayer(playerId: string) { followPlayerId = playerId; }
export function tickCameraFollow() {/* camera handled in render loop */}
export function updateNameTags() {/* integrated into canvas draw now */}

export function showLobbyPreview(playerIds: string[]) {
  clearPreview();
  isPreview = true;
  const maxPerRow = 6;
  const spacingX = 3.0;
  const spacingY = 1.5;
  playerIds.forEach((id, idx) => {
    const row = Math.floor(idx / maxPerRow);
    const col = idx % maxPerRow;
    const stagger = (row % 2) * 0.9;
    const x = (col - (maxPerRow-1)/2 + stagger) * spacingX;
    const y = row * spacingY;
    previewMarbles.set(id, { playerId: id, x, y, color: previewMarbles.get(id)?.color || randomColorFor(id) });
  });
}

export function clearPreview() { previewMarbles.clear(); isPreview = false; }

function randomColorFor(id: string) {
  let h = 0; for (let i=0;i<id.length;i++) h = (h + id.charCodeAt(i)*31) % 360;
  return `hsl(${h} 70% 55%)`;
}
