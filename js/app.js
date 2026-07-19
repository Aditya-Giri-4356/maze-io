/* ============================================================
   MAZE.IO — App Controller
   Screen management, form handling, game flow orchestration
   ============================================================ */

(function () {
  'use strict';

  // ---- DOM Elements ----
  const screens = {
    login: document.getElementById('screen-login'),
    createRoom: document.getElementById('screen-create-room'),
    game: document.getElementById('screen-game'),
    leaderboard: document.getElementById('screen-leaderboard'),
  };

  // Login
  const usernameInput = document.getElementById('username-input');
  const roomCodeInput = document.getElementById('room-code-input');
  const createRoomLink = document.getElementById('create-room-link');
  const joinError = document.getElementById('join-error');

  // Room creation
  const roomCodeDisplay = document.getElementById('room-code-value');
  const playerCountDisplay = document.getElementById('player-count');
  const startGameBtn = document.getElementById('btn-start-game');
  const backToLoginBtn = document.getElementById('btn-back-login');

  // Game
  const mazeCanvas = document.getElementById('maze-canvas');
  const levelDisplay = document.getElementById('level-display');
  const timerDisplay = document.getElementById('timer-display');
  const loggedInAs = document.getElementById('logged-in-as');
  const levelOverlay = document.getElementById('level-overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayTime = document.getElementById('overlay-time');
  const overlaySubtitle = document.getElementById('overlay-subtitle');
  const countdownOverlay = document.getElementById('countdown-overlay');
  const countdownNumber = document.getElementById('countdown-number');

  // Leaderboard
  const leaderboardBody = document.getElementById('leaderboard-body');
  const leaderboardRoomCode = document.getElementById('leaderboard-room-code');
  const playAgainBtn = document.getElementById('btn-play-again');

  // Theme toggles
  const themeToggles = document.querySelectorAll('.theme-toggle');

  // Mobile controls
  const mobileControls = document.getElementById('mobile-controls');

  // ---- State ----
  let gameEngine = null;
  let currentRoomCode = '';
  let currentPlayerName = '';

  // ---- Screen Management ----
  function showScreen(name) {
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        Object.values(screens).forEach((s) => s.classList.remove('active'));
        if (screens[name]) {
          screens[name].classList.add('active');
        }
      });
    } else {
      // Fallback for browsers that don't support View Transitions
      Object.values(screens).forEach((s) => s.classList.remove('active'));
      if (screens[name]) {
        screens[name].classList.add('active');
      }
    }
  }

  // ---- Theme Toggle ----
  function initTheme() {
    const saved = localStorage.getItem('maze_io_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcons(saved);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('maze_io_theme', next);
    updateThemeIcons(next);

    // Refresh game canvas if active
    if (gameEngine) {
      gameEngine.refresh();
    }
  }

  function updateThemeIcons(theme) {
    const moonSVG = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M21.752 15.002A9.718 9.718 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"/></svg>`;
    const sunSVG = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0Zm11.394-5.834a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59Zm-14.788 0a.75.75 0 0 0 1.06-1.06l1.591 1.59a.75.75 0 1 0-1.06 1.061L4.106 6.166ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18Zm4.834-.606a.75.75 0 0 0 0 1.06l1.59 1.591a.75.75 0 1 0 1.061-1.06l-1.59-1.591a.75.75 0 0 0-1.06 0Zm-9.668 0a.75.75 0 0 0 0 1.06l-1.59 1.591a.75.75 0 1 0-1.061-1.06l1.59-1.591a.75.75 0 0 0 1.06 0ZM3 12a.75.75 0 0 1 .75-.75H6a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Z"/></svg>`;

    themeToggles.forEach((toggle) => {
      toggle.innerHTML = theme === 'dark' ? moonSVG : sunSVG;
    });
  }

  // ---- Login Screen ----
  function initLogin() {
    // Check for existing session
    const session = window.roomManager.getSession();
    if (session) {
      currentPlayerName = session.playerName;
      currentRoomCode = session.roomCode;
    }

    // Prepopulate username if previously saved
    const savedName = localStorage.getItem('maze_io_username');
    if (savedName) {
      usernameInput.value = savedName;
    }

    // Join room on Enter in code input
    roomCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        attemptJoin();
      }
    });

    // Also allow Enter on username field to focus code field
    usernameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (roomCodeInput.value.trim()) {
          attemptJoin();
        } else {
          roomCodeInput.focus();
        }
      }
    });

    // Create room link
    createRoomLink.addEventListener('click', (e) => {
      e.preventDefault();
      const name = usernameInput.value.trim();
      if (!name) {
        showError('Enter your name first!');
        usernameInput.focus();
        return;
      }
      if (!validateName(name)) {
        showError('Name must be 2-16 alphanumeric characters!');
        usernameInput.focus();
        return;
      }
      createRoom(name);
    });
  }

  function validateName(name) {
    return /^[a-zA-Z0-9_]{2,16}$/.test(name);
  }

  function showError(msg) {
    joinError.textContent = msg;
    joinError.style.display = 'block';
    setTimeout(() => {
      joinError.style.display = 'none';
    }, 3000);
  }

  async function attemptJoin() {
    const name = usernameInput.value.trim();
    const code = roomCodeInput.value.trim().toUpperCase();

    if (!name) {
      showError('Enter your name first!');
      usernameInput.focus();
      return;
    }
    if (!validateName(name)) {
      showError('Name must be 2-16 alphanumeric characters!');
      usernameInput.focus();
      return;
    }
    if (!code) {
      showError('Enter a room code!');
      roomCodeInput.focus();
      return;
    }

    const result = await window.roomManager.joinRoom(code, name);
    if (!result.success) {
      showError(result.error);
      return;
    }

    localStorage.setItem('maze_io_username', name);
    currentPlayerName = name;
    currentRoomCode = code;
    startGame();
  }

  // ---- Room Creation ----
  async function createRoom(name) {
    const room = await window.roomManager.createRoom(name);
    localStorage.setItem('maze_io_username', name);
    currentPlayerName = name;
    currentRoomCode = room.code;

    roomCodeDisplay.textContent = room.code;
    playerCountDisplay.textContent = `${room.players.length} PLAYER(S) JOINED`;

    showScreen('createRoom');

    // Listen for new players joining
    window.roomManager.on('player_joined', (data) => {
      if (data.code === currentRoomCode) {
        const count = window.roomManager.getPlayerCount(currentRoomCode);
        playerCountDisplay.textContent = `${count} PLAYER(S) JOINED`;
      }
    });
  }

  // ---- Game Flow ----
  function startGame() {
    showScreen('game');
    loggedInAs.textContent = `LOGGED IN AS ${currentPlayerName.toUpperCase()}`;
    timerDisplay.textContent = '00.00.00';
    levelDisplay.textContent = 'LEVEL 1';

    // Show mobile controls on touch devices
    if ('ontouchstart' in window) {
      mobileControls.style.display = 'flex';
    }

    // Create game engine
    gameEngine = new GameEngine(mazeCanvas, currentPlayerName, currentRoomCode);

    gameEngine.onTimerUpdate = (elapsed) => {
      timerDisplay.textContent = formatTime(elapsed);
    };

    gameEngine.onLevelChange = (level) => {
      levelDisplay.textContent = `LEVEL ${level}`;
    };

    gameEngine.onLevelComplete = (level, levelTime) => {
      showLevelComplete(level, levelTime);
    };

    gameEngine.onGameComplete = (totalTime, levelTimes) => {
      showGameComplete(totalTime, levelTimes);
    };

    gameEngine.onQuit = () => {
      gameEngine.destroy();
      gameEngine = null;
      if (currentRoomCode) {
        window.roomManager.leaveRoom(currentRoomCode, currentPlayerName);
        currentRoomCode = '';
      }
      showScreen('login');
    };

    gameEngine.init();

    // Countdown before enabling input
    runCountdown(() => {
      gameEngine.enableInput();
    });
  }

  function runCountdown(callback) {
    countdownOverlay.classList.add('active');
    let count = 3;

    function tick() {
      if (count > 0) {
        countdownNumber.textContent = count;
        countdownNumber.style.animation = 'none';
        // Force reflow
        void countdownNumber.offsetWidth;
        countdownNumber.style.animation = 'countdownPulse 0.8s ease';
        count--;
        setTimeout(tick, 900);
      } else {
        countdownNumber.textContent = 'GO!';
        countdownNumber.style.animation = 'none';
        void countdownNumber.offsetWidth;
        countdownNumber.style.animation = 'countdownPulse 0.6s ease';
        setTimeout(() => {
          countdownOverlay.classList.remove('active');
          callback();
        }, 700);
      }
    }

    tick();
  }

  function showLevelComplete(level, levelTime) {
    overlayTitle.textContent = `LEVEL ${level} COMPLETE`;
    overlayTime.textContent = formatTime(levelTime);
    overlaySubtitle.textContent = 'NEXT LEVEL IN 3...';
    levelOverlay.classList.add('active');

    let count = 3;
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        overlaySubtitle.textContent = `NEXT LEVEL IN ${count}...`;
      } else {
        clearInterval(interval);
        levelOverlay.classList.remove('active');
        gameEngine.nextLevel();
      }
    }, 1000);
  }

  function showGameComplete(totalTime, levelTimes) {
    overlayTitle.textContent = 'MAZE CONQUERED!';
    overlayTime.textContent = formatTime(totalTime);
    overlaySubtitle.textContent = 'LOADING LEADERBOARD...';
    levelOverlay.classList.add('active');

    setTimeout(() => {
      levelOverlay.classList.remove('active');
      showLeaderboard();
    }, 2500);
  }

  // ---- Leaderboard ----
  function showLeaderboard() {
    showScreen('leaderboard');

    const entries = window.roomManager.getLeaderboard(currentRoomCode);
    leaderboardBody.innerHTML = '';

    if (entries.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="3" style="text-align:center; opacity:0.5;">NO SCORES YET</td>`;
      leaderboardBody.appendChild(row);
    } else {
      entries.forEach((entry, idx) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${idx + 1}</td>
          <td>${entry.name}</td>
          <td>${formatTime(entry.totalTime)}</td>
        `;
        if (entry.name === currentPlayerName) {
          row.style.color = 'var(--accent)';
        }
        leaderboardBody.appendChild(row);
      });
    }

    leaderboardRoomCode.textContent = `ROOM CODE: ${currentRoomCode}`;

    // Listen for new scores
    window.roomManager.on('score_update', (data) => {
      if (data.code === currentRoomCode) {
        // Refresh leaderboard
        showLeaderboard();
      }
    });
  }

  // ---- Mobile Controls ----
  function initMobileControls() {
    if (!mobileControls) return;

    const buttons = mobileControls.querySelectorAll('button');
    buttons.forEach((btn) => {
      const dir = btn.dataset.direction;
      if (!dir) return;

      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameEngine) gameEngine.handleMobileInput(dir);
      });

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (gameEngine) gameEngine.handleMobileInput(dir);
      });
    });
  }

  // ---- Start Game Button (Room Creation) ----
  function initRoomCreation() {
    startGameBtn.addEventListener('click', () => {
      startGame();
    });

    backToLoginBtn.addEventListener('click', () => {
      showScreen('login');
    });
  }

  // ---- Play Again ----
  function initLeaderboard() {
    playAgainBtn.addEventListener('click', () => {
      // Clean up old game
      if (gameEngine) {
        gameEngine.destroy();
        gameEngine = null;
      }
      window.roomManager.clearSession();
      currentPlayerName = '';
      currentRoomCode = '';
      showScreen('login');
      usernameInput.value = '';
      roomCodeInput.value = '';
    });
  }

  // ---- Initialize App ----
  function init() {
    initTheme();
    initLogin();
    initRoomCreation();
    initMobileControls();
    initLeaderboard();

    // Theme toggle for all instances
    themeToggles.forEach((toggle) => {
      toggle.addEventListener('click', toggleTheme);
    });

    // Start on login screen
    showScreen('login');
    usernameInput.focus();
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
