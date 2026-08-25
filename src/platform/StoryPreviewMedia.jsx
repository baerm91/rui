import React, { useEffect, useRef, useState } from 'react';
import { readStoryPreviewBlob } from './platformStore.js';
import {
  resolvePreviewLookOffset, resolveVisualPreviewProgress, storyHasPreview
} from './storyPreviewScrub.js';

const HOVER_PLAY_DELAY_MS = 1000;

export function StoryPreviewMedia({ story, className, mediaClassName, fallbackImage, children }) {
  const hasPreview = storyHasPreview(story);
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const objectUrlRef = useRef('');
  const loadingRef = useRef(false);
  const frameRef = useRef(0);
  const hoverDelayRef = useRef(0);
  const loadRequestRef = useRef(0);
  const activeRef = useRef(false);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [hoverPending, setHoverPending] = useState(false);

  const releaseVideo = () => {
    loadRequestRef.current += 1;
    cancelAnimationFrame(frameRef.current);
    window.clearTimeout(hoverDelayRef.current);
    frameRef.current = 0;
    hoverDelayRef.current = 0;
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
    activeRef.current = false;
    setActive(false);
    setHoverPending(false);
    setReady(false);
  };

  useEffect(() => releaseVideo, []);

  const startForwardPlayback = () => {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_METADATA) return;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    video.pause();
    video.playbackRate = 1;
    video.onended = null;
    const forwardDuration = story.previewDurationSeconds || 3;
    const currentProgress = resolveVisualPreviewProgress(
      video.currentTime,
      forwardDuration,
      video.duration,
      story.previewReturnDurationSeconds
    );
    const targetTime = currentProgress * Math.max(0, forwardDuration - 0.001);
    const watchForwardPlayback = () => {
      if (!activeRef.current || !video.getAttribute('src')) {
        frameRef.current = 0;
        return;
      }
      if (video.currentTime >= forwardDuration - 0.025) {
        video.pause();
        video.currentTime = Math.max(0, forwardDuration - 0.001);
        frameRef.current = 0;
        return;
      }
      frameRef.current = requestAnimationFrame(watchForwardPlayback);
    };
    const playForward = () => {
      if (!activeRef.current || !video.getAttribute('src')) return;
      video.play().then(() => {
        if (!activeRef.current) {
          video.pause();
          return;
        }
        setHoverPending(false);
        frameRef.current = requestAnimationFrame(watchForwardPlayback);
      }).catch(() => {
        setHoverPending(false);
        releaseVideo();
      });
    };
    if (Math.abs(video.currentTime - targetTime) > 0.025) {
      video.addEventListener('seeked', playForward, { once: true });
      video.currentTime = targetTime;
    } else {
      playForward();
    }
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

  const activate = (event) => {
    if (!hasPreview || event.pointerType === 'touch' || !window.matchMedia('(hover: hover)').matches) return;
    window.clearTimeout(hoverDelayRef.current);
    setHoverPending(true);
    ensureVideoLoaded();
    hoverDelayRef.current = window.setTimeout(() => {
      hoverDelayRef.current = 0;
      activeRef.current = true;
      setActive(true);
      startForwardPlayback();
    }, HOVER_PLAY_DELAY_MS);
  };

  const updatePreviewLook = (event) => {
    if (!hasPreview || event.pointerType === 'touch') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const lookOffset = resolvePreviewLookOffset(event.clientX, bounds.left, bounds.width);
    event.currentTarget.style.setProperty('--preview-look-x', `${lookOffset}%`);
  };

  const deactivate = (event) => {
    event.currentTarget.style.setProperty('--preview-look-x', '0%');
    window.clearTimeout(hoverDelayRef.current);
    hoverDelayRef.current = 0;
    activeRef.current = false;
    setActive(false);
    setHoverPending(false);
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    // currentTime bleibt absichtlich unverändert, damit der nächste Hover
    // exakt an diesem Frame weiterläuft.
    videoRef.current?.pause();
  };

  const prepareVideoForPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    const finish = () => {
      const reveal = () => {
        if (!video.getAttribute('src')) return;
        setReady(true);
        if (activeRef.current) startForwardPlayback();
      };
      if (video.currentTime < 0.012) {
        video.currentTime = 0;
        reveal();
        return;
      }
      video.addEventListener('seeked', reveal, { once: true });
      video.currentTime = 0;
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
    <div ref={containerRef} className={`${className} story-preview-media${hasPreview ? ' has-story-preview' : ''}${ready ? ' is-video-ready' : ''}${hoverPending ? ' is-hover-pending' : ''}${active && ready ? ' is-preview-active' : ''}`}
      onPointerEnter={activate} onPointerMove={updatePreviewLook} onPointerLeave={deactivate}>
      {!ready && (
        <div className={`${mediaClassName} story-preview-poster`} style={{ backgroundImage: `url("${story.coverImage || fallbackImage}")` }} />
      )}
      {hasPreview && (
        <>
          <video ref={videoRef} className="story-preview-video" muted playsInline preload="none"
            onLoadedMetadata={prepareVideoForPlayback} aria-hidden="true" />
          <div className="story-preview-hover-cue" aria-hidden="true">
            <span className="story-preview-hover-ring">
              <svg viewBox="0 0 44 44">
                <circle className="story-preview-hover-track" cx="22" cy="22" r="19" />
                <circle className="story-preview-hover-progress" cx="22" cy="22" r="19" />
              </svg>
              <i />
            </span>
            <small>Vorschau</small>
          </div>
        </>
      )}
      {children}
    </div>
  );
}
