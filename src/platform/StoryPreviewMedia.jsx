import React, { useEffect, useRef, useState } from 'react';
import { readStoryPreviewBlob } from './platformStore.js';
import {
  directionalPointerProgress, pointerEntrySide, resolvePreviewDuration, resolveScrubDuration,
  storyHasPreview
} from './storyPreviewScrub.js';

const RETURN_DELAY_MS = 1000;
const RETURN_DURATION_SECONDS = 5;

export function StoryPreviewMedia({ story, className, mediaClassName, fallbackImage, children }) {
  const hasPreview = storyHasPreview(story);
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const freezeCanvasRef = useRef(null);
  const objectUrlRef = useRef('');
  const loadingRef = useRef(false);
  const frameRef = useRef(0);
  const returnDelayRef = useRef(0);
  const targetProgressRef = useRef(0);
  const entrySideRef = useRef('left');
  const loadRequestRef = useRef(0);
  const returningRef = useRef(false);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [returning, setReturning] = useState(false);
  const [bridgingReturn, setBridgingReturn] = useState(false);

  const releaseVideo = () => {
    loadRequestRef.current += 1;
    cancelAnimationFrame(frameRef.current);
    window.clearTimeout(returnDelayRef.current);
    frameRef.current = 0;
    returnDelayRef.current = 0;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.playbackRate = 1;
      video.onended = null;
      video.removeAttribute('src');
      video.load();
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = '';
    returningRef.current = false;
    setReturning(false);
    setBridgingReturn(false);
    setReady(false);
  };

  useEffect(() => releaseVideo, []);

  const seekTowardTarget = () => {
    // Der angeforderte Frame läuft gerade; ohne Reset würde ein früher Frame
    // vor loadedmetadata alle späteren Seek-Versuche dauerhaft blockieren.
    frameRef.current = 0;
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_METADATA) return;
    // Chrome liefert für MediaRecorder-WebMs häufig Infinity als duration.
    // Die bekannte Aufnahmedauer hält auch diese Dateien direkt seekbar.
    // Bei Ping-Pong-Dateien gehört nur der erste Abschnitt zur Maus-Timeline.
    const duration = resolveScrubDuration(video.duration, story.previewDurationSeconds);
    const targetTime = targetProgressRef.current * Math.max(0, duration - 0.001);
    const difference = targetTime - video.currentTime;
    if (Math.abs(difference) < 0.012) {
      video.currentTime = targetTime;
      return;
    }
    if (!video.seeking) video.currentTime += difference * 0.24;
    frameRef.current = requestAnimationFrame(seekTowardTarget);
  };

  const startSeeking = () => {
    if (!frameRef.current) frameRef.current = requestAnimationFrame(seekTowardTarget);
  };

  const ensureVideoLoaded = async () => {
    if (!hasPreview || loadingRef.current || videoRef.current?.getAttribute('src')) return;
    loadingRef.current = true;
    const loadRequest = ++loadRequestRef.current;
    try {
      if (story.previewVideoUrl) {
        if (loadRequest !== loadRequestRef.current || !videoRef.current) return;
        videoRef.current.src = story.previewVideoUrl;
      } else {
        const blob = await readStoryPreviewBlob(story.previewVideoAssetId);
        if (loadRequest !== loadRequestRef.current || !blob || !videoRef.current) return;
        objectUrlRef.current = URL.createObjectURL(blob);
        videoRef.current.src = objectUrlRef.current;
      }
      videoRef.current.load();
    } catch (error) {
      console.warn('Story-Preview konnte nicht geladen werden.', error);
    } finally {
      loadingRef.current = false;
    }
  };

  const activate = async (event) => {
    if (!hasPreview || event.pointerType === 'touch' || !window.matchMedia('(hover: hover)').matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    entrySideRef.current = pointerEntrySide(event.clientX, bounds.left, bounds.width);
    // Die Eintrittskante ist immer Station 1. Von rechts läuft die Timeline
    // deshalb beim Bewegen nach links vorwärts, von links entsprechend nach rechts.
    targetProgressRef.current = directionalPointerProgress(
      event.clientX, bounds.left, bounds.width, entrySideRef.current
    );
    window.clearTimeout(returnDelayRef.current);
    returnDelayRef.current = 0;
    returningRef.current = false;
    setReturning(false);
    setBridgingReturn(false);
    setActive(true);
    if (videoRef.current?.getAttribute('src')) {
      videoRef.current.pause();
      videoRef.current.playbackRate = 1;
      videoRef.current.onended = null;
      const duration = resolveScrubDuration(
        videoRef.current.duration, story.previewDurationSeconds
      );
      videoRef.current.currentTime = targetProgressRef.current * Math.max(0, duration - 0.001);
      return;
    }
    await ensureVideoLoaded();
  };

  const scrub = (event) => {
    if (!hasPreview || event.pointerType === 'touch') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    targetProgressRef.current = directionalPointerProgress(
      event.clientX, bounds.left, bounds.width, entrySideRef.current
    );
    startSeeking();
  };

  const startSmoothReturn = () => {
    const video = videoRef.current;
    if (!video) return;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    returningRef.current = true;
    setReturning(true);
    const freezeCanvas = freezeCanvasRef.current;
    if (freezeCanvas && video.videoWidth > 0 && video.videoHeight > 0) {
      freezeCanvas.width = video.videoWidth;
      freezeCanvas.height = video.videoHeight;
      freezeCanvas.getContext('2d')?.drawImage(video, 0, 0, freezeCanvas.width, freezeCanvas.height);
      setBridgingReturn(true);
    }
    const forwardDuration = story.previewDurationSeconds || 3;
    const hasRecordedReturn = story.previewPlaybackMode === 'ping-pong'
      || (Number.isFinite(video.duration) && video.duration > forwardDuration + 0.75);
    if (!hasRecordedReturn) {
      // Alte Previews besitzen keinen aufgenommenen Rückweg. Der exakt aktuelle
      // Frame überbrückt deshalb den Seek zu Frame 1, statt Schwarz zu zeigen.
      const revealFirstFrame = () => {
        returningRef.current = false;
        setReturning(false);
        setBridgingReturn(false);
      };
      if (video.currentTime < 0.015) {
        revealFirstFrame();
        return;
      }
      video.addEventListener('seeked', () => {
        if (typeof video.requestVideoFrameCallback === 'function') {
          video.requestVideoFrameCallback(revealFirstFrame);
        } else {
          window.setTimeout(revealFirstFrame, 80);
        }
      }, { once: true });
      video.currentTime = 0;
      return;
    }
    const progress = Math.max(0, Math.min(1, video.currentTime / forwardDuration));
    if (progress < 0.015) {
      returningRef.current = false;
      setReturning(false);
      setBridgingReturn(false);
      return;
    }
    const totalDuration = Number.isFinite(video.duration)
      ? video.duration
      : forwardDuration + (story.previewReturnDurationSeconds || 3.5);
    const returnSegmentDuration = Math.max(0.1, totalDuration - forwardDuration);
    const returnStartTime = forwardDuration + (1 - progress) * returnSegmentDuration;
    const remainingReturnSeconds = progress * returnSegmentDuration;
    const playReturn = () => {
      if (!returningRef.current || !video.getAttribute('src')) return;
      // Der visuelle Rückweg dauert unabhängig von der aktuellen Mausposition
      // gleich lang. Sonst wäre ein halb abgespielter Teaser doppelt so schnell
      // wieder am Anfang wie ein vollständig abgespielter.
      video.playbackRate = Math.max(0.1, Math.min(1, remainingReturnSeconds / RETURN_DURATION_SECONDS));
      setBridgingReturn(false);
      video.play().catch(() => releaseVideo());
    };
    video.onended = () => {
      video.pause();
      video.playbackRate = 1;
      video.onended = null;
      returningRef.current = false;
      setReturning(false);
      setBridgingReturn(false);
    };
    video.addEventListener('seeked', playReturn, { once: true });
    video.currentTime = Math.min(totalDuration - 0.01, returnStartTime);
  };

  const deactivate = () => {
    setActive(false);
    // Die Maus-Scrub-Schleife muss während der Wartezeit vollständig stehen.
    // Würde sie mit Ziel 0 weiterlaufen, sähe das wie ein sofortiger, schneller
    // Rücklauf aus, noch bevor der eigentliche Rückweg gestartet wird.
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    targetProgressRef.current = 0;
    if (ready && videoRef.current?.getAttribute('src')) {
      window.clearTimeout(returnDelayRef.current);
      returnDelayRef.current = window.setTimeout(() => {
        returnDelayRef.current = 0;
        startSmoothReturn();
      }, RETURN_DELAY_MS);
    } else {
      releaseVideo();
    }
  };

  const prepareVideoForSeeking = () => {
    const video = videoRef.current;
    if (!video) return;
    const finish = () => {
      const duration = resolveScrubDuration(video.duration, story.previewDurationSeconds);
      const entryTime = targetProgressRef.current * Math.max(0, duration - 0.001);
      const reveal = () => {
        if (!video.getAttribute('src')) return;
        setReady(true);
        startSeeking();
      };
      if (Math.abs(video.currentTime - entryTime) < 0.012) {
        video.currentTime = entryTime;
        reveal();
        return;
      }
      video.addEventListener('seeked', reveal, { once: true });
      video.currentTime = entryTime;
    };
    if (Number.isFinite(video.duration)) {
      finish();
      return;
    }

    // Chromium-WebMs aus MediaRecorder enthalten oft keine Duration im Header.
    // Ein einmaliger Seek ans Dateiende lässt Chromium die echte Dauer ermitteln
    // und macht anschließend normale currentTime-Seeks möglich.
    const onDurationResolved = () => {
      video.removeEventListener('timeupdate', onDurationResolved);
      finish();
    };
    video.addEventListener('timeupdate', onDurationResolved);
    video.currentTime = Number.MAX_SAFE_INTEGER;
  };

  useEffect(() => {
    const element = containerRef.current;
    if (!hasPreview || !element) return undefined;
    const bounds = element.getBoundingClientRect();
    if (bounds.bottom >= -200 && bounds.top <= window.innerHeight + 200
      && bounds.right >= -200 && bounds.left <= window.innerWidth + 200) {
      ensureVideoLoaded();
    }
    if (typeof IntersectionObserver === 'undefined') {
      ensureVideoLoaded();
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) ensureVideoLoaded();
    }, { rootMargin: '200px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasPreview, story.previewVideoUrl, story.previewVideoAssetId]);

  return (
    <div ref={containerRef} className={`${className} story-preview-media${hasPreview ? ' has-story-preview' : ''}${ready ? ' is-video-ready' : ''}${(active || returning) && ready ? ' is-preview-active' : ''}`}
      onPointerEnter={activate} onPointerMove={scrub} onPointerLeave={deactivate}>
      <div className={`${mediaClassName} story-preview-poster`} style={{ backgroundImage: `url("${story.coverImage || fallbackImage}")` }} />
      {hasPreview && (
        <>
          <video ref={videoRef} className="story-preview-video" muted playsInline preload="none"
            onLoadedMetadata={prepareVideoForSeeking} aria-hidden="true" />
          <canvas ref={freezeCanvasRef}
            className={`story-preview-freeze${bridgingReturn ? ' is-visible' : ''}`} aria-hidden="true" />
        </>
      )}
      {children}
    </div>
  );
}
