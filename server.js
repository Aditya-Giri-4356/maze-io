const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Serve static files from the current directory
app.use(express.static(path.join(__dirname, '')));

// In-memory room store
const rooms = {};

// Helper: Generate a unique room code
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms[code]);
  return code;
}

// Helper: Generate a random room seed
function generateSeed() {
  return Math.floor(Math.random() * 2147483647).toString(36);
}

// Broadcast message to all connected clients in a specific room
function broadcastToRoom(code, type, data) {
  const room = rooms[code];
  if (!room) return;
  room.clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({ type, data }));
    }
  });
}

// Broadcast the full room state (scores, players, levels) to everyone in the room
function broadcastRoomState(code) {
  const room = rooms[code];
  if (!room) return;
  const safeRoom = getSafeRoom(room);
  room.clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({ type: 'room_state_update', data: { room: safeRoom } }));
    }
  });
}

// Helper: Strip out the raw WebSocket clients before sending room state to frontend
function getSafeRoom(room) {
  const { clients, ...safeRoom } = room;
  return safeRoom;
}

// When a new WebSocket connection is established
wss.on('connection', (ws) => {
  let currentRoomCode = null;
  let currentPlayerName = null;

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      const { type, data } = msg;

      if (type === 'create_room') {
        const { playerName, totalLevels } = data;
        const code = generateCode();

        const newRoom = {
          code,
          seed: generateSeed(),
          hostName: playerName,
          players: [{ name: playerName, joinedAt: Date.now() }],
          scores: {},
          playerLevels: {},   // track each player's current level
          totalLevels: totalLevels || 5,
          createdAt: Date.now(),
          status: 'waiting',
          clients: new Set([{ ws, playerName }])
        };

        rooms[code] = newRoom;
        currentRoomCode = code;
        currentPlayerName = playerName;

        ws.send(JSON.stringify({ type: 'room_created', data: { room: getSafeRoom(newRoom) } }));
        broadcastToRoom(code, 'player_joined', { code, playerName, playerCount: newRoom.players.length });
      } 
      
      else if (type === 'join_room') {
        const { code, playerName } = data;
        const upperCode = code.toUpperCase();
        const room = rooms[upperCode];

        if (!room) {
          ws.send(JSON.stringify({ type: 'join_error', data: { error: 'Room not found. Check your code!' } }));
          return;
        }

        if (room.players.some((p) => p.name.toLowerCase() === playerName.toLowerCase())) {
          ws.send(JSON.stringify({ type: 'join_error', data: { error: 'Name already taken in this room!' } }));
          return;
        }

        if (room.players.length >= 40) {
          ws.send(JSON.stringify({ type: 'join_error', data: { error: 'Room is full! (max 40 players)' } }));
          return;
        }

        room.players.push({ name: playerName, joinedAt: Date.now() });
        room.clients.add({ ws, playerName });
        currentRoomCode = upperCode;
        currentPlayerName = playerName;

        ws.send(JSON.stringify({ type: 'room_joined', data: { room: getSafeRoom(room) } }));
        broadcastToRoom(upperCode, 'player_joined', { code: upperCode, playerName, playerCount: room.players.length });
        broadcastRoomState(upperCode);
      } 
      
      else if (type === 'leave_room') {
        leaveCurrentRoom();
      } 

      else if (type === 'start_game') {
        // Host signals all players to start the game
        if (!currentRoomCode) return;
        const room = rooms[currentRoomCode];
        if (!room) return;
        if (room.hostName !== currentPlayerName) return; // only host can start
        
        room.state = 'playing';
        room.scores = {};
        room.playerLevels = {};
        room.players.forEach(p => {
          delete p.dnf;
          delete p.liveTime;
          delete p.liveLevel;
        });

        // Generate a random seed for this specific game session so it's unique each game, 
        // but identical for everyone in the room.
        room.gameSeed = Math.random().toString(36).substring(2, 10);
        
        broadcastToRoom(currentRoomCode, 'game_started', { code: currentRoomCode, gameSeed: room.gameSeed });
        broadcastRoomState(currentRoomCode);
      }

      else if (type === 'level_update') {
        // A player broadcasts what level they are currently on
        if (!currentRoomCode || !currentPlayerName) return;
        const room = rooms[currentRoomCode];
        if (!room) return;

        room.playerLevels[currentPlayerName] = data.level;
        broadcastRoomState(currentRoomCode);
      }
      
      else if (type === 'submit_score') {
        if (!currentRoomCode || !currentPlayerName) return;
        const { levelTimes, totalTime } = data;
        const room = rooms[currentRoomCode];
        
        if (room) {
          room.scores[currentPlayerName] = {
            levelTimes,
            totalTime,
            completedAt: Date.now()
          };
          room.playerLevels[currentPlayerName] = 'finished';

          // Broadcast full room state so everyone can rebuild leaderboard
          broadcastToRoom(currentRoomCode, 'score_update', { 
            code: currentRoomCode, 
            playerName: currentPlayerName, 
            totalTime 
          });
          broadcastRoomState(currentRoomCode);
        }
      }
      
      else if (type === 'sync_time') {
        if (!currentRoomCode || !currentPlayerName) return;
        const room = rooms[currentRoomCode];
        if (!room) return;
        
        const p = room.players.find(player => player.name === currentPlayerName);
        if (p) {
          p.liveTime = data.elapsedTime;
          p.liveLevel = data.level;
          // We don't broadcast immediately to save bandwidth, it will be pulled on the next state update,
          // OR we can broadcastRoomState here. Wait, doing this every second for 40 players is a lot.
          // Let's just update the state. The host can poll the state or we broadcast periodically.
          // Wait! Host dashboard only re-renders on 'room_state_update' or 'score_update'.
          // We should just broadcastRoomState here so the host dashboard gets it.
          // 40 players * 1 msg/sec is 40 msgs/sec in Node, which is nothing. 
          // But it multiplies by 40 clients (1600 msgs/sec). That might stutter local network.
          // Actually, we'll just let the host request state, OR we throttle broadcastRoomState.
          // Let's just broadcastRoomState, it's fine for a small game.
          broadcastRoomState(currentRoomCode);
        }
      }
      
      else if (type === 'get_room_state') {
        const { code } = data;
        const room = rooms[code ? code.toUpperCase() : ''];
        if (room) {
          ws.send(JSON.stringify({ type: 'room_state', data: { room: getSafeRoom(room) } }));
        }
      }

    } catch (err) {
      console.error('WebSocket message parsing error:', err);
    }
  });

  ws.on('close', () => {
    leaveCurrentRoom();
  });

  function leaveCurrentRoom() {
    if (!currentRoomCode || !currentPlayerName) return;
    const room = rooms[currentRoomCode];
    if (room) {
      if (room.state === 'playing') {
        // If the game started, keep them in the roster but mark as DNF
        const p = room.players.find(player => player.name === currentPlayerName);
        if (p && !room.scores[currentPlayerName]) {
          p.dnf = true;
        }
      } else {
        // If in waiting room, remove them completely
        room.players = room.players.filter(p => p.name !== currentPlayerName);
      }
      
      for (let client of room.clients) {
        if (client.ws === ws || client.playerName === currentPlayerName) {
          room.clients.delete(client);
        }
      }
      
      broadcastToRoom(currentRoomCode, 'player_left', { code: currentRoomCode, playerName: currentPlayerName, playerCount: room.players.length });
      broadcastRoomState(currentRoomCode);
      
      // If no clients left, delete the room
      if (room.clients.size === 0) {
        delete rooms[currentRoomCode];
      }
    }
    currentRoomCode = null;
    currentPlayerName = null;
  }
});

// Cleanup old rooms periodically
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000;
  for (const code in rooms) {
    if (now - rooms[code].createdAt > maxAge) {
      delete rooms[code];
    }
  }
}, 60 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`MAZE.IO Server is running on http://localhost:${PORT}`);
});
