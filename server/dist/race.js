"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRace = createRace;
function createRace(io, lobby) {
    // Pure 2D physics parameters
    // Physics tuning: stronger gravity & lower damping to speed marbles up
    const gravityY = -32; // was -18
    const linearDamping = 0.01; // was 0.02
    const restitution = 0.55;
    const wallRestitution = 0.6;
    const platformRestitution = 0.6;
    const radius = 0.5; // marble radius
    const marbles = [];
    lobby.state.players.forEach((p, idx) => {
        marbles.push({
            playerId: p.id,
            x: (idx - (lobby.state.players.length - 1) / 2) * (radius * 3),
            y: 2,
            // Small initial nudge downward so they spread faster immediately
            vx: 0,
            vy: -5,
            finished: false,
            color: p.color
        });
    });
    const results = [];
    let running = false;
    let lastBroadcast = 0;
    const broadcastHz = 15;
    const intervalMs = 1000 / 60;
    let raceStartTime = Date.now();
    // ---------------- Track & Obstacles (Random each race) ----------------
    function randomId(prefix, i) { return `${prefix}_${i}`; }
    function generateTrack() {
        // New random seed each race (for potential replay logging)
        const seed = Math.random().toString(36).slice(2, 10);
        const obstacles = [];
        const nominalTrackLength = 160; // base used to start placing platforms
        const wallThickness = 1.2;
        const halfWidth = 14;
        // We'll add walls after we know finishLineY so they exactly span from near start to beyond finish.
        // Procedurally create a set of angled platforms.
        const platformCount = 6 + Math.floor(Math.random() * 4); // 6-9 platforms
        let currentY = -20;
        for (let i = 0; i < platformCount; i++) {
            const gap = 15 + Math.random() * 12; // vertical spacing
            currentY -= gap;
            const width = 14 + Math.random() * 10; // 14-24 world units
            const length = 1.6 + Math.random() * 1.2; // 1.6 - 2.8
            const rot = (Math.random() * 0.22 - 0.11) * Math.PI; // mild tilt both directions
            const xOffset = (Math.random() * 10 - 5); // shift platform horizontally
            obstacles.push({
                id: randomId('plat', i),
                type: 'box',
                position: { x: xOffset, y: currentY },
                size: { x: width, y: length },
                rotation: rot
            });
        }
        const finishLineY = currentY - 25; // place finish beyond last platform
        // Now create walls spanning from yTop to yBottom covering the whole race corridor.
        const yTop = -nominalTrackLength / 2; // starting top region
        const yBottom = finishLineY - 10; // extend a bit past finish line
        const wallCenterY = (yTop + yBottom) / 2;
        const wallLength = (yTop - yBottom); // y decreases downward
        obstacles.push({ id: 'wallL', type: 'box', position: { x: -halfWidth, y: wallCenterY }, size: { x: wallThickness, y: Math.abs(wallLength) } });
        obstacles.push({ id: 'wallR', type: 'box', position: { x: halfWidth, y: wallCenterY }, size: { x: wallThickness, y: Math.abs(wallLength) } });
        return { seed, obstacles, finishLineY };
    }
    // Obstacles already stored; no baking needed for 2D custom physics
    let trackData = null;
    function stepLoop() {
        if (!running)
            return;
        const now = Date.now();
        const dt = intervalMs / 1000;
        // Integrate marbles
        marbles.forEach(m => {
            if (m.finished)
                return;
            m.vy += gravityY * dt;
            // Damping
            m.vx *= (1 - linearDamping);
            m.vy *= (1 - linearDamping);
            m.x += m.vx * dt;
            m.y += m.vy * dt;
            // Clamp extreme velocity to keep simulation stable
            const maxSpeed = 120;
            const speedSq = m.vx * m.vx + m.vy * m.vy;
            if (speedSq > maxSpeed * maxSpeed) {
                const s = Math.sqrt(speedSq);
                const k = maxSpeed / s;
                m.vx *= k;
                m.vy *= k;
            }
        });
        // Collisions: walls & platforms
        handleCollisions();
        // Finish detection (simple y threshold relative to plane orientation -> world y)
        const finishThreshold = trackData?.finishLineY ?? -50;
        marbles.forEach(m => {
            if (!m.finished && m.y < finishThreshold) {
                m.finished = true;
                m.finishTime = now - raceStartTime;
                const player = lobby.state.players.find(p => p.id === m.playerId);
                const result = {
                    playerId: m.playerId,
                    name: player.name,
                    timeMs: m.finishTime,
                    rank: results.length + 1
                };
                results.push(result);
                io.to(lobby.state.code).emit('playerFinished', result);
                if (results.length === lobby.state.players.length) {
                    endRace();
                }
            }
        });
        if (now - lastBroadcast > 1000 / broadcastHz) {
            lastBroadcast = now;
            const snapshot = {
                marbles: marbles.map(m => ({
                    playerId: m.playerId,
                    position: { x: m.x, y: m.y },
                    velocity: { x: m.vx, y: m.vy }
                })),
                time: now - raceStartTime,
                serverTime: now
            };
            io.to(lobby.state.code).emit('raceSnapshot', snapshot);
        }
        setTimeout(stepLoop, intervalMs);
    }
    function start() {
        if (running)
            return;
        running = true;
        raceStartTime = Date.now();
        trackData = generateTrack();
        io.to(lobby.state.code).emit('raceStarted', raceStartTime);
        io.to(lobby.state.code).emit('trackData', trackData);
        stepLoop();
    }
    function endRace() {
        running = false;
        io.to(lobby.state.code).emit('raceFinished', results);
        lobby.state.status = 'finished';
        // Broadcast updated lobby state so clients can show post-race UI and enable reset
        io.to(lobby.state.code).emit('lobbyState', lobby.state);
    }
    // Collision helpers
    function handleCollisions() {
        if (!trackData)
            return;
        const obstacles = trackData.obstacles;
        obstacles.forEach(o => {
            const isWall = o.id === 'wallL' || o.id === 'wallR';
            const cos = o.rotation ? Math.cos(o.rotation) : 1;
            const sin = o.rotation ? Math.sin(o.rotation) : 0;
            const hx = o.size.x / 2;
            const hy = o.size.y / 2;
            marbles.forEach(m => {
                if (m.finished)
                    return;
                // Transform marble center into obstacle local space
                const relX = m.x - o.position.x;
                const relY = m.y - o.position.y;
                const localX = relX * cos + relY * sin;
                const localY = -relX * sin + relY * cos;
                // Compute closest point on box
                const clampedX = Math.max(-hx, Math.min(hx, localX));
                const clampedY = Math.max(-hy, Math.min(hy, localY));
                const dx = localX - clampedX;
                const dy = localY - clampedY;
                const distSq = dx * dx + dy * dy;
                if (distSq <= radius * radius) {
                    // Collision with side or corner
                    let nx;
                    let ny;
                    if (distSq === 0) {
                        // Inside box; choose axis of minimum penetration
                        const penX = hx - Math.abs(localX);
                        const penY = hy - Math.abs(localY);
                        if (penX < penY) {
                            nx = localX > 0 ? 1 : -1;
                            ny = 0;
                        }
                        else {
                            nx = 0;
                            ny = localY > 0 ? 1 : -1;
                        }
                    }
                    else {
                        const dist = Math.sqrt(distSq);
                        nx = dx / dist;
                        ny = dy / dist;
                    }
                    // Penetration depth
                    const dist = Math.sqrt(distSq) || 0;
                    const pen = radius - dist;
                    // Push marble out along normal (convert normal back to world space)
                    const worldNX = nx * cos - ny * sin;
                    const worldNY = nx * sin + ny * cos;
                    m.x += worldNX * pen;
                    m.y += worldNY * pen;
                    // Reflect velocity
                    const vn = m.vx * worldNX + m.vy * worldNY;
                    if (vn < 0) {
                        const bounce = isWall ? wallRestitution : platformRestitution;
                        m.vx -= (1 + bounce) * vn * worldNX;
                        m.vy -= (1 + bounce) * vn * worldNY;
                    }
                }
            });
        });
    }
    return { start };
}
