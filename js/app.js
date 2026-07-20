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
    host: document.getElementById('screen-host'),
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

  // Host dashboard
  const hostRoomCode = document.getElementById('host-room-code');
  const hostLeaderboardBody = document.getElementById('host-leaderboard-body');
  const btnHostBack = document.getElementById('btn-host-back');
  const btnHostStart = document.getElementById('btn-host-start');

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
  const sidebarPlayerList = document.getElementById('sidebar-player-list');

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

  // ---- Utility ----
  function formatTime(ms) {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${String(minutes).padStart(2, '0')}.${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
  }

  // ---- Login Screen ----
  function initLogin() {
    const session = window.roomManager.getSession();
    if (session) {
      currentPlayerName = session.playerName;
      currentRoomCode = session.roomCode;
    }

    const savedName = localStorage.getItem('maze_io_username');
    if (savedName) {
      usernameInput.value = savedName;
    }

    roomCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        attemptJoin();
      }
    });

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
    
    // Non-host players wait for the host to start the game
    waitForGameStart();
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

    // Listen for new players joining (update the count live)
    window.roomManager.on('player_joined', (data) => {
      if (data.code === currentRoomCode) {
        playerCountDisplay.textContent = `${data.playerCount} PLAYER(S) JOINED`;
      }
    });

    window.roomManager.on('player_left', (data) => {
      if (data.code === currentRoomCode) {
        playerCountDisplay.textContent = `${data.playerCount} PLAYER(S) JOINED`;
      }
    });
  }

  // ---- Wait for host to start (non-host players) ----
  function waitForGameStart() {
    showScreen('createRoom');
    roomCodeDisplay.textContent = currentRoomCode;
    const room = window.roomManager.getRoomState();
    const count = room ? room.players.length : 1;
    playerCountDisplay.textContent = `${count} PLAYER(S) JOINED`;

    // Hide the start button for non-hosts
    startGameBtn.style.display = 'none';

    // Listen for host starting the game
    const onGameStarted = (data) => {
      window.roomManager.off('game_started', onGameStarted);
      startGameBtn.style.display = ''; // restore for next time
      startGame(data ? data.gameSeed : null);
    };
    window.roomManager.on('game_started', onGameStarted);

    // Keep player count live
    window.roomManager.on('player_joined', (data) => {
      if (data.code === currentRoomCode) {
        playerCountDisplay.textContent = `${data.playerCount} PLAYER(S) JOINED`;
      }
    });
  }

  // ---- Game Flow ----
  function startGame(providedGameSeed = null) {
    showScreen('game');
    loggedInAs.textContent = `LOGGED IN AS ${currentPlayerName.toUpperCase()}`;
    timerDisplay.textContent = '00.00.00';
    levelDisplay.textContent = 'LEVEL 1';

    if ('ontouchstart' in window) {
      mobileControls.style.display = 'flex';
    }

    // Get the unique game seed. If provided via event, use that, else check room cache, else fallback to room code.
    const roomState = window.roomManager.getRoomState();
    let gameSeed = providedGameSeed;
    if (!gameSeed) {
      gameSeed = (roomState && roomState.gameSeed) ? roomState.gameSeed : currentRoomCode;
    }

    // Create game engine
    gameEngine = new GameEngine(mazeCanvas, currentPlayerName, gameSeed, currentRoomCode);

    let lastSyncTime = 0;
    gameEngine.onTimerUpdate = (elapsed) => {
      timerDisplay.textContent = formatTime(elapsed);
      
      const now = Date.now();
      if (now - lastSyncTime > 1000) {
        lastSyncTime = now;
        window.roomManager.syncTime(elapsed, gameEngine.currentLevel);
      }
    };

    gameEngine.onLevelChange = (level) => {
      levelDisplay.textContent = `LEVEL ${level}`;
      window.roomManager.sendLevelUpdate(level);
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

    // Send initial level update
    window.roomManager.sendLevelUpdate(1);

    // Update sidebar with players
    updateSidebar();
    window.roomManager.on('room_state_update', updateSidebar);

    // Countdown before enabling input
    runCountdown(() => {
      gameEngine.enableInput();
    });
  }

  // ---- Players Sidebar ----
  function updateSidebar() {
    const room = window.roomManager.getRoomState();
    if (!room || !sidebarPlayerList) return;

    sidebarPlayerList.innerHTML = '';
    room.players.forEach((p) => {
      const li = document.createElement('li');
      const isYou = p.name === currentPlayerName;
      const level = room.playerLevels ? room.playerLevels[p.name] : null;
      const score = room.scores ? room.scores[p.name] : null;

      let statusText = 'WAITING';
      if (score) {
        statusText = formatTime(score.totalTime);
        li.classList.add('is-finished');
      } else if (level === 'finished') {
        statusText = 'DONE';
        li.classList.add('is-finished');
      } else if (typeof level === 'number') {
        statusText = `LVL ${level}`;
      }

      if (isYou) li.classList.add('is-you');

      li.innerHTML = `
        <span>${p.name.toUpperCase()}</span>
        <span class="player-status">${statusText}</span>
      `;
      sidebarPlayerList.appendChild(li);
    });
  }

  function runCountdown(callback) {
    countdownOverlay.classList.add('active');
    let count = 3;

    function tick() {
      if (count > 0) {
        countdownNumber.textContent = count;
        countdownNumber.style.animation = 'none';
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

    // Clean up sidebar listener
    window.roomManager.off('room_state_update', updateSidebar);

    setTimeout(() => {
      levelOverlay.classList.remove('active');
      showLeaderboard();
    }, 2500);
  }

  // ---- Leaderboard ----
  function showLeaderboard() {
    showScreen('leaderboard');

    // Fetch fresh room state before rendering
    window.roomManager.fetchRoomState(currentRoomCode);

    // Small delay to let the fresh state arrive, then render
    setTimeout(renderLeaderboard, 300);

    // Listen for further score updates
    const onScoreUpdate = () => {
      renderLeaderboard();
    };
    window.roomManager.on('room_state_update', onScoreUpdate);

    // If host starts a new game while we are on the leaderboard
    const onGameRestart = (data) => {
      window.roomManager.off('room_state_update', onScoreUpdate);
      window.roomManager.off('game_started', onGameRestart);
      startGame(data ? data.gameSeed : null);
    };
    window.roomManager.on('game_started', onGameRestart);
  }

  function renderLeaderboard() {
    const entries = window.roomManager.getLeaderboard();
    leaderboardBody.innerHTML = '';

    if (entries.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="3" style="text-align:center; opacity:0.5;">NO SCORES YET</td>`;
      leaderboardBody.appendChild(row);
    } else {
      entries.forEach((entry, idx) => {
        const row = document.createElement('tr');
        if (idx < 3) {
          row.classList.add(`rank-${idx + 1}`);
        }
        row.innerHTML = `
          <td>${idx + 1}</td>
          <td>${entry.name}</td>
          <td>${formatTime(entry.totalTime)}</td>
        `;
        if (entry.name === currentPlayerName) {
          row.classList.add('is-you');
        }
        leaderboardBody.appendChild(row);
      });
    }

    leaderboardRoomCode.textContent = `ROOM CODE: ${currentRoomCode}`;
  }

  // ---- Host Dashboard ----
  function showHostDashboard() {
    showScreen('host');
    hostRoomCode.textContent = `ROOM: ${currentRoomCode}`;
    renderHostLeaderboard();

    // Listen for live updates
    window.roomManager.on('room_state_update', renderHostLeaderboard);
    window.roomManager.on('score_update', renderHostLeaderboard);
  }

  function renderHostLeaderboard() {
    const room = window.roomManager.getRoomState();
    if (!room || !hostLeaderboardBody) return;

    hostLeaderboardBody.innerHTML = '';

    // Build a combined list: all players
    const players = room.players.map((p) => {
      const score = room.scores ? room.scores[p.name] : null;
      const level = room.playerLevels ? room.playerLevels[p.name] : null;
      
      let liveLevel = p.liveLevel || 1;
      let liveTime = p.liveTime || 0;
      let avgTime = liveTime > 0 ? liveTime / liveLevel : 0;
      
      if (score) {
        avgTime = score.totalTime / (score.levelTimes ? score.levelTimes.length : 1);
      }
      
      return { 
        name: p.name, 
        score, 
        level, 
        dnf: p.dnf,
        liveTime,
        liveLevel,
        avgTime
      };
    });

    // Sort: 
    // 1. Finished players (by totalTime asc)
    // 2. Active players (by liveLevel desc, then avgTime asc)
    // 3. DNF players at bottom
    players.sort((a, b) => {
      if (a.dnf && !b.dnf) return 1;
      if (!a.dnf && b.dnf) return -1;
      
      if (a.score && b.score) return a.score.totalTime - b.score.totalTime;
      if (a.score) return -1;
      if (b.score) return 1;
      
      if (a.liveLevel !== b.liveLevel) {
        return b.liveLevel - a.liveLevel;
      }
      
      return a.avgTime - b.avgTime;
    });

    let rank = 0;
    players.forEach((p) => {
      const row = document.createElement('tr');
      let statusText = 'WAITING';
      let timeText = '--';
      let avgText = '--';
      let rankText = '--';

      if (p.dnf) {
        statusText = 'DNF';
        row.style.color = 'var(--accent)';
      } else if (p.score || p.level === 'finished') {
        rank++;
        rankText = rank;
        statusText = 'FINISHED';
        timeText = formatTime(p.score ? p.score.totalTime : 0);
        avgText = formatTime(p.avgTime);
        row.style.color = '#22c55e';
      } else if (room.state === 'playing') {
        rank++;
        rankText = rank;
        statusText = `LEVEL ${p.liveLevel}`;
        timeText = formatTime(p.liveTime);
        avgText = formatTime(p.avgTime);
      }

      if (p.name === currentPlayerName) {
        row.classList.add('is-you');
      }

      if (rank > 0 && rank <= 3 && !p.dnf) {
        row.classList.add(`rank-${rank}`);
      }

      row.innerHTML = `
        <td>${rankText}</td>
        <td>${p.name.toUpperCase()}</td>
        <td>${statusText}</td>
        <td>${avgText}</td>
        <td>${timeText}</td>
      `;
      hostLeaderboardBody.appendChild(row);
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
      if (window.roomManager.isHost) {
        // Host: broadcast start to all players, then go to host dashboard
        window.roomManager.startGame();
        showHostDashboard();
      } else {
        startGame();
      }
    });

    backToLoginBtn.addEventListener('click', () => {
      if (currentRoomCode) {
        window.roomManager.leaveRoom(currentRoomCode, currentPlayerName);
        currentRoomCode = '';
      }
      startGameBtn.style.display = ''; // restore visibility
      showScreen('login');
    });
  }

  // ---- Host Dashboard Buttons ----
  function initHostDashboard() {
    btnHostStart.addEventListener('click', () => {
      window.roomManager.startGame();
    });

    btnHostBack.addEventListener('click', () => {
      window.roomManager.off('room_state_update', renderHostLeaderboard);
      window.roomManager.off('score_update', renderHostLeaderboard);
      if (currentRoomCode) {
        window.roomManager.leaveRoom(currentRoomCode, currentPlayerName);
        currentRoomCode = '';
      }
      showScreen('login');
    });
  }

  // ---- Play Again ----
  function initLeaderboard() {
    playAgainBtn.addEventListener('click', () => {
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
    initHostDashboard();
    initMobileControls();
    initLeaderboard();

    themeToggles.forEach((toggle) => {
      toggle.addEventListener('click', toggleTheme);
    });

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
