import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { stripHighlights } from '../utils/textFormatting.jsx';

export function StationNavDots({ stations, currentStationIndex, onScrollToStation }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileNavRef = useRef(null);
  const mobileToggleRef = useRef(null);
  const activeTitle = stripHighlights(stations[currentStationIndex]?.title) || `Station ${currentStationIndex + 1}`;
  const goToStation = (index) => {
    setIsMobileMenuOpen(false);
    if (index < 0 || index >= stations.length) return;
    window.audioManager?.playClick();
    onScrollToStation(index);
  };

  useEffect(() => setIsMobileMenuOpen(false), [currentStationIndex]);
  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;
    const closeOnOutsidePointer = (event) => {
      if (!mobileNavRef.current?.contains(event.target)) setIsMobileMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [isMobileMenuOpen]);

  return (
    <>
      <nav
        ref={mobileNavRef}
        className={`station-mobile-nav ${isMobileMenuOpen ? 'is-open' : ''}`}
        aria-label="Stationsnavigation"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsMobileMenuOpen(false);
            requestAnimationFrame(() => mobileToggleRef.current?.focus());
          }
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setIsMobileMenuOpen(false);
        }}
      >
        <button
          ref={mobileToggleRef}
          type="button"
          className="station-mobile-step"
          disabled={currentStationIndex <= 0}
          onClick={() => goToStation(currentStationIndex - 1)}
          aria-label="Vorherige Station"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="station-mobile-current"
          aria-expanded={isMobileMenuOpen}
          aria-controls="station-mobile-menu"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
        >
          <span aria-live="polite">{String(currentStationIndex + 1).padStart(2, '0')} / {String(stations.length).padStart(2, '0')}</span>
          <strong>{activeTitle}</strong>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="station-mobile-step"
          disabled={currentStationIndex >= stations.length - 1}
          onClick={() => goToStation(currentStationIndex + 1)}
          aria-label="Nächste Station"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
        {isMobileMenuOpen && (
          <div id="station-mobile-menu" className="station-mobile-menu" aria-label="Alle Stationen">
            {stations.map((station, index) => {
              const title = stripHighlights(station.title) || `Station ${index + 1}`;
              return (
                <button
                  key={`mobile-${station.id}`}
                  type="button"
                  aria-current={index === currentStationIndex ? 'step' : undefined}
                  onClick={() => goToStation(index)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{title}</strong>
                  {index === currentStationIndex && <small>Aktuell</small>}
                </button>
              );
            })}
          </div>
        )}
      </nav>

      <div
        className={`station-dots-nav station-line-nav fixed right-4 sm:right-6 md:right-8 top-1/2 -translate-y-1/2 z-30 flex flex-col pointer-events-auto items-end select-none ${isExpanded ? 'is-expanded' : ''}`}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        onFocus={() => setIsExpanded(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setIsExpanded(false);
        }}
      >
        {stations.map((station, index) => {
          const isActive = currentStationIndex === index;
          const title = stripHighlights(station.title) || `Station ${index + 1}`;
          return (
            <button
              key={station.id}
              onClick={() => goToStation(index)}
              className="station-line-item relative z-[1] flex items-center group outline-none"
              title={title}
              aria-label={`Zu Station ${index + 1}: ${title}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="dot-label station-line-label">
                <small>{String(index + 1).padStart(2, '0')}</small>
                {title}
              </span>
              <span className="station-line-marker" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </>
  );
}
