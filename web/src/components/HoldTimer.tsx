import { useEffect, useRef } from 'react';
import { useNow } from '../hooks/useNow';

interface Props {
  expiresAt: string;
  onExpire?: () => void;
}

export default function HoldTimer({ expiresAt, onExpire }: Props) {
  const now = useNow(1000);
  const remainingMs = Math.max(0, new Date(expiresAt).getTime() - now);
  const expired = remainingMs === 0;

  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (expired) onExpireRef.current?.();
  }, [expired]);

  if (expired) {
    return (
      <p className="hold-timer expired" role="status">
        Your hold on this time has expired.
      </p>
    );
  }

  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);

  return (
    <p className={`hold-timer${remainingMs < 60_000 ? ' ending' : ''}`} role="timer">
      We’re holding this time for you for{' '}
      <strong className="tabular">
        {minutes}:{String(seconds).padStart(2, '0')}
      </strong>
    </p>
  );
}
