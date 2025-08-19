import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  ready: boolean;
  error: string | null;
  restart: () => Promise<void>;
}

async function getStreamPreferUser(): Promise<MediaStream> {
  // Try front camera
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
  } catch {}
  // Try without constraint
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  } catch (err) {
    throw err;
  }
}

export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attach = useCallback(async () => {
    setReady(false);
    setError(null);
    try {
      const s = await getStreamPreferUser();
      setStream(s);
      const v = videoRef.current;
      if (v) {
        v.srcObject = s;
        // Ensure inline playback and autoplay are allowed
        (v as any).playsInline = true;
        v.muted = true;

        const track = s.getVideoTracks()[0];
        const settings = track?.getSettings?.();
        if (settings?.width && settings?.height) {
          v.width = settings.width as number;
          v.height = settings.height as number;
        }

        const markReady = () => setReady(true);
        v.addEventListener('loadeddata', markReady, { once: true });

        try {
          await v.play();
          setReady(true);
        } catch {
          // Fallback: rely on loadeddata to mark ready
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Unable to access camera');
    }
  }, []);

  useEffect(() => {
    attach();
    return () => {
      if (stream) {
        for (const t of stream.getTracks()) t.stop();
      }
      const v = videoRef.current;
      if (v) {
        v.srcObject = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restart = useCallback(async () => {
    if (stream) {
      for (const t of stream.getTracks()) t.stop();
    }
    setStream(null);
    await attach();
  }, [attach, stream]);

  return { videoRef, stream, ready, error, restart };
}
