# MAZE.IO 🟦🟥

Welcome to **MAZE.IO**, a sleek, real-time multiplayer maze racing game where you can compete against up to 40 friends simultaneously to see who can navigate complex, procedurally generated mazes the fastest!

---

## 🎮 How to Play (The Rules)

The goal of the game is simple: **Be the fastest player to complete all 5 maze levels.**

1. **Create or Join a Room:** Enter your username and either create a new room or join an existing one using a 5-letter Room Code.
2. **Invite Friends:** Share the Room Code with your friends. Up to 40 players can join a single lobby.
3. **The Race:** Once the host starts the game, everyone will be dropped into Level 1. 
4. **Scoring:** The game records the exact time it takes you to reach the exit (the bottom right corner) of each maze. After all 5 levels are completed, your total cumulative time is calculated.
5. **The Winner:** The player with the lowest total time across all 5 levels is crowned the champion on the final Leaderboard!

### 🕹️ Controls
- **Arrow Keys (`Up`, `Down`, `Left`, `Right`)**: Move your player (the triangle). 
- **Hold to Sprint**: Long-press any arrow key to accelerate smoothly in that direction. 
- **`Tab`**: Reset your location instantly back to the starting point of the current maze (useful if you get horribly lost, but the clock keeps ticking!).
- **`Escape`**: Immediately quit your current game, disconnect from the multiplayer room, and return to the main menu.

---

## 🚀 Tech Stack

This project is built from the ground up for extreme speed and real-time multiplayer:
- **Frontend Engine**: Pure HTML5 Canvas API and Vanilla JavaScript (No frameworks). 
- **Animations**: Linear interpolation (Lerp) for buttery smooth 60fps rendering and the modern CSS View Transitions API for seamless layout shifts.
- **Backend**: Node.js and Express.
- **Networking**: Raw WebSockets (`ws`) for instantaneous, low-latency syncing of room states and multiplayer broadcasts.

---

## 💻 Running it Locally

If you want to run the game locally on your own machine:

1. Clone this repository:
   ```bash
   git clone https://github.com/Aditya-Giri-4356/maze-io.git
   ```
2. Navigate into the folder:
   ```bash
   cd maze-io
   ```
3. Install the dependencies:
   ```bash
   npm install
   ```
4. Start the WebSocket server:
   ```bash
   npm start
   ```
5. Open your browser and go to `http://localhost:3000`.

---

## ☁️ Deployment

MAZE.IO is completely ready to be hosted on free cloud services like [Render](https://render.com). Simply connect this GitHub repository to a Render "Web Service", set the build command to `npm install` and the start command to `npm start`, and Render will automatically host the WebSockets and serve the frontend!
