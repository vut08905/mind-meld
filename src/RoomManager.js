// ============================================
// Mind Meld — Room Manager
// ============================================
const { generateRoomCode } = require('./utils');
const GameManager = require('./GameManager');

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomCode → RoomObject

    // Cleanup empty rooms every 5 minutes
    setInterval(() => this.cleanupEmptyRooms(), 5 * 60 * 1000);
  }

  /**
   * Create a new room
   * @param {string} socketId
   * @param {string} playerName
   * @returns {string} roomCode
   */
  createRoom(socketId, playerName) {
    let code = generateRoomCode();

    // Ensure unique code
    let attempts = 0;
    while (this.rooms.has(code) && attempts < 100) {
      code = generateRoomCode();
      attempts++;
    }

    const room = {
      code,
      players: [{ id: socketId, name: playerName }],
      game: null,
      createdAt: Date.now()
    };

    this.rooms.set(code, room);
    return code;
  }

  /**
   * Join an existing room
   * @param {string} roomCode
   * @param {string} socketId
   * @param {string} playerName
   * @returns {{ success: boolean, room?: object, error?: string }}
   */
  joinRoom(roomCode, socketId, playerName) {
    const code = roomCode.toUpperCase().trim();
    const room = this.rooms.get(code);

    if (!room) {
      return { success: false, error: 'Phòng không tồn tại! Kiểm tra lại mã phòng.' };
    }

    if (room.players.length >= 2) {
      return { success: false, error: 'Phòng đã đủ 2 người chơi!' };
    }

    // Check if player already in room
    if (room.players.some(p => p.id === socketId)) {
      return { success: false, error: 'Bạn đã ở trong phòng này rồi!' };
    }

    room.players.push({ id: socketId, name: playerName });

    return { success: true, room };
  }

  /**
   * Remove a player from their room
   * @param {string} socketId
   * @returns {{ roomCode?: string, remainingPlayers?: Array, wasInRoom: boolean }}
   */
  leaveRoom(socketId) {
    for (const [code, room] of this.rooms) {
      const playerIndex = room.players.findIndex(p => p.id === socketId);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);

        if (room.players.length === 0) {
          this.rooms.delete(code);
          return { roomCode: code, remainingPlayers: [], wasInRoom: true };
        }

        // Reset game if someone leaves mid-game
        room.game = null;

        return { roomCode: code, remainingPlayers: room.players, wasInRoom: true };
      }
    }
    return { wasInRoom: false };
  }

  /**
   * Get a room by code
   * @param {string} roomCode
   * @returns {object|null}
   */
  getRoom(roomCode) {
    return this.rooms.get(roomCode.toUpperCase().trim()) || null;
  }

  /**
   * Get room by socket ID
   * @param {string} socketId
   * @returns {object|null}
   */
  getRoomBySocketId(socketId) {
    for (const room of this.rooms.values()) {
      if (room.players.some(p => p.id === socketId)) {
        return room;
      }
    }
    return null;
  }

  /**
   * Start a game in a room
   * @param {string} roomCode
   * @returns {GameManager|null}
   */
  startGame(roomCode) {
    const room = this.getRoom(roomCode);
    if (!room || room.players.length < 2) return null;

    room.game = new GameManager();
    room.game.startRound();
    return room.game;
  }

  /**
   * Remove rooms that have been empty or stale for too long
   */
  cleanupEmptyRooms() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    for (const [code, room] of this.rooms) {
      if (room.players.length === 0 || (now - room.createdAt > maxAge && (!room.game || room.game.status === 'finished'))) {
        this.rooms.delete(code);
      }
    }
  }

  /**
   * Get total active rooms count
   */
  getRoomCount() {
    return this.rooms.size;
  }
}

module.exports = RoomManager;
