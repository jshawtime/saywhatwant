import React from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { formatTime } from './lib/formatters';
import { Header } from './components/Header';
import { LeftPanel } from './components/LeftPanel';
import { QueueList } from './components/QueueList';
import { Footer } from './components/Footer';
import styles from './styles/terminal.module.css';

function App() {
  const { connected, queue, stats, logs, llmRequests, deleteItem, clearQueue } = useWebSocket('ws://localhost:4002');
  const [lastUpdate, setLastUpdate] = React.useState(formatTime());
  const [kvMessages, setKvMessages] = React.useState<any[]>([]);

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
      
      {/* KV Store View (Top Right) */}
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
            {kvMessages.length > 0 ? JSON.stringify(kvMessages, null, 2) : 'Loading KV data...'}
          </pre>
        </div>
      </div>
      
      {/* Bottom Section: Debug Logs (Left) and LLM Requests (Right) */}
      <div className={styles.bottomSection}>
        {/* Debug Logs - LEFT 50% */}
        <div className={styles.logPanel}>
          <div className={styles.panelHeader} style={{ borderBottomColor: '#00FF00', color: '#00FF00' }}>
            DEBUG LOGS (LAST 100)
          </div>
          <div className={styles.panelContent} style={{ color: '#00FF00' }}>
            {logs.join('\n')}
          </div>
        </div>
        
        {/* LLM Requests - RIGHT 50% */}
        <div className={styles.llmPanel}>
          <div className={styles.panelHeader} style={{ borderBottomColor: '#FFAA00', color: '#FFAA00' }}>
            LLM SERVER REQUESTS - NEWEST FIRST
          </div>
          <div className={styles.panelContent} style={{ color: '#FFAA00' }}>
            {llmRequests.length > 0 ? JSON.stringify(llmRequests, null, 2) : 'Waiting for LLM requests...'}
          </div>
        </div>
      </div>
      <Footer connected={connected} lastUpdate={lastUpdate} />
    </div>
  );
}

export default App;
