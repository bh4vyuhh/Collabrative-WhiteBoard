import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useWhiteboard } from '../hooks/useWhiteboard';
import Toolbar from './Toolbar';
import StickyNote from './StickyNote';
import RemoteCursors from './RemoteCursors';
import UsersBar from './UsersBar';

export default function WhiteboardPage({ roomId, userName }) {
  const { socket, connected } = useSocket();
  const containerRef = useRef(null);

  const {
    visibleRef, initCanvas,
    tool, setTool, color, setColor, lineWidth, setLineWidth,
    stickies, users, remoteCursors,
    onPointerDown, onPointerMove, onPointerUp,
    clearBoard, undo, addSticky, updateSticky, deleteSticky,
  } = useWhiteboard(socket, roomId);

  // Join room when socket connects
  useEffect(() => {
    if (!socket) return;
    const doJoin = () => socket.emit('join-room', { roomId, userName });
    if (socket.connected) doJoin();
    socket.on('connect', doJoin);
    return () => socket.off('connect', doJoin);
  }, [socket, roomId, userName]);

  // Init canvas on mount and resize
  useEffect(() => {
    initCanvas();
    const observer = new ResizeObserver(initCanvas);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [initCanvas]);

  return (
    <div ref={containerRef} style={{
      position: 'relative', width: '100vw', height: '100vh',
      overflow: 'hidden', background: '#f8fafc',
    }}>

      {/* Grid background */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Single visible canvas - composited each RAF frame */}
      <canvas
        ref={visibleRef}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          zIndex: 1, cursor: 'crosshair',
        }}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      />

      {/* Sticky notes */}
      {stickies.map(sticky => (
        <StickyNote
          key={sticky.id}
          sticky={sticky}
          onUpdate={updateSticky}
          onDelete={deleteSticky}
          isOwn={sticky.userId === socket?.id}
        />
      ))}

      {/* Remote cursors */}
      <RemoteCursors cursors={remoteCursors} />

      {/* Toolbar */}
      <Toolbar
        tool={tool} setTool={setTool}
        color={color} setColor={setColor}
        lineWidth={lineWidth} setLineWidth={setLineWidth}
        onClear={clearBoard} onUndo={undo} onAddSticky={addSticky}
      />

      {/* Users bar */}
      <UsersBar users={users} connected={connected} roomId={roomId} />
    </div>
  );
}
