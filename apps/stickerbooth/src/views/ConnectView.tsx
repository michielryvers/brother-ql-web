import { useState } from 'react';
import type { PrinterStatus } from '../../../../packages/brother-ql-web/src/index.ts';
import { connect } from '../../../../packages/brother-ql-web/src/index.ts';
import BigButton from '../components/BigButton';

export interface ConnectViewProps {
  onConnected: (status: PrinterStatus) => void;
  onError: (message: string) => void;
  busy?: boolean;
}

function PrinterSvg({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
      <rect x="20" y="30" width="80" height="50" rx="8" fill="#dfe4ea" stroke="#2f3542" strokeWidth="3" />
      <rect x="30" y="18" width="60" height="20" rx="4" fill="#ced6e0" stroke="#2f3542" strokeWidth="3" />
      <rect x="30" y="66" width="60" height="8" rx="2" fill="#2ed573" />
      <circle cx="95" cy="55" r="6" fill="#ff4757" />
    </svg>
  );
}

export function ConnectView({ onConnected, onError, busy }: ConnectViewProps) {
  const [localBusy, setLocalBusy] = useState(false);
  const handleClick = async () => {
    try {
      setLocalBusy(true);
      const status = await connect();
      onConnected(status);
    } catch (e: any) {
      const msg = e?.message || 'Failed to connect printer';
      onError(msg);
    } finally {
      setLocalBusy(false);
    }
  };

  return (
    <div className="sb-center">
      <div className="sb-stack">
        <PrinterSvg />
        <BigButton onClick={handleClick} disabled={busy || localBusy}>
          {busy || localBusy ? 'Connecting…' : 'Connect printer'}
        </BigButton>
        <p className="sb-subtext">Uses WebUSB. Works best in Chrome/Edge.</p>
      </div>
    </div>
  );
}

export default ConnectView;
