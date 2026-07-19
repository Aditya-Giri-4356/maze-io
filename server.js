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

// When a new WebSocket connection is established
wss.on('connection', (ws) => {
  // Store the current room and player name for this socket to handle disconnects
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
          totalLevels: totalLevels || 5,
          createdAt: Date.now(),
          status: 'waiting',
          clients: new Set([{ ws, playerName }])
        };

        rooms[code] = newRoom;
        currentRoomCode = code;
        currentPlayerName = playerName;

        ws.send(JSON.stringify({ type: 'room_created', data: { room: getSafeRoom(newRoom) } }));
        broadcastToRoom(code, 'player_joined', { code, playerName });
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
        broadcastToRoom(upperCode, 'player_joined', { code: upperCode, playerName });
      } 
      
      else if (type === 'leave_room') {
        leaveCurrentRoom();
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
          // Broadcast to everyone in the room that a score was updated
          broadcastToRoom(currentRoomCode, 'score_update', { 
            code: currentRoomCode, 
            playerName: currentPlayerName, 
            totalTime 
          });
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
      // Remove player
      room.players = room.players.filter(p => p.name !== currentPlayerName);
      // Remove client socket
      for (let client of room.clients) {
        if (client.ws === ws || client.playerName === currentPlayerName) {
          room.clients.delete(client);
        }
      }
      
      broadcastToRoom(currentRoomCode, 'player_left', { code: currentRoomCode, playerName: currentPlayerName });
      
      // If room is empty, delete it
      if (room.players.length === 0) {
        delete rooms[currentRoomCode];
      }
    }
    currentRoomCode = null;
    currentPlayerName = null;
  }
});

// Helper: Strip out the raw WebSocket clients before sending room state to frontend
function getSafeRoom(room) {
  const { clients, ...safeRoom } = room;
  return safeRoom;
}

// Cleanup old rooms periodically (e.g. every hour)
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
