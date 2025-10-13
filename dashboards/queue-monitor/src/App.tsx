import React from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { formatTime } from './lib/formatters';
import { Header } from './components/Header';
import { LeftPanel } from './components/LeftPanel';
import { QueueList } from './components/QueueList';
import { Footer } from './components/Footer';
import styles from './styles/terminal.module.css';

function App() {
  const { connected, queue, stats, logs, llmRequests, pm2Logs, deleteItem, clearQueue, fetchPm2Logs } = useWebSocket('ws://localhost:4002');
  const [lastUpdate, setLastUpdate] = React.useState(formatTime());
  const [kvMessages, setKvMessages] = React.useState<any[]>([]);
  const [expandedRequests, setExpandedRequests] = React.useState<Set<number>>(new Set());
  const [expandedKVMessages, setExpandedKVMessages] = React.useState<Set<number>>(new Set());
  const [copiedItems, setCopiedItems] = React.useState<Set<string>>(new Set());

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

  // Auto-refresh KV every 10s and fetch PM2 logs on mount
  React.useEffect(() => {
    fetchKVMessages();
    fetchPm2Logs(500); // Fetch 500 lines of PM2 logs initially
    const interval = setInterval(fetchKVMessages, 10000);
    return () => clearInterval(interval);
  }, [fetchKVMessages, fetchPm2Logs]);

  // Toggle LLM request expansion
  const toggleRequest = (index: number) => {
    setExpandedRequests(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Toggle KV message expansion
  const toggleKVMessage = (index: number) => {
    setExpandedKVMessages(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();  // Prevent toggle when clicking copy
    navigator.clipboard.writeText(text);
    
    // Add to copied items
    setCopiedItems(prev => new Set(prev).add(itemId));
    
    // Remove after 3 seconds
    setTimeout(() => {
      setCopiedItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }, 3000);
  };

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
        <div className={styles.sectionTitle}>KV STORE (LAST 100) - NEWEST FIRST ({kvMessages.length})</div>
        <div style={{
          height: '100%',
          overflow: 'auto',
          fontSize: '10px',
          lineHeight: '1.3',
          fontFamily: 'monospace',
          color: '#00FF00',
          background: '#0a0a0a',
          padding: 0
        }}>
          {kvMessages.length > 0 ? (
            kvMessages.map((msg, idx) => {
              const isExpanded = expandedKVMessages.has(idx);
              const itemId = `kv-${msg.id || idx}`;
              const isCopied = copiedItems.has(itemId);
              
              return (
                <div key={msg.id || idx} className={styles.llmRequestItem} style={{ borderColor: '#003300' }}>
                  <div 
                    className={styles.llmRequestHeader}
                    onClick={() => toggleKVMessage(idx)}
                    style={{ borderBottomColor: '#003300' }}
                  >
                    <div className={styles.llmRequestSummary} style={{ color: '#00FF00' }}>
                      #{idx + 1} - {msg.id || 'no-id'}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <button
                        onClick={(e) => copyToClipboard(JSON.stringify(msg, null, 2), itemId, e)}
                        style={{
                          background: isCopied ? '#00FF00' : 'transparent',
                          border: '1px solid #00FF00',
                          color: isCopied ? '#000000' : '#00FF00',
                          padding: '2px 8px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          transition: 'all 0.2s'
                        }}
                      >
                        {isCopied ? 'COPIED!' : 'COPY'}
                      </button>
                      <div className={`${styles.llmRequestChevron} ${isExpanded ? styles.llmRequestChevronExpanded : ''}`} style={{ color: '#00FF00' }}>
                        ▼
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className={styles.llmRequestBody} style={{ color: '#00FF00' }}>
                      {JSON.stringify(msg, null, 2)}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ padding: '20px', color: '#003300', textAlign: 'center' }}>
              Loading KV data...
            </div>
          )}
        </div>
      </div>
      
      {/* Bottom Section: Debug Logs (Left) and LLM Requests (Right) */}
      <div className={styles.bottomSection}>
        {/* Debug Logs - LEFT 25% */}
        <div className={styles.logPanel} style={{ width: '25%' }}>
          <div className={styles.panelHeader} style={{ borderBottomColor: '#00FF00', color: '#00FF00', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>DEBUG LOGS ({logs.length})</span>
            <button
              onClick={() => copyToClipboard(logs.join('\n'), 'debug-logs')}
              style={{
                background: copiedItems.has('debug-logs') ? '#00FF00' : 'transparent',
                border: '1px solid #00FF00',
                color: copiedItems.has('debug-logs') ? '#000000' : '#00FF00',
                padding: '2px 8px',
                cursor: 'pointer',
                fontSize: '11px',
                fontFamily: 'monospace'
              }}
            >
              {copiedItems.has('debug-logs') ? 'COPIED!' : 'COPY'}
            </button>
          </div>
          <div className={styles.panelContent} style={{ color: '#00FF00' }}>
            {logs.join('\n')}
          </div>
        </div>
        
        {/* PM2 Logs - CENTER 25% */}
        <div className={styles.logPanel} style={{ width: '25%' }}>
          <div className={styles.panelHeader} style={{ borderBottomColor: '#FF00FF', color: '#FF00FF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>PM2 LOGS</span>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                onClick={() => fetchPm2Logs(200)}
                style={{
                  background: 'transparent',
                  border: '1px solid #FF00FF',
                  color: '#FF00FF',
                  padding: '2px 8px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontFamily: 'monospace'
                }}
              >
                REFRESH
              </button>
              <button
                onClick={() => copyToClipboard(pm2Logs, 'pm2-logs')}
                style={{
                  background: copiedItems.has('pm2-logs') ? '#FF00FF' : 'transparent',
                  border: '1px solid #FF00FF',
                  color: copiedItems.has('pm2-logs') ? '#000000' : '#FF00FF',
                  padding: '2px 8px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontFamily: 'monospace'
                }}
              >
                {copiedItems.has('pm2-logs') ? 'COPIED!' : 'COPY'}
              </button>
            </div>
          </div>
          <div className={styles.panelContent} style={{ color: '#FF00FF', fontSize: '11px' }}>
            {pm2Logs || 'Click REFRESH to load PM2 logs...'}
          </div>
        </div>
        
        {/* LLM Requests - RIGHT 50% */}
        <div className={styles.llmPanel} style={{ width: '50%' }}>
          <div className={styles.panelHeader} style={{ borderBottomColor: '#FFAA00', color: '#FFAA00' }}>
            LLM SERVER REQUESTS - NEWEST FIRST ({llmRequests.length})
          </div>
          <div className={styles.panelContent} style={{ color: '#FFAA00', padding: 0 }}>
            {llmRequests.length > 0 ? (
              llmRequests.map((req, idx) => {
                const isExpanded = expandedRequests.has(idx);
                const timestamp = req.timestamp ? new Date(req.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
                const model = req.modelName || 'unknown';
                const entity = req.entityId || 'unknown';
                const hasError = req.error || req.status === 'error' || req.status === 'failed';
                const itemId = `llm-${idx}`;
                const isCopied = copiedItems.has(itemId);
                
                return (
                  <div key={idx} className={styles.llmRequestItem}>
                    <div 
                      className={styles.llmRequestHeader}
                      onClick={() => toggleRequest(idx)}
                      style={{ borderLeftColor: hasError ? '#FF0000' : '#FFAA00' }}
                    >
                      <div className={styles.llmRequestSummary} style={{ color: hasError ? '#FF0000' : '#FFAA00' }}>
                        [{timestamp}] #{idx + 1} - {entity} | {model} {hasError && '❌ ERROR'}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button
                          onClick={(e) => copyToClipboard(JSON.stringify(req, null, 2), itemId, e)}
                          style={{
                            background: isCopied ? '#FFAA00' : 'transparent',
                            border: '1px solid #FFAA00',
                            color: isCopied ? '#000000' : '#FFAA00',
                            padding: '2px 8px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            transition: 'all 0.2s'
                          }}
                        >
                          {isCopied ? 'COPIED!' : 'COPY'}
                        </button>
                        <div className={`${styles.llmRequestChevron} ${isExpanded ? styles.llmRequestChevronExpanded : ''}`}>
                          ▼
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className={styles.llmRequestBody}>
                        {JSON.stringify(req, null, 2)}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '20px', color: '#664400', textAlign: 'center' }}>
                Waiting for LLM requests...
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer connected={connected} lastUpdate={lastUpdate} />
    </div>
  );
}

export default App;
