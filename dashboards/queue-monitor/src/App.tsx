import React from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { formatTime } from './lib/formatters';
import { Header } from './components/Header';
import { LeftPanel } from './components/LeftPanel';
import { QueueList } from './components/QueueList';
import { RightPanel } from './components/RightPanel';
import { LogViewer } from './components/LogViewer';
import { Footer } from './components/Footer';
import styles from './styles/terminal.module.css';

function App() {
  const { connected, queue, stats, logs, deleteItem, clearQueue } = useWebSocket('ws://localhost:4002');
  const [lastUpdate, setLastUpdate] = React.useState(formatTime());
  const [kvMessages, setKvMessages] = React.useState<any[]>([]);
  const [showKV, setShowKV] = React.useState(false);

  // Update last update time
  React.useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(formatTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch KV messages
  const fetchKVMessages = React.useCallback(async () => {
    try {
      const response = await fetch(`https://sww-comments.bootloaders.workers.dev/api/comments?limit=20&t=${Date.now()}`);
      const data = await response.json();
      setKvMessages(data.comments || []);
    } catch (error) {
      console.error('Failed to fetch KV:', error);
    }
  }, []);

  // Auto-refresh KV every 10s
  React.useEffect(() => {
    fetchKVMessages();
    const interval = setInterval(fetchKVMessages, 10000);
    return () => clearInterval(interval);
  }, [fetchKVMessages]);

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
      
      {/* Toggle between Logs and KV */}
      <div style={{ padding: '10px', borderTop: '1px solid #00FF00' }}>
        <button 
          className={styles.button}
          onClick={() => setShowKV(!showKV)}
          style={{ width: '200px' }}
        >
          {showKV ? '[ SHOW LOGS ]' : '[ SHOW KV STORE ]'}
        </button>
        <span style={{ marginLeft: '20px', color: '#00FF00' }}>
          {showKV ? 'KV Store (Last 20)' : 'Debug Logs (Last 100)'}
        </span>
      </div>
      
      {showKV ? (
        <div className={styles.logViewer}>
          <pre style={{ 
            background: '#0a0a0a', 
            color: '#00FF00', 
            padding: '20px',
            overflow: 'auto',
            fontSize: '11px',
            lineHeight: '1.4'
          }}>
            {JSON.stringify(kvMessages, null, 2)}
          </pre>
        </div>
      ) : (
        <LogViewer logs={logs} maxLogs={100} />
      )}
      
      <Footer connected={connected} lastUpdate={lastUpdate} />
    </div>
  );
}

export default App;
