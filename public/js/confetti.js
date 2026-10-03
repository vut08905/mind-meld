// ============================================
// Mind Meld — Confetti Animation
// Lightweight confetti effect for celebrations
// ============================================

class ConfettiManager {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.running = false;
    this.resizeHandler = () => this.resize();
    window.addEventListener('resize', this.resizeHandler);
    this.resize();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /**
   * Launch confetti burst
   * @param {number} count - number of confetti pieces
   * @param {number} duration - how long confetti lasts (ms)
   */
  launch(count = 150, duration = 4000) {
    this.particles = [];

    const colors = [
      '#6C5CE7', '#A29BFE', '#00CEC9', '#55EFC4',
      '#FDCB6E', '#FF6B6B', '#FF9FF3', '#48DBFB',
      '#FFA502', '#2ED573'
    ];

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height * 0.5 - this.canvas.height * 0.3,
        vx: (Math.random() - 0.5) * 12,
        vy: Math.random() * -8 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        gravity: 0.12 + Math.random() * 0.08,
        drag: 0.98 + Math.random() * 0.015,
        opacity: 1,
        shape: Math.random() > 0.5 ? 'rect' : 'circle'
      });
    }

    this.running = true;
    this.animate();

    setTimeout(() => {
      this.running = false;
    }, duration);
  }

  animate() {
    if (!this.running && this.particles.every(p => p.opacity <= 0)) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach(p => {
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;

      if (!this.running) {
        p.opacity -= 0.02;
      }

      if (p.opacity <= 0) return;

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.globalAlpha = Math.max(0, p.opacity);
      this.ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        this.ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    });

    requestAnimationFrame(() => this.animate());
  }
}

// Global instance
const confetti = new ConfettiManager('confetti-canvas');
