import { useState } from 'react';
import { SocketProvider } from './context/SocketContext';
import JoinScreen from './components/JoinScreen';
import WhiteboardPage from './components/WhiteboardPage';

export default function App() {
  const [session, setSession] = useState(null);

  const handleJoin = ({ userName, roomId }) => {
    setSession({ userName, roomId });
    const url = new URL(window.location);
    url.searchParams.set('room', roomId);
    window.history.replaceState({}, '', url);
  };

  if (!session) return <JoinScreen onJoin={handleJoin} />;

  return (
    <SocketProvider>
      <WhiteboardPage roomId={session.roomId} userName={session.userName} />
    </SocketProvider>
  );
}
