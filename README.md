# Marble Racer Prototype

Multiplayer 2D marble racing game with procedurally generated angled platforms, walls, and a finish banner. Built with:

- Server: Node.js, Express, Socket.IO, custom 2D physics (no external physics engine)
- Client: Vite + TypeScript + Canvas 2D rendering with snapshot interpolation
- Shared: TypeScript types for events & state

## Features
- Create / join lobby via code
- Host can start and reset races instantly
- Random track each race (seed included in `TrackData.seed`)
- Smooth client-side interpolation
- Local player marble trail
- Walls fully enclosing from spawn to beyond finish line

## Running Locally

### Install
```bash
npm install
```

### Dev (hot reload server + client)
```bash
npm run dev
```
Client: http://localhost:5173  
Server / WebSocket: http://localhost:3000

### Build Production Bundles
```bash
npm run build
```
Outputs:
- Server build: `server/dist` (JS)
- Client build: `client/dist`

### Run Production Server (serves built client)
```bash
cd server
node dist/server.js
```
Then open: http://localhost:3000

## Configuration
Set `VITE_SERVER_URL` when building the client if hosting server and client under different domains:
```bash
VITE_SERVER_URL="https://your-server.example" npm --workspace client run build
```

## Deployment Options
### Single Server (Recommended for friends play)
1. Build everything: `npm run build`
2. Deploy the `server` folder (with `dist/` + `node_modules`) to a Node host.
3. Ensure port (default 3000) is open; optionally set `PORT` env variable.

### GitHub Pages (Client Only)
GitHub Pages can host only static files (no realtime server). To play multiplayer you still need the Socket.IO server somewhere else.
1. Build client: `npm --workspace client run build`
2. Publish `client/dist` to `gh-pages` branch (or use provided workflow once added).
3. Set `VITE_SERVER_URL` at build time pointing to your deployed server.

Example:
```bash
VITE_SERVER_URL="https://marble-backend.example" npm --workspace client run build
```
Then push the `client/dist` contents to GitHub Pages.

### Using the Included GitHub Pages Workflow
The workflow `.github/workflows/pages.yml` now:
- Configures Pages
- Builds the client with `vite build`
- Derives a base path from the repo name so assets load at `https://<user>.github.io/<repo>/`

If you fork or rename the repository and want to force root deployment, set an env var `BUILD_BASE=/` (add under the build step `env:`) to override.

### Why Deployment Previously Failed
Earlier the client build script used `tsc -b`, which only emitted raw TypeScript output (no bundling, no `index.html` asset rewriting). GitHub Pages received unbundled modules that the browser couldn't locate under the repository subpath, leading to 404s. Switching to `vite build` produces hashed asset files and rewrites `index.html` to reference them with the correct base path.

### Environment Variables in Workflow
`MARBLE_SERVER_URL` secret (optional) injects `VITE_SERVER_URL` so the static client knows where your WebSocket server lives.

If your server also sits behind HTTPS and a different domain, ensure CORS is open (the server currently allows `*`).

## Environment Variables
| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | Server listening port | `3000` |
| `VITE_SERVER_URL` | Client override for Socket.IO base URL | Same origin |

## Repository Structure
```
shared/   # Shared TypeScript types
server/   # Express + Socket.IO + physics
client/   # Vite front-end
```

## Future Ideas
- Spectator-only mode
- Power-up pads / slow zones
- Leaderboard persistence
- Mobile touch optimizations

## License
MIT (adjust as desired)
# Multiplayer Marble Racer (WIP)

A browser-based multiplayer marble racing game with lobby codes, countdown, physics, and a top-down 2D canvas renderer. Built with TypeScript, Node.js, Socket.IO, and cannon-es (server-side physics only).

## High-Level Features Planned
- Create / join lobby with 6-character code (like Among Us)
- Player-set display names
- 4-minute pre-game countdown (configurable) while players join
- Host can also Start Now (bypass countdown)
- Physics-based marble race with collisions
- Track slopes, obstacles, branching paths
- Camera follow on local player's marble
- Winner detection (first to finish trigger)

## Monorepo Layout
```
root
  package.json (workspaces)
  tsconfig.json (project refs)
  server/ (Express + Socket.IO + physics)
  client/ (Vite + Canvas 2D front-end)
  shared/ (Types, event schemas)
```

## Dev Scripts
Install everything at root:
```bash
npm install
```
Run both server and client:
```bash
npm run dev
```
Fast iteration (5s countdown):
```bash
npm run dev:quick
```
Server on port 3000 (WebSocket), client dev server on 5173 by default.

Quick shorter countdown for local testing (10s):
```bash
COUNTDOWN_SECONDS=10 npm run dev
```

## Countdown Configuration
 Default countdown: 240 seconds (4 minutes). Override via env var `COUNTDOWN_SECONDS`.

## Next Steps
Implement shared event contracts, then server logic, then client rendering.

## Current Status
- Basic lobby create/join with codes
- Countdown start (env overridable) & immediate start button
- Physics simulation server-side (inclined plane placeholder)
- Real-time marble positions broadcasting
- 2D canvas top-down rendering (mapping world X->screen X, world Z->screen Y)
- Lobby preview grid (up to 12 marbles) before race with names

## Development Workflow Note
During iterative development, always keep a dev server running (prefer `npm run dev:quick` for rapid feedback). After code changes, the process auto-restarts (server) or hot-reloads (client) so the game is immediately testable.

## 2D Rendering Notes
The 2D view maps physics world X to horizontal screen axis and physics Z to vertical screen axis. Physics Y (gravity axis) is ignored for rendering but still affects marble velocities, producing forward motion along the projected plane.

## Roadmap Ideas
- Procedural track with curves / obstacles sync via seed
- Spectator mode after finish
- Anti-cheat enhancements (already authoritative)
- Mobile controls / orientation adjustments

---
WIP scaffold committed by AI assistant.
