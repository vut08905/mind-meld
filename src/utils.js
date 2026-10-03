// ============================================
// Mind Meld — Utility Functions
// ============================================

/**
 * Generate a random 4-letter uppercase room code
 * @returns {string} e.g. "XKQM"
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Removed I, O to avoid confusion
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Normalize a word for comparison
 * - Lowercase
 * - Trim whitespace
 * - Collapse multiple spaces
 * - Remove leading/trailing punctuation
 * @param {string} word
 * @returns {string}
 */
function normalizeWord(word) {
  if (!word || typeof word !== 'string') return '';
  return word
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''); // Remove leading/trailing non-alphanumeric (unicode-aware)
}

/**
 * Validate a submitted word
 * @param {string} word
 * @returns {{ valid: boolean, error?: string }}
 */
function validateWord(word) {
  if (!word || typeof word !== 'string') {
    return { valid: false, error: 'Vui lòng nhập một từ!' };
  }

  const trimmed = word.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Vui lòng nhập một từ!' };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: 'Từ quá dài! Tối đa 50 ký tự.' };
  }

  // Check if it contains at least one letter or number (unicode-aware)
  if (!/[\p{L}\p{N}]/u.test(trimmed)) {
    return { valid: false, error: 'Từ phải chứa ít nhất một chữ cái hoặc số!' };
  }

  return { valid: true };
}

module.exports = { generateRoomCode, normalizeWord, validateWord };
