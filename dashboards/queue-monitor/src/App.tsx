import React from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { formatTime } from './lib/formatters';
import { Header } from './components/Header';
import { LeftPanel } from './components/LeftPanel';
import { QueueList } from './components/QueueList';
import { RightPanel } from './components/RightPanel';
import { Footer } from './components/Footer';
import styles from './styles/terminal.module.css';

function App() {
  const { connected, queue, stats, deleteItem, clearQueue } = useWebSocket('ws://localhost:4002');
  const [lastUpdate, setLastUpdate] = React.useState(formatTime());

  // Update last update time
  React.useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(formatTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.terminal}>
      <Header connected={connected} />
      <LeftPanel stats={stats} />
      <QueueList 
        queue={queue}
        onDelete={deleteItem}
        onClearAll={clearQueue}
      />
      <RightPanel stats={stats} />
      <Footer connected={connected} lastUpdate={lastUpdate} />
    </div>
  );
}

export default App;
