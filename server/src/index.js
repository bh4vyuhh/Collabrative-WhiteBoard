require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const registerSocketHandlers = require('./socketHandlers');

const app = express();
const server = http.createServer(app);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
  // Increase buffer limits to handle batched points
  maxHttpBufferSize: 1e6,
});

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true }));

app.get('/api/board/:roomId', async (req, res) => {
  try {
    const Board = require('./models');
    const board = await Board.findOne({ roomId: req.params.roomId });
    if (!board) return res.status(404).json({ error: 'not found' });
    res.json({ strokes: board.strokes, stickies: board.stickies });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

registerSocketHandlers(io);

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whiteboard')
  .then(() => console.log('[MongoDB] connected'))
  .catch((e) => console.warn('[MongoDB] using in-memory fallback:', e.message));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`[Server] listening on :${PORT}`));
