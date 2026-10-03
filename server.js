// ============================================
// Mind Meld — Main Server
// Express + Socket.IO
// ============================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const RoomManager = require('./src/RoomManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const roomManager = new RoomManager();

// ── Serve static files ──────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Health check endpoint ───────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    rooms: roomManager.getRoomCount(),
    uptime: process.uptime()
  });
});

// ── Socket.IO Event Handling ────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  // ── CREATE ROOM ───────────────────────────
  socket.on('create-room', ({ playerName }) => {
    if (!playerName || playerName.trim().length === 0) {
      socket.emit('error', { message: 'Vui lòng nhập tên của bạn!' });
      return;
    }

    const roomCode = roomManager.createRoom(socket.id, playerName.trim());
    socket.join(roomCode);

    socket.emit('room-created', { roomCode });
    socket.emit('player-joined', {
      players: [{ name: playerName.trim(), isYou: true }],
      gameReady: false
    });

    console.log(`🏠 Room ${roomCode} created by ${playerName.trim()}`);
  });

  // ── JOIN ROOM ─────────────────────────────
  socket.on('join-room', ({ roomCode, playerName }) => {
    if (!playerName || playerName.trim().length === 0) {
      socket.emit('error', { message: 'Vui lòng nhập tên của bạn!' });
      return;
    }

    if (!roomCode || roomCode.trim().length === 0) {
      socket.emit('error', { message: 'Vui lòng nhập mã phòng!' });
      return;
    }

    const result = roomManager.joinRoom(roomCode, socket.id, playerName.trim());

    if (!result.success) {
      socket.emit('error', { message: result.error });
      return;
    }

    const room = result.room;
    socket.join(room.code);

    // Notify all players in room
    room.players.forEach(player => {
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) {
        playerSocket.emit('player-joined', {
          players: room.players.map(p => ({
            name: p.name,
            isYou: p.id === player.id
          })),
          gameReady: room.players.length === 2
        });
      }
    });

    console.log(`🚪 ${playerName.trim()} joined room ${room.code}`);

    // Auto-start game when 2 players are in
    if (room.players.length === 2) {
      const game = roomManager.startGame(room.code);
      if (game) {
        setTimeout(() => {
          io.to(room.code).emit('round-start', {
            roundNumber: game.roundNumber,
            previousWords: null
          });
          console.log(`🎮 Game started in room ${room.code}`);
        }, 1500); // Small delay for UI transition
      }
    }
  });

  // ── SUBMIT WORD ───────────────────────────
  socket.on('submit-word', ({ roomCode, word }) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) {
      socket.emit('error', { message: 'Phòng không tồn tại!' });
      return;
    }

    if (!room.game || room.game.status !== 'playing') {
      socket.emit('error', { message: 'Game chưa bắt đầu!' });
      return;
    }

    const result = room.game.submitWord(socket.id, word, room.players.length);

    if (!result.valid) {
      socket.emit('error', { message: result.error });
      return;
    }

    // Tell this player they're waiting
    socket.emit('waiting-opponent');

    // If all players submitted, evaluate
    if (result.allSubmitted) {
      const evaluation = room.game.evaluateRound(room.players);

      if (evaluation.matched) {
        // MIND MELD! 🎉
        io.to(roomCode).emit('game-won', {
          word: evaluation.words[0].word,
          totalRounds: evaluation.roundNumber,
          history: room.game.getHistory()
        });
        console.log(`🎉 MIND MELD in room ${roomCode}! Word: "${evaluation.words[0].word}" in ${evaluation.roundNumber} rounds`);
      } else {
        // Not matched — show results then start next round
        io.to(roomCode).emit('round-result', {
          words: evaluation.words,
          matched: false,
          roundNumber: evaluation.roundNumber
        });

        // Start next round after delay
        setTimeout(() => {
          room.game.startRound();
          io.to(roomCode).emit('round-start', {
            roundNumber: room.game.roundNumber,
            previousWords: room.game.getPreviousWords()
          });
        }, 3000);
      }
    }
  });

  // ── PLAY AGAIN ────────────────────────────
  socket.on('play-again', ({ roomCode }) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    if (!room.playAgainVotes) room.playAgainVotes = new Set();
    room.playAgainVotes.add(socket.id);

    // Need both players to agree
    if (room.playAgainVotes.size >= 2) {
      room.playAgainVotes.clear();
      const game = roomManager.startGame(room.code);
      if (game) {
        io.to(roomCode).emit('game-reset');
        setTimeout(() => {
          io.to(roomCode).emit('round-start', {
            roundNumber: game.roundNumber,
            previousWords: null
          });
        }, 1000);
        console.log(`🔄 Game restarted in room ${roomCode}`);
      }
    } else {
      // Notify opponent that this player wants to play again
      socket.to(roomCode).emit('opponent-wants-rematch', {
        playerName: room.players.find(p => p.id === socket.id)?.name
      });
      socket.emit('waiting-rematch');
    }
  });

  // ── LEAVE ROOM ────────────────────────────
  socket.on('leave-room', ({ roomCode }) => {
    handleDisconnect(socket);
  });

  // ── DISCONNECT ────────────────────────────
  socket.on('disconnect', () => {
    handleDisconnect(socket);
  });

  function handleDisconnect(socket) {
    const result = roomManager.leaveRoom(socket.id);

    if (result.wasInRoom && result.roomCode) {
      socket.leave(result.roomCode);

      if (result.remainingPlayers && result.remainingPlayers.length > 0) {
        io.to(result.roomCode).emit('player-left', {
          message: 'Đối thủ đã rời phòng!'
        });
      }

      console.log(`👋 Player ${socket.id} left room ${result.roomCode}`);
    }

    console.log(`🔌 Disconnected: ${socket.id}`);
  }
});

// ── Start Server ────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║     🧠 Mind Meld Server Running     ║
  ║     http://localhost:${PORT}            ║
  ╚══════════════════════════════════════╝
  `);
});
