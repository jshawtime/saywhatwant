import React from 'react';
import type { QueueStats } from '../lib/types';
import styles from '../styles/terminal.module.css';

interface LeftPanelProps {
  stats: QueueStats;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ stats }) => {
  const copyCommand = () => {
    const cmd = 'cd ~/devrepo/SAYWHATWANTv1/saywhatwant/ai && npm run dev';
    navigator.clipboard.writeText(cmd);
    alert('✓ COMMAND COPIED');
  };

  return (
    <div className={`${styles.panel} ${styles.leftPanel}`}>
      <div className={styles.sectionTitle}>SYSTEM STATUS</div>
      
      <div className={styles.statLine}>
        <span className={styles.statLabel}>BOT_LOC:</span>
        <span className={styles.statValue}>~/ai</span>
      </div>
      <div className={styles.statLine}>
        <span className={styles.statLabel}>LM_SRV_1:</span>
        <span className={styles.statValue}>10.0.0.102</span>
      </div>
      <div className={styles.statLine}>
        <span className={styles.statLabel}>LM_SRV_2:</span>
        <span className={styles.statValue}>10.0.0.100</span>
      </div>
      <div className={styles.statLine}>
        <span className={styles.statLabel}>POLL_INT:</span>
        <span className={styles.statValue}>30s</span>
      </div>
      <div className={styles.statLine}>
        <span className={styles.statLabel}>QUEUE:</span>
        <span className={styles.statValue}>ENABLED</span>
      </div>
      <div className={styles.statLine}>
        <span className={styles.statLabel}>ROUTER:</span>
        <span className={styles.statValue}>DISABLED</span>
      </div>
      
      <div className={styles.sectionTitle} style={{ marginTop: '30px' }}>PRIORITY BANDS</div>
      <div className={styles.statLine}>
        <span style={{ color: '#FF0000' }}>█ CRIT (0-10):</span>
        <span className={styles.statValue}>{stats.priorityBands.critical}</span>
      </div>
      <div className={styles.statLine}>
        <span style={{ color: '#FFFF00' }}>█ HIGH (11-30):</span>
        <span className={styles.statValue}>{stats.priorityBands.high}</span>
      </div>
      <div className={styles.statLine}>
        <span style={{ color: '#00FFFF' }}>█ MED (31-60):</span>
        <span className={styles.statValue}>{stats.priorityBands.medium}</span>
      </div>
      <div className={styles.statLine}>
        <span style={{ color: '#00FF00' }}>█ LOW (61-90):</span>
        <span className={styles.statValue}>{stats.priorityBands.low}</span>
      </div>
      <div className={styles.statLine}>
        <span style={{ color: '#666666' }}>█ BG (91-99):</span>
        <span className={styles.statValue}>{stats.priorityBands.background}</span>
      </div>
      
      <div className={styles.sectionTitle} style={{ marginTop: '30px' }}>LAUNCH CMD</div>
      <div className={styles.commandBox} onClick={copyCommand}>
        cd ~/devrepo/SAYWHATWANTv1/saywhatwant/ai && npm run dev
      </div>
      <button className={styles.button} onClick={copyCommand} style={{ width: '100%' }}>
        [ COPY ]
      </button>
    </div>
  );
};
