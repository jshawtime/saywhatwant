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
  const { connected, queue, stats, logs, llmRequests, deleteItem, clearQueue } = useWebSocket('ws://localhost:4002');
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
      const response = await fetch(`https://sww-comments.bootloaders.workers.dev/api/comments?limit=100&t=${Date.now()}`);
      const data = await response.json();
      // Sort newest first
      const sorted = (data.comments || []).sort((a: any, b: any) => b.timestamp - a.timestamp);
      setKvMessages(sorted);
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
      
      {/* KV Store View (replaces Right Panel Live Stats) */}
      <div className={`${styles.panel} ${styles.rightPanel}`}>
        <div className={styles.sectionTitle}>KV STORE (LAST 100) - NEWEST FIRST</div>
        <div style={{
          height: '100%',
          overflow: 'auto',
          fontSize: '10px',
          lineHeight: '1.3',
          fontFamily: 'monospace',
          color: '#00FF00',
          background: '#0a0a0a',
          padding: '10px'
        }}>
          <pre style={{ margin: 0 }}>
            {JSON.stringify(kvMessages, null, 2)}
          </pre>
        </div>
      </div>
      
      {/* Debug Logs (Left) and LLM Requests (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', height: '400px' }}>
        {/* Debug Logs - Left */}
        <div>
          <LogViewer logs={logs} maxLogs={100} />
        </div>
        
        {/* LLM Requests - Right */}
        <div className={styles.logViewer}>
          <div className={styles.sectionTitle}>LLM SERVER REQUESTS (LAST 50) - NEWEST FIRST</div>
          <pre style={{
            background: '#0a0a0a',
            color: '#FFAA00',
            padding: '15px',
            overflow: 'auto',
            height: 'calc(100% - 40px)',
            fontSize: '10px',
            lineHeight: '1.4',
            margin: 0
          }}>
            {JSON.stringify(llmRequests, null, 2)}
          </pre>
        </div>
      </div>
      <Footer connected={connected} lastUpdate={lastUpdate} />
    </div>
  );
}

export default App;
