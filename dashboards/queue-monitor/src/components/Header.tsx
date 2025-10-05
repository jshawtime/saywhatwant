import React from 'react';
import { useClock } from '../hooks/useClock';
import styles from '../styles/terminal.module.css';

interface HeaderProps {
  connected: boolean;
}

export const Header: React.FC<HeaderProps> = ({ connected }) => {
  const time = useClock();

  return (
    <div className={styles.header}>
      <div className={styles.title}>┌─ AI QUEUE MONITOR v1.0 ─┐</div>
      <div className={styles.clock}>{time}</div>
      <div className={connected ? styles.connected : styles.disconnected}>
        {connected ? '● CONNECTED' : '○ OFFLINE'}
      </div>
    </div>
  );
};
