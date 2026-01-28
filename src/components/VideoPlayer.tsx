'use client';

import { useRef, useEffect, useState } from 'react';

function isGoogleDriveEmbed(url: string): boolean {
  return url.includes('drive.google.com');
}

export interface FrameCapturePayload {
  timestamp_seconds: number;
  imageDataUrl: string;
}

interface VideoPlayerProps {
  embedUrl: string;
  title: string;
  onTimestampCapture?: (timestamp: number) => void;
  onCaptureRequest?: () => void;
  onFrameCapture?: (payload: FrameCapturePayload) => void;
}

export function VideoPlayer({
  embedUrl,
  title,
  onTimestampCapture,
  onCaptureRequest,
  onFrameCapture,
}: VideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const useNativeVideo = !isGoogleDriveEmbed(embedUrl);

  // Iframe: listen for postMessage time (Google Drive)
  useEffect(() => {
    if (useNativeVideo) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        if (event.data && typeof event.data === 'object') {
          if ('currentTime' in event.data && typeof event.data.currentTime === 'number') {
            const time = Math.floor(event.data.currentTime);
            setCurrentTime(time);
            onTimestampCapture?.(time);
            return;
          }
          if ('data' in event.data && event.data.data && typeof event.data.data === 'object' && 'currentTime' in event.data.data) {
            const time = Math.floor(event.data.data.currentTime);
            setCurrentTime(time);
            onTimestampCapture?.(time);
            return;
          }
        }
        if (typeof event.data === 'string') {
          const timeMatch = event.data.match(/currentTime[":\s]*(\d+)/i);
          if (timeMatch) {
            const time = parseInt(timeMatch[1], 10);
            setCurrentTime(time);
            onTimestampCapture?.(time);
          }
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('message', handleMessage);
    const requestTime = () => {
      try {
        iframeRef.current?.contentWindow?.postMessage({ action: 'getCurrentTime' }, '*');
        iframeRef.current?.contentWindow?.postMessage('getCurrentTime', '*');
      } catch {
        // CORS expected
      }
    };
    const interval = setInterval(requestTime, 2000);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(interval);
    };
  }, [useNativeVideo, onTimestampCapture]);

  // Native video: sync currentTime for timestamp capture
  useEffect(() => {
    if (!useNativeVideo) return;

    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const time = Math.floor(video.currentTime);
      setCurrentTime(time);
    };
    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [useNativeVideo]);

  // Capture time only (iframe or manual)
  useEffect(() => {
    if (!onCaptureRequest) return;

    const handleCapture = () => {
      if (currentTime !== null && onTimestampCapture) {
        onTimestampCapture(currentTime);
      } else if (useNativeVideo && videoRef.current) {
        const t = Math.floor(videoRef.current.currentTime);
        setCurrentTime(t);
        onTimestampCapture?.(t);
      } else if (iframeRef.current?.contentWindow) {
        try {
          iframeRef.current.contentWindow.postMessage({ action: 'getCurrentTime' }, '*');
        } catch {
          // CORS
        }
      }
    };

    (window as Window & { __captureVideoTime?: () => void }).__captureVideoTime = handleCapture;
    return () => {
      delete (window as Window & { __captureVideoTime?: () => void }).__captureVideoTime;
    };
  }, [currentTime, onTimestampCapture, onCaptureRequest, useNativeVideo]);

  // Capture frame + timestamp (native video only; iframe cannot access pixels)
  useEffect(() => {
    if (!useNativeVideo || !onFrameCapture) return;

    const captureFrame = (): boolean => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return false;

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      ctx.drawImage(video, 0, 0);
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const timestamp_seconds = Math.floor(video.currentTime);
      onFrameCapture({ timestamp_seconds, imageDataUrl });
      return true;
    };

    (window as Window & { __captureFrame?: () => boolean }).__captureFrame = captureFrame;
    return () => {
      delete (window as Window & { __captureFrame?: () => boolean }).__captureFrame;
    };
  }, [useNativeVideo, onFrameCapture]);

  if (useNativeVideo) {
    return (
      <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
        <video
          ref={videoRef}
          src={embedUrl}
          title={title}
          className="absolute inset-0 w-full h-full rounded-lg bg-black"
          controls
          playsInline
        />
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title={title}
        className="absolute inset-0 w-full h-full rounded-lg"
        allow="autoplay; encrypted-media"
        allowFullScreen
      />
    </div>
  );
}
