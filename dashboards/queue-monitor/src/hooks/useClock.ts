import { useState, useEffect } from 'react';
import { formatTime } from '../lib/formatters';

export function useClock() {
  const [time, setTime] = useState(formatTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(formatTime());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return time;
}
