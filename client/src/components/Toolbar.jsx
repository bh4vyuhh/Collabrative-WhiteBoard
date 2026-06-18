import { useState } from 'react';

const TOOLS = [
  { id: 'pen',    label: 'Pen',    icon: '✏️' },
  { id: 'eraser', label: 'Eraser', icon: '⬜' },
  { id: 'line',   label: 'Line',   icon: '╱'  },
  { id: 'rect',   label: 'Rect',   icon: '▭'  },
  { id: 'circle', label: 'Circle', icon: '◯'  },
];

const COLORS = [
  '#1e293b','#ef4444','#f97316','#eab308',
  '#22c55e','#3b82f6','#8b5cf6','#ec4899','#ffffff',
];

const WIDTHS = [2, 4, 8, 14];

export default function Toolbar({ tool, setTool, color, setColor, lineWidth, setLineWidth, onClear, onUndo, onAddSticky }) {
  const [showColors, setShowColors] = useState(false);

  return (
    <div style={{
      position: 'fixed', left: 12, top: '50%', transform: 'translateY(-50%)',
      background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      padding: '12px 8px', display: 'flex', flexDirection: 'column',
      gap: 6, zIndex: 100, userSelect: 'none',
    }}>
      {TOOLS.map(t => (
        <button key={t.id} title={t.label} onClick={() => setTool(t.id)} style={{
          width: 40, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer',
          background: tool === t.id ? '#6366f1' : '#f1f5f9',
          color: tool === t.id ? '#fff' : '#334155',
          fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
        }}>{t.icon}</button>
      ))}

      <div style={{ height: 1, background: '#e2e8f0', margin: '4px 0' }} />

      <button title="Color" onClick={() => setShowColors(v => !v)} style={{
        width: 40, height: 40, borderRadius: 10,
        border: '2px solid #e2e8f0', background: color, cursor: 'pointer',
      }} />

      {showColors && (
        <div style={{
          position: 'absolute', left: 56,
          background: '#fff', borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          padding: 8, display: 'grid',
          gridTemplateColumns: 'repeat(3,1fr)', gap: 6,
        }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => { setColor(c); setShowColors(false); }} style={{
              width: 28, height: 28, borderRadius: 6,
              border: color === c ? '2px solid #6366f1' : '1px solid #e2e8f0',
              background: c, cursor: 'pointer',
            }} />
          ))}
        </div>
      )}

      {WIDTHS.map(w => (
        <button key={w} onClick={() => setLineWidth(w)} title={`${w}px`} style={{
          width: 40, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
          background: lineWidth === w ? '#e0e7ff' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: Math.max(16, w * 2), height: w, borderRadius: w,
            background: lineWidth === w ? '#6366f1' : '#94a3b8',
          }} />
        </button>
      ))}

      <div style={{ height: 1, background: '#e2e8f0', margin: '4px 0' }} />

      <button onClick={onAddSticky} title="Add sticky note" style={{
        width: 40, height: 40, borderRadius: 10, border: 'none',
        background: '#fef3c7', cursor: 'pointer', fontSize: 18,
      }}>📝</button>

      <button onClick={onUndo} title="Undo" style={{
        width: 40, height: 40, borderRadius: 10, border: 'none',
        background: '#f1f5f9', cursor: 'pointer', fontSize: 16,
      }}>↩</button>

      <button onClick={onClear} title="Clear board" style={{
        width: 40, height: 40, borderRadius: 10, border: 'none',
        background: '#fee2e2', cursor: 'pointer', fontSize: 16,
      }}>🗑</button>
    </div>
  );
}
