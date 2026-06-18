import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';

// ─── Utilities ───────────────────────────────────────────────────────────────

function throttle(fn, ms) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
  };
}

// Draw a single stroke onto any canvas context
function renderStroke(ctx, stroke) {
  if (!stroke?.points?.length) return;
  ctx.save();
  ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = stroke.color || '#000';
  ctx.lineWidth = stroke.width || 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  if (stroke.tool === 'pen' || stroke.tool === 'eraser') {
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  } else if (stroke.tool === 'line') {
    const last = stroke.points[stroke.points.length - 1];
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  } else if (stroke.tool === 'rect') {
    const p0 = stroke.points[0];
    const p1 = stroke.points[stroke.points.length - 1];
    ctx.strokeRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
  } else if (stroke.tool === 'circle') {
    const p0 = stroke.points[0];
    const p1 = stroke.points[stroke.points.length - 1];
    const rx = (p1.x - p0.x) / 2;
    const ry = (p1.y - p0.y) / 2;
    ctx.beginPath();
    ctx.ellipse(p0.x + rx, p0.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useWhiteboard(socket, roomId) {
  // ── Canvas refs ──
  // visibleRef   : the canvas the user sees - composited each RAF frame
  // committedRef : offscreen canvas holding all finished strokes (never cleared)
  // liveRef      : offscreen canvas holding in-progress strokes (cleared per stroke)
  const visibleRef = useRef(null);
  const committedRef = useRef(null); // OffscreenCanvas
  const liveRef = useRef(null);      // OffscreenCanvas

  const visibleCtx = useRef(null);
  const committedCtx = useRef(null);
  const liveCtx = useRef(null);

  const rafId = useRef(null);
  const needsComposite = useRef(false);

  // ── Tool state (React state - OK, changes rarely) ──
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#1e293b');
  const [lineWidth, setLineWidth] = useState(4);

  // ── Non-drawing state ──
  const [stickies, setStickies] = useState([]);
  const [users, setUsers] = useState([]);
  const [remoteCursors, setRemoteCursors] = useState({});

  // ── Drawing refs (never cause re-renders) ──
  const toolRef = useRef('pen');
  const colorRef = useRef('#1e293b');
  const lineWidthRef = useRef(4);
  const isDrawing = useRef(false);
  const currentStroke = useRef(null);

  // remote peers: socketId -> { color, width, tool, points[], lastPoint }
  const remoteStrokes = useRef({});

  // point batch for outgoing
  const pendingPoints = useRef([]);
  const flushTimer = useRef(null);

  // throttled cursor emitter
  const emitCursor = useRef(null);

  // Keep tool refs in sync with state
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { lineWidthRef.current = lineWidth; }, [lineWidth]);

  // ── RAF compositor ──
  // Runs every animation frame ONLY when needsComposite is true.
  // Composites committedCanvas + liveCanvas onto the visible canvas.
  const scheduleComposite = useCallback(() => {
    needsComposite.current = true;
    if (!rafId.current) {
      rafId.current = requestAnimationFrame(function loop() {
        if (needsComposite.current) {
          const canvas = visibleRef.current;
          const ctx = visibleCtx.current;
          if (ctx && canvas) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (committedRef.current) ctx.drawImage(committedRef.current, 0, 0);
            if (liveRef.current) ctx.drawImage(liveRef.current, 0, 0);
          }
          needsComposite.current = false;
        }
        rafId.current = requestAnimationFrame(loop);
      });
    }
  }, []);

  // ── Canvas init ──
  const initCanvas = useCallback(() => {
    const canvas = visibleRef.current;
    if (!canvas) return;

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w;
    canvas.height = h;
    visibleCtx.current = canvas.getContext('2d');

    // Create/resize offscreen canvases
    committedRef.current = new OffscreenCanvas(w, h);
    committedCtx.current = committedRef.current.getContext('2d');

    liveRef.current = new OffscreenCanvas(w, h);
    liveCtx.current = liveRef.current.getContext('2d');

    scheduleComposite();
  }, [scheduleComposite]);

  // ── Full redraw from stroke list (used on board-state load) ──
  const redrawCommitted = useCallback((strokes) => {
    const ctx = committedCtx.current;
    const canvas = committedRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach(s => renderStroke(ctx, s));
    scheduleComposite();
  }, [scheduleComposite]);

  // ── Append one stroke to committed canvas (no full redraw) ──
  const appendCommitted = useCallback((stroke) => {
    const ctx = committedCtx.current;
    if (!ctx) return;
    renderStroke(ctx, stroke);
    scheduleComposite();
  }, [scheduleComposite]);

  // ── Clear live canvas ──
  const clearLive = useCallback(() => {
    const ctx = liveCtx.current;
    const canvas = liveRef.current;
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    scheduleComposite();
  }, [scheduleComposite]);

  // ── Flush outgoing point batch to server ──
  const flushPoints = useCallback(() => {
    if (!socket || !currentStroke.current || pendingPoints.current.length === 0) return;
    socket.emit('stroke-points-batch', {
      strokeId: currentStroke.current.id,
      points: [...pendingPoints.current],
    });
    pendingPoints.current = [];
  }, [socket]);

  // ── Socket setup ──
  useEffect(() => {
    if (!socket) return;

    emitCursor.current = throttle(({ x, y }) => socket.emit('cursor-move', { x, y }), 40);

    // Full board on join
    socket.on('board-state', ({ strokes, stickies: st, users: u }) => {
      redrawCommitted(strokes);
      setStickies(st);
      setUsers(u);
    });

    socket.on('users-update', setUsers);

    // Remote stroke started
    socket.on('stroke-start', (stroke) => {
      remoteStrokes.current[stroke.userId] = {
        ...stroke,
        points: stroke.points ? [...stroke.points] : [],
      };
    });

    // Remote batched points arrived - draw directly onto liveCtx via RAF
    socket.on('stroke-points-batch', ({ strokeId, points, userId }) => {
      const rs = remoteStrokes.current[userId];
      if (!rs) return;

      const ctx = liveCtx.current;
      if (!ctx) return;

      ctx.save();
      ctx.globalCompositeOperation = rs.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = rs.color;
      ctx.lineWidth = rs.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      // Start from last known point
      const startPoint = rs.points.length > 0 ? rs.points[rs.points.length - 1] : points[0];
      ctx.moveTo(startPoint.x, startPoint.y);
      points.forEach(p => {
        ctx.lineTo(p.x, p.y);
        rs.points.push(p);
      });
      ctx.stroke();
      ctx.restore();

      scheduleComposite();
    });

    // Remote stroke finished - move from live to committed
    socket.on('stroke-end', (stroke) => {
      delete remoteStrokes.current[stroke.userId];
      appendCommitted(stroke);
      // Clear only this user's contribution from live
      // Simplest correct approach: redraw live from all remaining remote strokes
      const ctx = liveCtx.current;
      const canvas = liveRef.current;
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        Object.values(remoteStrokes.current).forEach(rs => renderStroke(ctx, rs));
      }
      scheduleComposite();
    });

    socket.on('stroke-removed', ({ strokeId }) => {
      // Need full redraw - we don't know which strokes remain without the list
      // Ask server for fresh state
      socket.emit('request-board-state');
    });

    socket.on('board-cleared', () => {
      const ctx = committedCtx.current;
      const canvas = committedRef.current;
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
      clearLive();
    });

    socket.on('sticky-add', (sticky) => {
      setStickies(prev => prev.find(s => s.id === sticky.id) ? prev : [...prev, sticky]);
    });
    socket.on('sticky-update', (sticky) => {
      setStickies(prev => prev.map(s => s.id === sticky.id ? { ...s, ...sticky } : s));
    });
    socket.on('sticky-delete', ({ stickyId }) => {
      setStickies(prev => prev.filter(s => s.id !== stickyId));
    });

    socket.on('cursor-move', ({ socketId, x, y, userName, color: c }) => {
      setRemoteCursors(prev => ({ ...prev, [socketId]: { x, y, userName, color: c } }));
    });
    socket.on('user-left', ({ socketId }) => {
      setRemoteCursors(prev => { const n = { ...prev }; delete n[socketId]; return n; });
      delete remoteStrokes.current[socketId];
    });
    socket.on('cursors-state', (cursors) => setRemoteCursors(cursors));

    // Server can push fresh board state (used after undo)
    socket.on('board-state-refresh', ({ strokes }) => redrawCommitted(strokes));

    return () => {
      ['board-state','users-update','stroke-start','stroke-points-batch','stroke-end',
       'stroke-removed','board-cleared','sticky-add','sticky-update','sticky-delete',
       'cursor-move','user-left','cursors-state','board-state-refresh'].forEach(e => socket.off(e));
    };
  }, [socket, redrawCommitted, appendCommitted, clearLive, scheduleComposite, flushPoints]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, []);

  // ── Pointer event handlers ──
  const getPos = (e) => {
    const canvas = visibleRef.current;
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const onPointerDown = useCallback((e) => {
    if (!socket || !roomId) return;
    const pos = getPos(e);
    isDrawing.current = true;

    const stroke = {
      id: uuid(),
      tool: toolRef.current,
      color: toolRef.current === 'eraser' ? '#ffffff' : colorRef.current,
      width: toolRef.current === 'eraser' ? lineWidthRef.current * 4 : lineWidthRef.current,
      points: [pos],
      userId: socket.id,
    };
    currentStroke.current = stroke;
    pendingPoints.current = [pos];

    socket.emit('stroke-start', stroke);
    flushTimer.current = setInterval(flushPoints, 30);

    // Draw first point locally on live canvas
    const ctx = liveCtx.current;
    if (ctx) {
      ctx.save();
      ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.fillStyle = stroke.color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, stroke.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      scheduleComposite();
    }
  }, [socket, roomId, flushPoints, scheduleComposite]);

  const onPointerMove = useCallback((e) => {
    const pos = getPos(e);

    // Always emit cursor (throttled)
    if (emitCursor.current) emitCursor.current(pos);

    if (!isDrawing.current || !currentStroke.current) return;

    const stroke = currentStroke.current;
    const prev = stroke.points[stroke.points.length - 1];
    stroke.points.push(pos);
    pendingPoints.current.push(pos);

    // Draw immediately on local live canvas - zero delay for own strokes
    const ctx = liveCtx.current;
    if (ctx) {
      ctx.save();
      ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.restore();
      scheduleComposite();
    }
  }, [scheduleComposite]);

  const onPointerUp = useCallback(() => {
    if (!isDrawing.current || !currentStroke.current) return;
    isDrawing.current = false;
    clearInterval(flushTimer.current);
    flushPoints(); // send remaining points

    const stroke = currentStroke.current;
    currentStroke.current = null;

    // Move own stroke from live to committed immediately
    appendCommitted(stroke);
    clearLive();

    socket?.emit('stroke-end', { stroke });
  }, [socket, flushPoints, appendCommitted, clearLive]);

  // ── Board actions ──
  const clearBoard = useCallback(() => socket?.emit('clear-board'), [socket]);

  const undo = useCallback(() => socket?.emit('undo'), [socket]);

  const addSticky = useCallback(() => {
    if (!socket) return;
    socket.emit('sticky-add', {
      sticky: {
        id: uuid(),
        x: 80 + Math.random() * 300,
        y: 80 + Math.random() * 200,
        w: 200, h: 150, text: '',
        color: ['#fef3c7','#dbeafe','#dcfce7','#fce7f3','#f3e8ff'][Math.floor(Math.random() * 5)],
      }
    });
  }, [socket]);

  const updateSticky = useCallback((sticky) => socket?.emit('sticky-update', { sticky }), [socket]);
  const deleteSticky = useCallback((stickyId) => socket?.emit('sticky-delete', { stickyId }), [socket]);

  return {
    visibleRef, initCanvas,
    tool, setTool, color, setColor, lineWidth, setLineWidth,
    stickies, users, remoteCursors,
    onPointerDown, onPointerMove, onPointerUp,
    clearBoard, undo, addSticky, updateSticky, deleteSticky,
  };
}
