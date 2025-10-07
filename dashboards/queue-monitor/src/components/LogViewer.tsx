import React, { useState } from 'react';
import styles from '../styles/terminal.module.css';

interface LogViewerProps {
  logs: string[];
  maxLogs?: number;
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs, maxLogs = 20 }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const logText = logs.join('\n');
    navigator.clipboard.writeText(logText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`${styles.panel} ${styles.logPanel}`} style={{ gridColumn: 'span 3' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div className={styles.sectionTitle} style={{ margin: 0 }}>
          DEBUG LOGS (Last {maxLogs})
        </div>
        <button 
          className={`${styles.button}`}
          onClick={handleCopy}
          style={{ minWidth: '100px' }}
        >
          {copied ? '[ ✓ COPIED ]' : '[ COPY ]'}
        </button>
      </div>
      
      <div style={{ 
        fontFamily: 'monospace',
        fontSize: '12px',
        maxHeight: '200px',
        overflowY: 'auto',
        backgroundColor: '#000000',
        padding: '10px',
        border: '1px solid #00FF00',
      }}>
        {logs.length === 0 ? (
          <div style={{ color: '#006600' }}>
            WAITING FOR LOGS...
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} style={{ 
              color: log.includes('[AIS]') || log.includes('[FILTERED') ? '#FF00FF' : 
                    log.includes('[BOT PARAMS]') ? '#00FFFF' :
                    log.includes('[WORKER]') ? '#FFFF00' :
                    log.includes('[ERROR]') || log.includes('❌') ? '#FF0000' :
                    '#00FF00',
              marginBottom: '2px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

