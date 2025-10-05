import React from 'react';
import styles from '../styles/terminal.module.css';

interface FooterProps {
  connected: boolean;
  lastUpdate: string;
}

export const Footer: React.FC<FooterProps> = ({ connected, lastUpdate }) => {
  return (
    <div className={styles.footer}>
      <div>
        <span style={{ color: '#006600' }}>STATUS: </span>
        <span className={connected ? styles.connected : styles.disconnected}>
          {connected ? 'OPERATIONAL' : 'OFFLINE'}
        </span>
      </div>
      <div>
        <span style={{ color: '#006600' }}>LAST_UPDATE: </span>
        <span>{lastUpdate}</span>
      </div>
      <div>
        <span style={{ color: '#006600' }}>SYSTEM: </span>
        <span>READY <span className={styles.blink}>█</span></span>
      </div>
    </div>
  );
};
