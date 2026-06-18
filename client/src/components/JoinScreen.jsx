import { useState } from 'react';
import { v4 as uuid } from 'uuid';

export default function JoinScreen({ onJoin }) {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || '';
  });

  const join = (e) => {
    e.preventDefault();
    const room = roomId.trim() || uuid().slice(0, 8);
    onJoin({ userName: name.trim() || 'Guest', roomId: room });
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: "'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '40px 48px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxWidth: 440, width: '90%',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎨</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#1e293b' }}>Collaborative Whiteboard</h1>
          <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 14 }}>Draw and collaborate in real-time</p>
        </div>

        <form onSubmit={join}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600, color: '#374151' }}>Your name</label>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Enter your name"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10, boxSizing: 'border-box',
              border: '2px solid #e2e8f0', fontSize: 15, marginBottom: 16, outline: 'none',
            }}
          />

          <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600, color: '#374151' }}>Room ID (leave blank to create new)</label>
          <input
            type="text" value={roomId} onChange={e => setRoomId(e.target.value)}
            placeholder="e.g. abc12345"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10, boxSizing: 'border-box',
              border: '2px solid #e2e8f0', fontSize: 15, marginBottom: 24, outline: 'none',
              fontFamily: 'monospace',
            }}
          />

          <button type="submit" style={{
            width: '100%', padding: '12px', borderRadius: 12, border: 'none',
            background: '#6366f1', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer',
          }}>
            {roomId ? 'Join Room' : 'Create Room'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, margin: '16px 0 0' }}>
          Share the Room ID with others to collaborate
        </p>
      </div>
    </div>
  );
}
