"use strict";
// Shared event & state type definitions for Marble Racer
// These should be imported by both server and client to ensure consistency.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_PLAYERS_TO_START = void 0;
exports.generateLobbyCode = generateLobbyCode;
exports.MIN_PLAYERS_TO_START = 1; // adjust as needed
function generateLobbyCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++)
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
    return code;
}
