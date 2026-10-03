// ============================================
// Mind Meld — Game Manager
// ============================================
const { normalizeWord, validateWord } = require('./utils');

class GameManager {
  constructor() {
    this.roundNumber = 0;
    this.currentWords = new Map(); // socketId → word
    this.history = [];             // [{ round, words: { player1Id: word, player2Id: word }, matched }]
    this.previousWords = null;     // [word1, word2] from last round
    this.status = 'waiting';       // 'waiting' | 'playing' | 'finished'
    this.timerDuration = 30;       // seconds per round
  }

  /**
   * Start a new game (or new round)
   */
  startRound() {
    this.roundNumber++;
    this.currentWords.clear();
    this.status = 'playing';
  }

  /**
   * Submit a word for a player
   * @param {string} socketId
   * @param {string} word
   * @param {number} totalPlayers - expected number of players
   * @returns {{ valid: boolean, allSubmitted: boolean, error?: string }}
   */
  submitWord(socketId, word, totalPlayers = 2) {
    if (this.status !== 'playing') {
      return { valid: false, allSubmitted: false, error: 'Game chưa bắt đầu hoặc đã kết thúc!' };
    }

    if (this.currentWords.has(socketId)) {
      return { valid: false, allSubmitted: false, error: 'Bạn đã gửi từ rồi!' };
    }

    const validation = validateWord(word);
    if (!validation.valid) {
      return { valid: false, allSubmitted: false, error: validation.error };
    }

    this.currentWords.set(socketId, word.trim());

    return {
      valid: true,
      allSubmitted: this.currentWords.size >= totalPlayers
    };
  }

  /**
   * Evaluate the current round
   * @param {Array<{id: string, name: string}>} players
   * @returns {{ matched: boolean, words: Array<{playerId, playerName, word}>, roundNumber: number }}
   */
  evaluateRound(players) {
    const words = players.map(p => ({
      playerId: p.id,
      playerName: p.name,
      word: this.currentWords.get(p.id) || '',
    }));

    const normalizedWords = words.map(w => normalizeWord(w.word));
    const matched = normalizedWords.length === 2 && normalizedWords[0] === normalizedWords[1] && normalizedWords[0] !== '';

    // Save to history
    this.history.push({
      round: this.roundNumber,
      words: words.map(w => ({ name: w.playerName, word: w.word })),
      matched
    });

    if (matched) {
      this.status = 'finished';
    } else {
      // Set previous words for next round
      this.previousWords = words.map(w => ({
        name: w.playerName,
        word: w.word
      }));
    }

    return {
      matched,
      words,
      roundNumber: this.roundNumber
    };
  }

  /**
   * Get previous words for display
   */
  getPreviousWords() {
    return this.previousWords;
  }

  /**
   * Get full game history
   */
  getHistory() {
    return this.history;
  }

  /**
   * Reset game for "play again"
   */
  reset() {
    this.roundNumber = 0;
    this.currentWords.clear();
    this.history = [];
    this.previousWords = null;
    this.status = 'waiting';
  }
}

module.exports = GameManager;
