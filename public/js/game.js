// ============================================
// Mind Meld — Game Client
// Socket.IO client + UI state management
// ============================================

// ── Socket Connection ───────────────────────
const socket = io();

// ── State ───────────────────────────────────
let currentRoomCode = null;
let myName = '';
let players = [];
let timerInterval = null;
let timerSeconds = 30;

// ── DOM Elements ────────────────────────────
const screens = {
  home: document.getElementById('screen-home'),
  waiting: document.getElementById('screen-waiting'),
  game: document.getElementById('screen-game'),
  win: document.getElementById('screen-win'),
};

const gameStates = {
  input: document.getElementById('state-input'),
  waiting: document.getElementById('state-waiting'),
  result: document.getElementById('state-result'),
};

// ── Init ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Check URL params for auto-join
  const params = new URLSearchParams(window.location.search);
  const roomFromURL = params.get('room');
  if (roomFromURL) {
    document.getElementById('room-code-input').value = roomFromURL.toUpperCase();
    document.getElementById('join-section').style.display = 'block';
  }

  // Enter key handlers
  document.getElementById('player-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createRoom();
  });

  document.getElementById('room-code-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinRoom();
  });

  document.getElementById('room-code-input').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
  });

  document.getElementById('word-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitWord();
  });
});

// ── Screen Management ───────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

function showGameState(name) {
  Object.values(gameStates).forEach(s => s.style.display = 'none');
  if (gameStates[name]) {
    gameStates[name].style.display = 'block';
    // Re-trigger animation
    gameStates[name].classList.remove('slide-up');
    void gameStates[name].offsetWidth; // Force reflow
    gameStates[name].classList.add('slide-up');
  }
}

// ── Toast ───────────────────────────────────
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast' + (isError ? ' error' : '');

  // Force reflow for animation
  void toast.offsetWidth;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ── HOME ACTIONS ────────────────────────────
function getPlayerName() {
  const name = document.getElementById('player-name').value.trim();
  if (!name) {
    showToast('Vui lòng nhập tên của bạn!', true);
    document.getElementById('player-name').focus();
    return null;
  }
  return name;
}

function createRoom() {
  const name = getPlayerName();
  if (!name) return;

  myName = name;
  socket.emit('create-room', { playerName: name });
}

function toggleJoinInput() {
  const section = document.getElementById('join-section');
  section.style.display = section.style.display === 'none' ? 'block' : 'none';
  if (section.style.display === 'block') {
    document.getElementById('room-code-input').focus();
  }
}

function joinRoom() {
  const name = getPlayerName();
  if (!name) return;

  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (!code || code.length !== 4) {
    showToast('Mã phòng phải có 4 ký tự!', true);
    return;
  }

  myName = name;
  socket.emit('join-room', { roomCode: code, playerName: name });
}

// ── WAITING ROOM ACTIONS ────────────────────
function renderRoomCode(code) {
  const container = document.getElementById('room-code-display');
  container.innerHTML = code.split('').map(ch =>
    `<div class="letter">${ch}</div>`
  ).join('');
}

function renderPlayersList(playerList) {
  const ul = document.getElementById('players-list');
  ul.innerHTML = playerList.map(p => `
    <li>
      <span class="status-dot${p.isYou ? '' : ' waiting'}"></span>
      <span>${p.name}${p.isYou ? ' (Bạn)' : ''}</span>
    </li>
  `).join('');
}

function copyRoomCode() {
  if (!currentRoomCode) return;
  navigator.clipboard.writeText(currentRoomCode).then(() => {
    const btn = document.getElementById('btn-copy-code');
    btn.textContent = '✅ Đã copy!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = '📋 Copy mã';
      btn.classList.remove('copied');
    }, 2000);
  });
}

function copyShareLink() {
  if (!currentRoomCode) return;
  const url = `${window.location.origin}?room=${currentRoomCode}`;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('btn-copy-link');
    btn.textContent = '✅ Đã copy!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = '🔗 Copy link';
      btn.classList.remove('copied');
    }, 2000);
  });
}

function leaveRoom() {
  if (currentRoomCode) {
    socket.emit('leave-room', { roomCode: currentRoomCode });
  }
  currentRoomCode = null;
  goHome();
}

function goHome() {
  currentRoomCode = null;
  clearTimer();
  document.getElementById('overlay-player-left').classList.remove('active');
  showScreen('home');

  // Clean URL params
  window.history.replaceState({}, '', window.location.pathname);
}

// ── GAME ACTIONS ────────────────────────────
function submitWord() {
  const input = document.getElementById('word-input');
  const word = input.value.trim();

  if (!word) {
    showToast('Vui lòng nhập một từ!', true);
    input.focus();
    return;
  }

  socket.emit('submit-word', { roomCode: currentRoomCode, word });
  clearTimer();
}

function startTimer(seconds = 30) {
  clearTimer();
  timerSeconds = seconds;

  const timerEl = document.getElementById('timer-value');
  const timerContainer = document.getElementById('timer');
  timerEl.textContent = timerSeconds;
  timerContainer.classList.remove('urgent');

  timerInterval = setInterval(() => {
    timerSeconds--;
    timerEl.textContent = timerSeconds;

    if (timerSeconds <= 10) {
      timerContainer.classList.add('urgent');
    }

    if (timerSeconds <= 0) {
      clearTimer();
      // Auto-submit empty word (will be treated as timeout)
      const input = document.getElementById('word-input');
      if (input.value.trim()) {
        submitWord();
      } else {
        socket.emit('submit-word', { roomCode: currentRoomCode, word: '⏰' });
      }
    }
  }, 1000);
}

function clearTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function playAgain() {
  socket.emit('play-again', { roomCode: currentRoomCode });
}

function renderPreviousWords(previousWords) {
  const container = document.getElementById('previous-words-container');

  if (!previousWords) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="previous-words">
      <div class="word-card ${previousWords[0].name === myName ? 'you' : 'opponent'}">
        <div class="word">"${escapeHtml(previousWords[0].word)}"</div>
        <div class="player-name">${escapeHtml(previousWords[0].name)}</div>
      </div>
      <div class="words-connector">↔</div>
      <div class="word-card ${previousWords[1].name === myName ? 'you' : 'opponent'}">
        <div class="word">"${escapeHtml(previousWords[1].word)}"</div>
        <div class="player-name">${escapeHtml(previousWords[1].name)}</div>
      </div>
    </div>
  `;
}

function renderHistory(history) {
  const container = document.getElementById('history-list');
  container.innerHTML = history.map(item => {
    const w1 = item.words[0];
    const w2 = item.words[1];
    return `
      <div class="history-item ${item.matched ? 'matched' : ''}">
        <span class="history-round">Vòng ${item.round}</span>
        <span class="history-words">"${escapeHtml(w1.word)}" ↔ "${escapeHtml(w2.word)}"</span>
        <span class="history-status">${item.matched ? '✅' : '❌'}</span>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ── SOCKET EVENT HANDLERS ───────────────────

// Room created
socket.on('room-created', ({ roomCode }) => {
  currentRoomCode = roomCode;
  renderRoomCode(roomCode);
  showScreen('waiting');
});

// Player joined
socket.on('player-joined', ({ players: playerList, gameReady }) => {
  players = playerList;
  renderPlayersList(playerList);

  // If we're on home screen and just joined, go to waiting
  if (screens.home.classList.contains('active')) {
    const room = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (room) currentRoomCode = room;
    renderRoomCode(currentRoomCode);
    showScreen('waiting');
  }

  // Update all status dots to connected
  if (gameReady) {
    document.querySelectorAll('.status-dot').forEach(dot => dot.classList.remove('waiting'));
  }
});

// Round start
socket.on('round-start', ({ roundNumber, previousWords }) => {
  showScreen('game');
  showGameState('input');

  // Update round number
  document.getElementById('round-number').textContent = roundNumber;

  // Update player names in header
  const me = players.find(p => p.isYou);
  const opponent = players.find(p => !p.isYou);
  if (me) document.getElementById('player1-name').textContent = me.name;
  if (opponent) document.getElementById('player2-name').textContent = opponent.name;

  // Update prompt text
  const promptEl = document.getElementById('prompt-text');
  if (previousWords) {
    promptEl.innerHTML = '💭 Nghĩ 1 từ <span class="highlight">KẾT NỐI</span> 2 từ trên!';
  } else {
    promptEl.innerHTML = '💭 Nghĩ một từ <span class="highlight">BẤT KỲ</span> trong đầu bạn!';
  }

  // Render previous words
  renderPreviousWords(previousWords);

  // Clear and focus input
  const input = document.getElementById('word-input');
  input.value = '';
  input.disabled = false;
  document.getElementById('btn-submit').disabled = false;
  setTimeout(() => input.focus(), 300);

  // Start timer
  startTimer(30);
});

// Waiting for opponent
socket.on('waiting-opponent', () => {
  showGameState('waiting');
  document.getElementById('word-input').disabled = true;
  document.getElementById('btn-submit').disabled = true;
});

// Round result (miss)
socket.on('round-result', ({ words, matched, roundNumber }) => {
  showGameState('result');

  // Find which word is mine
  const myWord = words.find(w => w.playerName === myName) || words[0];
  const opWord = words.find(w => w.playerName !== myName) || words[1];

  document.getElementById('result-word1').textContent = `"${myWord.word}"`;
  document.getElementById('result-name1').textContent = myWord.playerName;
  document.getElementById('result-word2').textContent = `"${opWord.word}"`;
  document.getElementById('result-name2').textContent = opWord.playerName;

  // Shake animation
  const resultCard = document.getElementById('state-result');
  resultCard.classList.add('shake');
  setTimeout(() => resultCard.classList.remove('shake'), 500);
});

// Game won!
socket.on('game-won', ({ word, totalRounds, history }) => {
  showScreen('win');
  clearTimer();

  document.getElementById('win-word').textContent = `✨ "${word}" ✨`;
  document.getElementById('win-rounds').textContent = totalRounds;
  document.getElementById('rematch-status').style.display = 'none';

  renderHistory(history);

  // 🎉 Confetti!
  confetti.launch(200, 5000);
});

// Game reset (play again)
socket.on('game-reset', () => {
  document.getElementById('rematch-status').style.display = 'none';
});

// Opponent wants rematch
socket.on('opponent-wants-rematch', ({ playerName }) => {
  showToast(`${playerName} muốn chơi lại! Bấm "Chơi Lại" để đồng ý.`);
});

// Waiting for rematch
socket.on('waiting-rematch', () => {
  document.getElementById('rematch-status').style.display = 'block';
});

// Player left
socket.on('player-left', ({ message }) => {
  clearTimer();
  document.getElementById('overlay-player-left').classList.add('active');
});

// Error
socket.on('error', ({ message }) => {
  showToast(message, true);
});

// Connection events
socket.on('disconnect', () => {
  showToast('Mất kết nối! Đang thử kết nối lại...', true);
});

socket.on('connect', () => {
  // If we were in a room, the state is lost on server side
  // Just notify the user
  if (currentRoomCode && !screens.home.classList.contains('active')) {
    showToast('Đã kết nối lại! Tuy nhiên phòng cũ có thể đã mất.', true);
    setTimeout(() => goHome(), 2000);
  }
});
