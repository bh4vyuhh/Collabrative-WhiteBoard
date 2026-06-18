export default function UsersBar({ users, connected, roomId }) {
  return (
    <div style={{
      position: 'fixed', top: 12, right: 12, zIndex: 200,
      background: '#fff', borderRadius: 14,
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      padding: '8px 14px', display: 'flex', alignItems: 'center',
      gap: 10, fontFamily: 'sans-serif',
    }}>
      <span style={{ fontSize: 12, color: '#64748b', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        #{roomId}
      </span>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#22c55e' : '#ef4444' }} />
      <div style={{ display: 'flex' }}>
        {users.slice(0, 6).map(u => (
          <div key={u.socketId || u.userId} title={u.userName} style={{
            width: 28, height: 28, borderRadius: '50%',
            background: u.color || '#6366f1', border: '2px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color: '#fff', fontWeight: 600, marginLeft: -6,
          }}>
            {(u.userName || 'G')[0].toUpperCase()}
          </div>
        ))}
        {users.length > 6 && (
          <div style={{
            width: 28, height: 28, borderRadius: '50%', background: '#94a3b8',
            border: '2px solid #fff', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 11, color: '#fff', marginLeft: -6,
          }}>+{users.length - 6}</div>
        )}
      </div>
      <button
        onClick={() => navigator.clipboard.writeText(window.location.href)}
        style={{
          padding: '4px 10px', borderRadius: 8, border: 'none',
          background: '#6366f1', color: '#fff', cursor: 'pointer',
          fontSize: 12, fontWeight: 500,
        }}>Share</button>
    </div>
  );
}
