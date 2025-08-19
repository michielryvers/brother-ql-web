import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { printDitheredImage, type PrinterStatus } from '../../../../packages/brother-ql-web/src/index.ts';
import { useCamera } from '../hooks/useCamera';
import BigButton from '../components/BigButton';

export interface CameraViewProps {
  status: PrinterStatus;
  onError: (message: string) => void;
}

export function CameraView({ status, onError }: CameraViewProps) {
  const { videoRef, ready, error } = useCamera();
  const [printing, setPrinting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const showError = error ?? null;

  const handleShutter = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      const v = videoRef.current as HTMLVideoElement;
      if (v.paused) {
        try { await v.play(); } catch {}
      }
      const w = v.videoWidth;
      const h = v.videoHeight;
      if (!w || !h) return;
      let c = canvasRef.current;
      if (!c) {
        c = document.createElement('canvas');
        canvasRef.current = c;
      }
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, w, h);

      setPrinting(true);
      await printDitheredImage(c, { cutAtEnd: true });
    } catch (e: any) {
      onError(e?.message || 'Printing failed');
    } finally {
      setPrinting(false);
    }
  }, [videoRef, onError]);

  const banner = useMemo(() => {
    if (printing) return 'Printing…';
    if (showError) return showError;
    const v = videoRef.current as HTMLVideoElement | null;
    const dims = v ? `video ${v.videoWidth}x${v.videoHeight}` : '';
    return `Ready – ${status.printableDots} dots wide ${dims ? `(${dims})` : ''}`;
  }, [printing, showError, status.printableDots, videoRef]);

  // Add keyboard event listener for volume buttons
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle volume up and down keys for printing (like camera apps)
      if (e.code === 'VolumeUp' || e.code === 'VolumeDown') {
        e.preventDefault();
        if (!ready || printing) return;
        handleShutter();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [ready, printing, handleShutter]);

  return (
    <div className="sb-camera">
      <video ref={videoRef as any} className="sb-video" playsInline muted autoPlay />
      <div className="sb-overlay">
        <div className="sb-banner">{banner}</div>
        <div></div>
        <BigButton
          variant="danger"
          className="sb-shutter"
          onClick={handleShutter}
          disabled={!ready || printing}
          aria-label="Capture and print"
        >
          ●
        </BigButton>
      </div>
    </div>
  );
}

export default CameraView;
