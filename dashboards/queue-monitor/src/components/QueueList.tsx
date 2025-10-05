import React from 'react';
import type { QueueItem as QueueItemType } from '../lib/types';
import { QueueItem } from './QueueItem';
import styles from '../styles/terminal.module.css';

interface QueueListProps {
  queue: QueueItemType[];
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export const QueueList: React.FC<QueueListProps> = ({ queue, onDelete, onClearAll }) => {
  const handleClearAll = () => {
    if (confirm('⚠️ DANGER: CLEAR ENTIRE QUEUE?\n\nTHIS CANNOT BE UNDONE!')) {
      onClearAll();
    }
  };

  return (
    <div className={`${styles.panel} ${styles.centerPanel}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div className={styles.sectionTitle} style={{ margin: 0 }}>
          QUEUE ITEMS ({queue.length})
        </div>
        <button className={`${styles.button} ${styles.buttonDanger}`} onClick={handleClearAll}>
          [ DANGER: CLEAR ALL ]
        </button>
      </div>
      
      {queue.length === 0 ? (
        <div className={styles.empty}>
          ╔════════════════════════════════════╗<br />
          ║  QUEUE EMPTY                       ║<br />
          ║  AWAITING MESSAGES...              ║<br />
          ╚════════════════════════════════════╝
        </div>
      ) : (
        queue.map((item, index) => (
          <QueueItem 
            key={item.id}
            item={item}
            position={index + 1}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  );
};
