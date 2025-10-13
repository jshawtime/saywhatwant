import React from 'react';
import { useClock } from '../hooks/useClock';
import styles from '../styles/terminal.module.css';

interface HeaderProps {
  connected: boolean;
  configVersion?: string;
}

export const Header: React.FC<HeaderProps> = ({ connected, configVersion }) => {
  const time = useClock();

  return (
    <div className={styles.header}>
      <div className={styles.title}>
        ┌─ AI QUEUE MONITOR v1.0 ─┐
        {configVersion && (
          <div style={{ 
            fontSize: '18px', 
            marginTop: '8px', 
            color: '#00ff00',
            fontWeight: 'bold',
            letterSpacing: '2px'
          }}>
            ENTITY CONFIG: {configVersion}
          </div>
        )}
      </div>
      <div className={styles.clock}>{time}</div>
      <div className={connected ? styles.connected : styles.disconnected}>
        {connected ? '● CONNECTED' : '○ OFFLINE'}
      </div>
    </div>
  );
};
