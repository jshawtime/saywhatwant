import React from 'react';
import type { QueueItem as QueueItemType } from '../lib/types';
import styles from '../styles/terminal.module.css';

interface QueueItemProps {
  item: QueueItemType;
  position: number;
  onDelete: (id: string) => void;
}

export const QueueItem: React.FC<QueueItemProps> = ({ item, position, onDelete }) => {
  const getPriorityClass = () => {
    if (item.priority <= 10) return styles.priorityCritical;
    if (item.priority <= 30) return styles.priorityHigh;
    if (item.priority <= 60) return styles.priorityMedium;
    if (item.priority <= 90) return styles.priorityLow;
    return styles.priorityBg;
  };

  const status = item.claimedBy ? '[PROC]' : '[WAIT]';
  const preview = (item.message?.text || 'No message').substring(0, 60);

  const handleDelete = () => {
    if (confirm(`DELETE ITEM #${position}?`)) {
      onDelete(item.id);
    }
  };

  return (
    <div className={`${styles.queueItem} ${getPriorityClass()}`}>
      <div style={{ flex: 1 }}>
        <span style={{ color: '#006600', marginRight: '10px' }}>#{position}</span>
        <span style={{ marginRight: '10px' }}>P{item.priority}</span>
        <span style={{ color: '#00FFFF', marginRight: '10px' }}>{item.entity?.id || 'unknown'}</span>
        <span style={{ marginRight: '10px' }}>{status}</span>
        <div style={{ marginTop: '5px', fontSize: '14px', color: '#00CC00' }}>
          "{preview}..."
        </div>
      </div>
      <button 
        className={`${styles.button} ${styles.buttonDanger} ${styles.buttonSmall}`}
        onClick={handleDelete}
      >
        [ X ]
      </button>
    </div>
  );
};
