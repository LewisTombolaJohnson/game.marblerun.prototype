// DEPRECATED: Legacy Three.js 3D renderer kept for reference after migration to 2D canvas.
// Not imported by current client code. Safe to delete if 3D rendering won't return.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - three types removed after 2D migration; this file is reference only.
import * as THREE from 'three';
import type { RaceSnapshot } from '../../shared/events';

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let marbleMeshes = new Map<string, THREE.Mesh>();
let playerColors = new Map<string, string>();
let lobbyPreviewMeshes = new Map<string, THREE.Mesh>();
let isPreview = false;
const nameTagsContainer = document.getElementById('nameTags')!;

const cameraTarget = new THREE.Vector3();
let followPlayerId: string | null = null;

let nameLookup: (id: string) => string = (id) => id.substring(0,4);
export function setNameLookup(fn: (id: string) => string) { nameLookup = fn; }

export function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101018);
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 5, 10);

  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas') as HTMLCanvasElement, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(10, 20, 10);
  scene.add(dir);

  // Simple plane to visualize track (just for reference)
  const planeGeo = new THREE.PlaneGeometry(200, 200, 20, 20);
  planeGeo.rotateX(-Math.PI / 2);
  const planeMat = new THREE.MeshStandardMaterial({ color: 0x222233, wireframe: true });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  scene.add(plane);

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  if (isPreview) updatePreviewAnimation();
  renderer.render(scene, camera);
}

export function updateSceneWithSnapshot(snapshot: RaceSnapshot, myPlayerId: string | null) {
  snapshot.marbles.forEach(m => {
    let mesh = marbleMeshes.get(m.playerId);
    if (!mesh) {
      const geom = new THREE.SphereGeometry(0.5, 24, 24);
      const col = playerColors.get(m.playerId) || '#ff0000';
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(col) });
      mesh = new THREE.Mesh(geom, mat);
      marbleMeshes.set(m.playerId, mesh);
      scene.add(mesh);
    }
    mesh.position.set(m.position.x, m.position.y, m.position.z);
    if (myPlayerId && m.playerId === myPlayerId) {
      followPlayerId = m.playerId;
    }
  });
}

export function setPlayerColor(playerId: string, color: string) {
  playerColors.set(playerId, color);
  const mesh = marbleMeshes.get(playerId);
  if (mesh) (mesh.material as THREE.MeshStandardMaterial).color = new THREE.Color(color);
}

export function focusOnPlayer(playerId: string) {
  followPlayerId = playerId;
}

export function tickCameraFollow(myPlayerId: string | null) {
  if (!followPlayerId) return;
  const mesh = marbleMeshes.get(followPlayerId);
  if (!mesh) return;
  cameraTarget.lerp(mesh.position, 0.1);
  camera.position.lerp(new THREE.Vector3(mesh.position.x + 5, mesh.position.y + 5, mesh.position.z + 5), 0.08);
  camera.lookAt(cameraTarget);
}

export function updateNameTags() {
  nameTagsContainer.innerHTML = '';
  const collection = isPreview ? lobbyPreviewMeshes : marbleMeshes;
  collection.forEach((mesh, pid) => {
    const proj = mesh.position.clone().project(camera);
    const x = (proj.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-proj.y * 0.5 + 0.5) * window.innerHeight;
    const div = document.createElement('div');
    div.className = 'nameTag';
    div.style.left = x + 'px';
    div.style.top = y + 'px';
    div.textContent = nameLookup(pid);
    nameTagsContainer.appendChild(div);
  });
}

export function showLobbyPreview(playerIds: string[]) {
  clearPreview();
  isPreview = true;
  // Grid layout parameters
  const maxPerRow = 4; // 3 rows * 4 columns = 12 slots
  const spacing = 2.0;
  const startX = -((maxPerRow - 1) * spacing) / 2;
  playerIds.forEach((id, idx) => {
    const row = Math.floor(idx / maxPerRow);
    const col = idx % maxPerRow;
    const x = startX + col * spacing;
    const z = row * spacing * 1.2; // slight depth spread
    const geom = new THREE.SphereGeometry(0.5, 20, 20);
    const colr = playerColors.get(id) || '#cccccc';
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(colr) });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, 1, z);
    lobbyPreviewMeshes.set(id, mesh);
    scene.add(mesh);
  });
}

export function clearPreview() {
  lobbyPreviewMeshes.forEach(m => scene.remove(m));
  lobbyPreviewMeshes.clear();
  isPreview = false;
}

function updatePreviewAnimation() {
  const t = performance.now() * 0.001;
  lobbyPreviewMeshes.forEach((mesh, id) => {
    mesh.position.y = 1 + Math.sin(t * 2 + id.hashCode()) * 0.25;
  });
}

// Simple hash helper added onto String prototype guard
declare global { interface String { hashCode(): number; } }
if (!String.prototype.hashCode) {
  // eslint-disable-next-line no-extend-native
  String.prototype.hashCode = function(): number {
    let h = 0; for (let i=0;i<this.length;i++) { h = (Math.imul(31, h) + this.charCodeAt(i)) | 0; } return h;
  };
}
