export default function RemoteCursors({ cursors }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 80 }}>
      {Object.entries(cursors).map(([id, { x, y, userName, color }]) => (
        <div key={id} style={{ position: 'absolute', left: x, top: y, transform: 'translate(-2px,-2px)', pointerEvents: 'none' }}>
          <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
            <path d="M2 2L16 10L9 12L7 20L2 2Z" fill={color || '#6366f1'} stroke="#fff" strokeWidth="1.5" />
          </svg>
          <div style={{
            position: 'absolute', left: 18, top: 0,
            background: color || '#6366f1', color: '#fff',
            fontSize: 11, fontFamily: 'sans-serif',
            padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }}>{userName || 'Guest'}</div>
        </div>
      ))}
    </div>
  );
}
