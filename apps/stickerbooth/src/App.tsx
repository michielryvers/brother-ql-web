import { useCallback, useMemo, useState } from 'react';
import type { PrinterStatus } from '../../../packages/brother-ql-web/src/index.ts';
import ConnectView from './views/ConnectView';
import CameraView from './views/CameraView';
import './App.css';

type Phase = 'disconnected' | 'connecting' | 'camera-ready' | 'printing' | 'error';

function App() {
  const [phase, setPhase] = useState<Phase>('disconnected');
  const [status, setStatus] = useState<PrinterStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onConnected = useCallback((s: PrinterStatus) => {
    setStatus(s);
    setPhase('camera-ready');
    setErrorMessage(null);
  }, []);

  const onError = useCallback((msg: string) => {
    setErrorMessage(msg);
  }, []);

  const busy = phase === 'connecting' || phase === 'printing';

  const view = useMemo(() => {
    if (!status) {
      return <ConnectView onConnected={onConnected} onError={onError} busy={busy} />;
    }
    return <CameraView status={status} onError={onError} />;
  }, [busy, onConnected, onError, status]);

  return (
    <div className="sb-app">
      {errorMessage && <div className="sb-error" role="alert">{errorMessage}</div>}
      {view}
    </div>
  );
}

export default App;
