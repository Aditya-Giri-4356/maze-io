/* ============================================================
   MAZE.IO — Room Management (WebSocket Client)
   Connects to server.js WebSocket for real-time multiplayer
   ============================================================ */

const SESSION_KEY = 'maze_io_session';

class RoomManager {
  constructor() {
    this.ws = null;
    this._listeners = {};
    this.connected = false;
    this.cachedRoomState = null;
    this._initWebSocket();
  }

  _initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.ws = new WebSocket(`${protocol}//${host}`);

    this.ws.onopen = () => {
      console.log('Connected to WebSocket server');
      this.connected = true;
      this._emit('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'room_created' || msg.type === 'room_joined' || msg.type === 'room_state') {
          this.cachedRoomState = msg.data.room;
        }
        this._emit(msg.type, msg.data);
      } catch (err) {
        console.error('WebSocket message parsing error:', err);
      }
    };

    this.ws.onclose = () => {
      console.log('Disconnected from WebSocket server');
      this.connected = false;
      this._emit('disconnected');
      // Attempt reconnect after 3 seconds
      setTimeout(() => this._initWebSocket(), 3000);
    };
  }

  // ---- Event System ----
  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter((cb) => cb !== callback);
  }

  _emit(event, data) {
    if (!this._listeners[event]) return;
    this._listeners[event].forEach((cb) => cb(data));
  }

  _send(type, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    }
  }

  // ---- Public API (Async) ----
  // Since WebSockets are asynchronous, we return Promises for actions that need a server response

  createRoom(playerName) {
    return new Promise((resolve, reject) => {
      if (!this.connected) return reject('Not connected to server');

      const onCreated = (data) => {
        this.off('room_created', onCreated);
        this._setSession(playerName, data.room.code);
        resolve(data.room);
      };

      this.on('room_created', onCreated);
      this._send('create_room', { playerName, totalLevels: window.MazeEngine ? window.MazeEngine.TOTAL_LEVELS : 5 });
    });
  }

  joinRoom(code, playerName) {
    return new Promise((resolve, reject) => {
      if (!this.connected) return resolve({ success: false, error: 'Not connected to server' });

      const onJoined = (data) => {
        this.off('room_joined', onJoined);
        this.off('join_error', onError);
        this._setSession(playerName, data.room.code);
        resolve({ success: true, room: data.room });
      };

      const onError = (data) => {
        this.off('room_joined', onJoined);
        this.off('join_error', onError);
        resolve({ success: false, error: data.error });
      };

      this.on('room_joined', onJoined);
      this.on('join_error', onError);

      this._send('join_room', { code, playerName });
    });
  }

  leaveRoom(code, playerName) {
    this._send('leave_room', { code, playerName });
    this.clearSession();
    this.cachedRoomState = null;
  }

  submitScore(code, playerName, levelTimes, totalTime) {
    this._send('submit_score', { code, playerName, levelTimes, totalTime });
  }

  // Because getLeaderboard, getRoomState, etc. were synchronous in app.js, 
  // we either rely on cachedRoomState or refactor app.js. 
  // For simplicity, we cache the room state and return it synchronously.
  
  fetchRoomState(code) {
    this._send('get_room_state', { code });
  }

  getRoomState() {
    return this.cachedRoomState;
  }

  getLeaderboard() {
    const room = this.cachedRoomState;
    if (!room || !room.scores) return [];

    const entries = Object.entries(room.scores)
      .map(([name, data]) => ({
        name,
        totalTime: data.totalTime,
        levelTimes: data.levelTimes,
        completedAt: data.completedAt,
      }))
      .sort((a, b) => a.totalTime - b.totalTime);

    return entries;
  }

  getPlayerCount() {
    const room = this.cachedRoomState;
    return room && room.players ? room.players.length : 0;
  }

  // ---- Session Management ----
  _setSession(playerName, roomCode) {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ playerName, roomCode: roomCode.toUpperCase() })
    );
  }

  getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY));
    } catch {
      return null;
    }
  }

  clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  destroy() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._listeners = {};
  }
}

// Global instance
window.roomManager = new RoomManager();
