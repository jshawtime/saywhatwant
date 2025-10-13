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
        {/* Config Version (primary display - largest) */}
        {configVersion && (
          <div style={{ 
            fontSize: '28px', 
            color: '#00ff00',
            fontWeight: 'bold',
            letterSpacing: '3px',
            marginBottom: '4px'
          }}>
            ENTITY CONFIG: {configVersion}
          </div>
        )}
        {/* App Version (secondary - smaller) */}
        <div style={{
          fontSize: '14px',
          color: '#00ff0080',
          letterSpacing: '1px'
        }}>
          ┌─ AI QUEUE MONITOR v1.0 ─┐
        </div>
      </div>
      <div className={styles.clock}>{time}</div>
      <div className={connected ? styles.connected : styles.disconnected}>
        {connected ? '● CONNECTED' : '○ OFFLINE'}
      </div>
    </div>
  );
};
