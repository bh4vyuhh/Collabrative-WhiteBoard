const { v4: uuid } = require('uuid');
const Board = require('./models');
const { setCursor, getCursors, removeCursor } = require('./redis');

// In-memory fallback when MongoDB is unavailable
const memBoards = {};

async function getBoard(roomId) {
  try {
    let board = await Board.findOne({ roomId });
    if (!board) board = await Board.create({ roomId, strokes: [], stickies: [] });
    return board;
  } catch {
    if (!memBoards[roomId]) memBoards[roomId] = { roomId, strokes: [], stickies: [], isMem: true };
    return memBoards[roomId];
  }
}

async function saveBoard(board) {
  try {
    if (board.isMem) return;
    board.updatedAt = new Date();
    await board.save();
  } catch {}
}

module.exports = function registerSocketHandlers(io) {
  const roomUsers = {};
  const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

  io.on('connection', (socket) => {
    let currentRoom = null;
    let currentUser = null;

    // ── Join ──
    socket.on('join-room', async ({ roomId, userName }) => {
      if (currentRoom) {
        socket.leave(currentRoom);
        if (roomUsers[currentRoom]) delete roomUsers[currentRoom][socket.id];
        await removeCursor(currentRoom, socket.id);
        socket.to(currentRoom).emit('user-left', { socketId: socket.id });
      }

      currentRoom = roomId;
      const colorIndex = Object.keys(roomUsers[roomId] || {}).length % COLORS.length;
      currentUser = { socketId: socket.id, userName: userName || 'Guest', color: COLORS[colorIndex] };

      if (!roomUsers[roomId]) roomUsers[roomId] = {};
      roomUsers[roomId][socket.id] = currentUser;
      socket.join(roomId);

      const board = await getBoard(roomId);
      socket.emit('board-state', {
        strokes: board.strokes || [],
        stickies: board.stickies || [],
        users: Object.values(roomUsers[roomId]),
      });

      const cursors = await getCursors(roomId);
      socket.emit('cursors-state', cursors);

      socket.to(roomId).emit('user-joined', currentUser);
      io.to(roomId).emit('users-update', Object.values(roomUsers[roomId]));
    });

    // ── Drawing ──
    // Broadcast stroke-start so remote users know a new stroke began
    socket.on('stroke-start', ({ stroke }) => {
      if (!currentRoom) return;
      socket.to(currentRoom).emit('stroke-start', { ...stroke, userId: socket.id });
    });

    // Broadcast batched points - server is just a relay here, no processing
    socket.on('stroke-points-batch', ({ strokeId, points }) => {
      if (!currentRoom) return;
      socket.to(currentRoom).emit('stroke-points-batch', { strokeId, points, userId: socket.id });
    });

    // Persist completed stroke and broadcast
    socket.on('stroke-end', async ({ stroke }) => {
      if (!currentRoom) return;
      const fullStroke = { ...stroke, userId: socket.id, userName: currentUser?.userName };
      const board = await getBoard(currentRoom);
      board.strokes.push(fullStroke);
      await saveBoard(board);
      // Only broadcast to others - sender already drew it locally
      socket.to(currentRoom).emit('stroke-end', fullStroke);
    });

    socket.on('undo', async () => {
      if (!currentRoom) return;
      const board = await getBoard(currentRoom);
      // Find last stroke by this user
      const strokes = board.strokes;
      for (let i = strokes.length - 1; i >= 0; i--) {
        if (strokes[i].userId === socket.id) {
          const [removed] = strokes.splice(i, 1);
          await saveBoard(board);
          io.to(currentRoom).emit('stroke-removed', { strokeId: removed.id });
          break;
        }
      }
    });

    socket.on('clear-board', async () => {
      if (!currentRoom) return;
      const board = await getBoard(currentRoom);
      board.strokes = [];
      await saveBoard(board);
      io.to(currentRoom).emit('board-cleared');
    });

    // ── Stickies ──
    socket.on('sticky-add', async ({ sticky }) => {
      if (!currentRoom) return;
      const full = { ...sticky, id: sticky.id || uuid(), userId: socket.id, userName: currentUser?.userName };
      const board = await getBoard(currentRoom);
      board.stickies.push(full);
      await saveBoard(board);
      io.to(currentRoom).emit('sticky-add', full);
    });

    socket.on('sticky-update', async ({ sticky }) => {
      if (!currentRoom) return;
      const board = await getBoard(currentRoom);
      const idx = board.stickies.findIndex(s => s.id === sticky.id);
      if (idx !== -1) {
        const existing = board.stickies[idx].toObject ? board.stickies[idx].toObject() : board.stickies[idx];
        board.stickies[idx] = { ...existing, ...sticky };
        await saveBoard(board);
      }
      socket.to(currentRoom).emit('sticky-update', sticky);
    });

    socket.on('sticky-delete', async ({ stickyId }) => {
      if (!currentRoom) return;
      const board = await getBoard(currentRoom);
      board.stickies = board.stickies.filter(s => s.id !== stickyId);
      await saveBoard(board);
      io.to(currentRoom).emit('sticky-delete', { stickyId });
    });

    // ── Cursor - just relay, no processing ──
    socket.on('cursor-move', ({ x, y }) => {
      if (!currentRoom || !currentUser) return;
      socket.to(currentRoom).emit('cursor-move', {
        socketId: socket.id,
        x, y,
        userName: currentUser.userName,
        color: currentUser.color,
      });
      // Fire-and-forget Redis update (don't await)
      setCursor(currentRoom, socket.id, { ...currentUser, x, y }).catch(() => {});
    });

    // ── Disconnect ──
    socket.on('disconnect', async () => {
      if (!currentRoom) return;
      if (roomUsers[currentRoom]) {
        delete roomUsers[currentRoom][socket.id];
        if (Object.keys(roomUsers[currentRoom]).length === 0) delete roomUsers[currentRoom];
      }
      await removeCursor(currentRoom, socket.id);
      socket.to(currentRoom).emit('user-left', { socketId: socket.id });
      if (roomUsers[currentRoom]) {
        io.to(currentRoom).emit('users-update', Object.values(roomUsers[currentRoom]));
      }
    });
  });
};
