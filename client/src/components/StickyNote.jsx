import { useRef, useState } from 'react';

export default function StickyNote({ sticky, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const offset = useRef({ x: 0, y: 0 });

  const startDrag = (e) => {
    if (editing) return;
    e.preventDefault();
    const src = e.touches ? e.touches[0] : e;
    offset.current = { x: src.clientX - sticky.x, y: src.clientY - sticky.y };

    const move = (ev) => {
      const s = ev.touches ? ev.touches[0] : ev;
      onUpdate({ ...sticky, x: s.clientX - offset.current.x, y: s.clientY - offset.current.y });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
  };

  return (
    <div
      onMouseDown={startDrag}
      onTouchStart={startDrag}
      style={{
        position: 'absolute', left: sticky.x, top: sticky.y,
        width: sticky.w, minHeight: sticky.h,
        background: sticky.color, borderRadius: 10,
        boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
        cursor: 'grab', zIndex: 50,
      }}
    >
      <div style={{
        height: 28, borderRadius: '10px 10px 0 0',
        background: 'rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 8px', flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'sans-serif' }}>
          {sticky.userName || 'note'}
        </span>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={() => onDelete(sticky.id)}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14 }}
        >✕</button>
      </div>
      <textarea
        value={sticky.text}
        placeholder="Type a note..."
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
        onMouseDown={e => e.stopPropagation()}
        onChange={e => onUpdate({ ...sticky, text: e.target.value })}
        style={{
          flex: 1, border: 'none', background: 'transparent',
          resize: 'none', padding: '8px 10px', minHeight: 100,
          fontFamily: "'Segoe UI', sans-serif", fontSize: 14,
          color: '#1e293b', lineHeight: 1.5, outline: 'none',
        }}
      />
    </div>
  );
}
