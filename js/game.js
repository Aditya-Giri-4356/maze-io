/* ============================================================
   MAZE.IO — Game Engine
   Canvas rendering, player movement, timer, level progression
   ============================================================ */

class GameEngine {
  constructor(canvas, playerName, roomCode) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.playerName = playerName;
    this.roomCode = roomCode;

    // Game state
    this.currentLevel = 1;
    this.totalLevels = window.MazeEngine.TOTAL_LEVELS;
    this.maze = null;
    this.playerPos = null; // {col, row} for square or {ring, sector} for circular

    // Timer
    this.timerStarted = false;
    this.timerRunning = false;
    this.startTime = 0;
    this.elapsedTime = 0;
    this.levelTimes = [];
    this.levelStartTime = 0;

    // Animation
    this.animFrame = null;
    this.isAnimating = false;

    // State flags
    this.isLevelComplete = false;
    this.isGameComplete = false;
    this.isReady = false;

    // Callbacks
    this.onTimerUpdate = null;
    this.onLevelComplete = null;
    this.onGameComplete = null;
    this.onLevelChange = null;

    // Input
    this._boundKeyDown = this._handleKeyDown.bind(this);
    this._boundKeyUp = this._handleKeyUp.bind(this);
    this._inputEnabled = false;

    // Player facing direction (rotation angle in radians)
    // 0 = up, π/2 = right, π = down, 3π/2 = left
    this.facingAngle = 0; // default: facing up (toward exit)

    // Long-press repeat system
    this._heldKey = null;
    this._repeatTimer = null;
    this._repeatDelay = 150;   // initial ms between repeats
    this._repeatMin = 50;      // fastest repeat speed
    this._repeatAccel = 0.82;  // multiplier per repeat (speeds up)
    this._currentRepeatSpeed = this._repeatDelay;

    // Room seed for deterministic mazes
    const room = window.roomManager.getRoomState(roomCode);
    this.roomSeed = room ? room.seed : 'default';

    // Smooth animation state
    this.visualPos = null;
    this.visualAngle = 0;
    this.isLooping = false;
  }

  // ---- Initialization ----
  init() {
    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());
    this._loadLevel(this.currentLevel);
  }

  _resizeCanvas() {
    const container = this.canvas.parentElement;
    
    // Fallback if View Transitions briefly collapse the container
    let w = container.clientWidth;
    let h = container.clientHeight;
    if (w < 50 || h < 50) {
      w = window.innerWidth - 40;
      h = window.innerHeight - 150;
    }

    const maxSize = Math.min(w - 20, h - 20, 700);
    const size = Math.max(300, maxSize);
    this.canvas.width = size;
    this.canvas.height = size;
    this.canvasSize = size;

    // Re-render if maze exists
    if (this.maze) {
      this._render();
    }
  }

  _loadLevel(level) {
    this.currentLevel = level;
    this.isLevelComplete = false;
    this.maze = window.MazeEngine.generateMazeForLevel(level, this.roomSeed);

    // Set player start position
    const start = this.maze.getStartPosition();
    this.playerPos = { col: start.col, row: start.row };
    
    // Initialize visual position for interpolation
    const pos = this.maze.getPlayerPosition(start.col, start.row, this.canvasSize);
    this.visualPos = { x: pos.x, y: pos.y, size: pos.size };
    this.facingAngle = 0;
    this.visualAngle = 0;

    if (!this.isLooping) {
      this.isLooping = true;
      this._loop();
    }

    if (this.onLevelChange) {
      this.onLevelChange(level);
    }
  }

  // ---- Input ----
  enableInput() {
    if (this._inputEnabled) return;
    this._inputEnabled = true;
    document.addEventListener('keydown', this._boundKeyDown);
    document.addEventListener('keyup', this._boundKeyUp);
  }

  disableInput() {
    this._inputEnabled = false;
    document.removeEventListener('keydown', this._boundKeyDown);
    document.removeEventListener('keyup', this._boundKeyUp);
    this._stopRepeat();
  }

  _handleKeyDown(e) {
    if (this.isLevelComplete || this.isGameComplete) return;

    const key = e.key;

    if (key === 'Escape') {
      e.preventDefault();
      if (this.onQuit) this.onQuit();
      return;
    }

    if (key === 'Tab') {
      e.preventDefault();
      const start = this.maze.getStartPosition();
      this.playerPos = { col: start.col, row: start.row };
      
      // Instantly reset visual position and angle
      const pos = this.maze.getPlayerPosition(start.col, start.row, this.canvasSize);
      this.visualPos.x = pos.x;
      this.visualPos.y = pos.y;
      this.facingAngle = 0;
      this.visualAngle = 0;
      return;
    }

    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

    e.preventDefault();

    // If same key already held, ignore (browser auto-repeat)
    if (this._heldKey === key) return;

    // New direction pressed — execute immediately and start repeat
    this._stopRepeat();
    this._heldKey = key;
    this._doMove(key);
    this._currentRepeatSpeed = this._repeatDelay;
    this._startRepeat(key);
  }

  _handleKeyUp(e) {
    if (e.key === this._heldKey) {
      this._stopRepeat();
      this._heldKey = null;
    }
  }

  _startRepeat(key) {
    this._repeatTimer = setTimeout(() => {
      if (this._heldKey !== key) return;
      this._doMove(key);
      // Accelerate: reduce interval each repeat
      this._currentRepeatSpeed = Math.max(
        this._repeatMin,
        Math.floor(this._currentRepeatSpeed * this._repeatAccel)
      );
      this._startRepeat(key);
    }, this._currentRepeatSpeed);
  }

  _stopRepeat() {
    if (this._repeatTimer) {
      clearTimeout(this._repeatTimer);
      this._repeatTimer = null;
    }
  }

  _doMove(key) {
    const moved = this._handleInput(key);
    if (moved) {
      if (!this.timerStarted) {
        this._startTimer();
      }
      this._checkWin();
    }
  }

  handleMobileInput(direction) {
    if (this.isLevelComplete || this.isGameComplete) return;

    const keyMap = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    this._doMove(keyMap[direction]);
  }

  // Arrow keys map directly: Up=N, Down=S, Left=W, Right=E
  _handleInput(key) {
    const { col, row } = this.playerPos;
    const dirMap = {
      ArrowUp: 'N',
      ArrowDown: 'S',
      ArrowLeft: 'W',
      ArrowRight: 'E',
    };
    const direction = dirMap[key];
    if (!direction) return false;

    // Update facing direction regardless of whether move succeeds
    const angleMap = { N: 0, E: Math.PI / 2, S: Math.PI, W: (3 * Math.PI) / 2 };
    this.facingAngle = angleMap[direction];

    if (this.maze.canMove(col, row, direction)) {
      const delta = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
      const [dc, dr] = delta[direction];
      this.playerPos = { col: col + dc, row: row + dr };
      return true;
    }
    return false;
  }

  // ---- Timer ----
  _startTimer() {
    this.timerStarted = true;
    this.timerRunning = true;
    this.startTime = performance.now();
    this.levelStartTime = performance.now();
    this._tickTimer();
  }

  _tickTimer() {
    if (!this.timerRunning) return;

    this.elapsedTime = performance.now() - this.startTime;
    if (this.onTimerUpdate) {
      this.onTimerUpdate(this.elapsedTime);
    }

    this.animFrame = requestAnimationFrame(() => this._tickTimer());
  }

  _stopTimer() {
    this.timerRunning = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  _pauseTimer() {
    this._stopTimer();
  }

  _resumeTimer() {
    if (this.timerStarted && !this.timerRunning) {
      this.timerRunning = true;
      // Adjust start time to account for pause
      this.startTime = performance.now() - this.elapsedTime;
      this._tickTimer();
    }
  }

  // ---- Win Detection ----
  _checkWin() {
    const won = this.maze.isExit(this.playerPos.col, this.playerPos.row);

    if (won) {
      this.isLevelComplete = true;
      const levelTime = performance.now() - this.levelStartTime;
      this.levelTimes.push(levelTime);

      if (this.currentLevel >= this.totalLevels) {
        // Game complete!
        this._stopTimer();
        this.isGameComplete = true;
        this.disableInput();

        // Submit score
        const totalTime = this.elapsedTime;
        window.roomManager.submitScore(
          this.roomCode,
          this.playerName,
          this.levelTimes,
          totalTime
        );

        if (this.onGameComplete) {
          this.onGameComplete(totalTime, this.levelTimes);
        }
      } else {
        // Next level
        this._pauseTimer();
        this.disableInput();

        if (this.onLevelComplete) {
          this.onLevelComplete(this.currentLevel, levelTime);
        }
      }
    }
  }

  // Called after level complete animation
  nextLevel() {
    this._loadLevel(this.currentLevel + 1);
    this.levelStartTime = performance.now();
    this._resumeTimer();
    this.enableInput();
  }

  // ---- Rendering ----
  _getColors() {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    if (theme === 'light') {
      return { wall: '#000000', bg: '#FFFFFF', player: '#FF2D2D' };
    }
    return { wall: '#FFFFFF', bg: '#000000', player: '#FF2D2D' };
  }

  _render() {
    if (!this.maze) return;
    const colors = this._getColors();

    // Render maze
    this.maze.render(this.ctx, this.canvasSize, colors);

    // Render player
    this._renderPlayer(colors);

    // Render exit marker
    this._renderExit(colors);
  }

  _loop() {
    if (!this.isLooping) return;
    requestAnimationFrame(() => this._loop());

    if (!this.maze || this.isLevelComplete || this.isGameComplete) return;

    // Target positions
    const targetPos = this.maze.getPlayerPosition(this.playerPos.col, this.playerPos.row, this.canvasSize);
    
    // Lerp position (0.4 = speed, higher is faster)
    this.visualPos.x += (targetPos.x - this.visualPos.x) * 0.4;
    this.visualPos.y += (targetPos.y - this.visualPos.y) * 0.4;
    this.visualPos.size = targetPos.size;

    // Lerp angle (handle shortest path around 360)
    let diff = this.facingAngle - this.visualAngle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.visualAngle += diff * 0.4;

    this._render();
  }

  _renderPlayer(colors) {
    if (!this.visualPos) return;
    const { x, y, size } = this.visualPos;

    this.ctx.save();
    this.ctx.fillStyle = colors.player;

    // Translate to visual center, rotate to visual angle
    this.ctx.translate(x, y);
    this.ctx.rotate(this.visualAngle);

    // Draw triangle pointing UP (rotation handles direction)
    this.ctx.beginPath();
    this.ctx.moveTo(0, -size);                   // tip
    this.ctx.lineTo(-size * 0.8, size * 0.6);    // bottom-left
    this.ctx.lineTo(size * 0.8, size * 0.6);     // bottom-right
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  _renderExit(colors) {
    // Exit is indicated by the opening in the wall — no extra marker needed
    // The gap in the outer wall is the visual cue
  }

  // Force re-render (for theme changes)
  refresh() {
    if (this.maze) this._render();
  }

  // ---- Cleanup ----
  destroy() {
    this.disableInput();
    this._stopTimer();
    this._stopRepeat();
    this.isLooping = false;
    window.removeEventListener('resize', this._resizeCanvas);
  }
}

// ---- Timer Formatting ----
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);

  return (
    String(minutes).padStart(2, '0') +
    '.' +
    String(seconds).padStart(2, '0') +
    '.' +
    String(centiseconds).padStart(2, '0')
  );
}

window.GameEngine = GameEngine;
window.formatTime = formatTime;
