import { useEffect } from 'react';
import { getTimelineScrollLimits, getTimelineScrollStep } from '../utils/timelineScroll.js';

export function useScrollMode(appState) {
  // Scroll listener for landing page scroll mode
  useEffect(() => {
    if (appState.mode === 'reveal' && appState.stationMode === 'scroll') {
      document.body.style.overflowY = 'auto';
      document.body.style.overflowX = 'hidden';
      const scrollLimits = getTimelineScrollLimits(window.innerHeight, appState.scrollSpeed);

      const handleScroll = () => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const rawProgress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
        const progress = Math.max(0, Math.min(1, rawProgress));
        window.appState?.updateScrollProgress?.(progress);
      };

      let pendingWheelDelta = 0;
      let wheelFrame = null;
      let previousFrameTime = null;

      const flushLimitedWheel = (frameTime) => {
        wheelFrame = null;
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const elapsedMs = previousFrameTime === null ? 16 : frameTime - previousFrameTime;
        previousFrameTime = frameTime;
        const step = getTimelineScrollStep(
          pendingWheelDelta,
          elapsedMs,
          scrollLimits.maxPixelsPerSecond
        );
        const nextScrollY = Math.max(0, Math.min(maxScroll, window.scrollY + step));

        pendingWheelDelta -= step;
        window.scrollTo({ top: nextScrollY, behavior: 'auto' });

        const reachedBoundary = nextScrollY <= 0 || nextScrollY >= maxScroll - 1;
        if (reachedBoundary) pendingWheelDelta = 0;
        if (Math.abs(pendingWheelDelta) > 0.5) {
          wheelFrame = window.requestAnimationFrame(flushLimitedWheel);
        } else {
          previousFrameTime = null;
        }
      };

      const limitTimelineWheel = (event) => {
        if (event.deltaY === 0 || event.ctrlKey) return;
        if (event.target instanceof Element && event.target.closest('[data-wheel-scroll]')) return;

        const liveState = window.appState;
        const activeStation = liveState?.stations?.[liveState.currentStationIndex];
        const freeNavigationIsActive = activeStation?.freeNavigation
          && liveState.freeNavigationActive
          && liveState.freeNavigationStationId === activeStation.id;
        if (freeNavigationIsActive) {
          // Keep the document fixed and hand wheel input to the damped free-view
          // zoom instead of OrbitControls' immediate, step-based wheel zoom.
          event.preventDefault();
          event.stopPropagation();
          liveState.smoothFreeNavigationZoom?.(event.deltaY, event.deltaMode);
          pendingWheelDelta = 0;
          previousFrameTime = null;
          if (wheelFrame !== null) {
            window.cancelAnimationFrame(wheelFrame);
            wheelFrame = null;
          }
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const deltaScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? window.innerHeight
            : 1;
        const pixelDelta = event.deltaY * deltaScale;
        if (pendingWheelDelta !== 0 && Math.sign(pendingWheelDelta) !== Math.sign(pixelDelta)) {
          pendingWheelDelta = 0;
        }
        pendingWheelDelta = Math.max(
          -scrollLimits.maxBufferedDelta,
          Math.min(scrollLimits.maxBufferedDelta, pendingWheelDelta + pixelDelta)
        );

        if (wheelFrame === null) {
          wheelFrame = window.requestAnimationFrame(flushLimitedWheel);
        }
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('wheel', limitTimelineWheel, { passive: false, capture: true });
      handleScroll();

      return () => {
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('wheel', limitTimelineWheel, { capture: true });
        if (wheelFrame !== null) window.cancelAnimationFrame(wheelFrame);
      };
    } else if (appState.stationMode === 'editor') {
      document.body.style.overflow = 'hidden';
    }
  }, [appState.mode, appState.stationMode, appState.scrollSpeed]);

  const scrollToStation = (index) => {
    if (appState.stationMode !== 'scroll') return;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return;
    const intervalSize = 1.0 / (appState.stations.length - 1);
    const scrollTargetFraction = index * intervalSize;
    window.scrollTo({ top: scrollTargetFraction * maxScroll, behavior: 'smooth' });
  };

  return { scrollToStation };
}
