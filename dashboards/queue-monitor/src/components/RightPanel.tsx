import React from 'react';
import type { QueueStats } from '../lib/types';
import { timeAgo } from '../lib/formatters';
import styles from '../styles/terminal.module.css';

interface RightPanelProps {
  stats: QueueStats;
}

export const RightPanel: React.FC<RightPanelProps> = ({ stats }) => {
  return (
    <div className={`${styles.panel} ${styles.rightPanel}`}>
      <div className={styles.sectionTitle}>LIVE STATISTICS</div>
      
      <div className={styles.statLine}>
        <span className={styles.statLabel}>TOTAL:</span>
        <span className={styles.statValue}>{stats.totalItems}</span>
      </div>
      <div className={styles.statLine}>
        <span className={styles.statLabel}>UNCLAIMED:</span>
        <span className={styles.statValue}>{stats.unclaimedItems}</span>
      </div>
      <div className={styles.statLine}>
        <span className={styles.statLabel}>PROCESSING:</span>
        <span className={styles.statValue}>{stats.claimedItems}</span>
      </div>
      <div className={styles.statLine}>
        <span className={styles.statLabel}>THRU/HR:</span>
        <span className={styles.statValue}>{stats.throughputHour}/min</span>
      </div>
      <div className={styles.statLine}>
        <span className={styles.statLabel}>LAST_POST:</span>
        <span className={styles.statValue}>{timeAgo(stats.lastSuccess)}</span>
      </div>
      <div className={styles.statLine}>
        <span className={styles.statLabel}>AVG_WAIT:</span>
        <span className={styles.statValue}>{Math.round(stats.avgWait)}ms</span>
      </div>
      
      <div className={styles.sectionTitle} style={{ marginTop: '30px' }}>QUICK LINKS</div>
      <button 
        className={styles.button} 
        onClick={() => window.open('https://saywhatwant.app/ai-console', '_blank')}
        style={{ width: '100%', marginBottom: '8px' }}
      >
        [ AI CONSOLE ]
      </button>
      <button 
        className={styles.button}
        onClick={() => window.open('https://saywhatwant.app/queue-monitor', '_blank')}
        style={{ width: '100%', marginBottom: '8px' }}
      >
        [ QUEUE MONITOR ]
      </button>
      <button 
        className={styles.button}
        onClick={() => window.open('https://saywhatwant.app/', '_blank')}
        style={{ width: '100%' }}
      >
        [ MAIN APP ]
      </button>
      
      {/* Placeholders for future features */}
      <div className={styles.placeholder} style={{ marginTop: '30px' }}>
        ENTITY METRICS<br/>
        [PLACEHOLDER]
      </div>
      
      <div className={styles.placeholder}>
        SERVER HEALTH<br/>
        [PLACEHOLDER]
      </div>
      
      <div className={styles.placeholder}>
        COST TRACKING<br/>
        [PLACEHOLDER]
      </div>
    </div>
  );
};
