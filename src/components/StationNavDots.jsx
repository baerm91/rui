import React, { useState } from 'react';
import { stripHighlights } from '../utils/textFormatting.jsx';

export function StationNavDots({ stations, currentStationIndex, onScrollToStation }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`station-dots-nav station-line-nav fixed right-4 sm:right-6 md:right-8 top-1/2 -translate-y-1/2 z-30 flex flex-col pointer-events-auto items-end select-none ${isExpanded ? 'is-expanded' : ''}`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      onFocus={() => setIsExpanded(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsExpanded(false);
      }}
    >
      {stations.map((s, idx) => {
        const isActive = currentStationIndex === idx;
        const title = stripHighlights(s.title) || `Station ${idx + 1}`;
        return (
          <button
            key={s.id}
            onClick={() => {
              window.audioManager?.playClick();
              onScrollToStation(idx);
            }}
            className="station-line-item relative z-[1] flex items-center group outline-none"
            title={title}
            aria-label={`Zu Station ${idx + 1}: ${title}`}
            aria-current={isActive ? 'step' : undefined}
          >
            <span className="dot-label station-line-label">
              <small>{String(idx + 1).padStart(2, '0')}</small>
              {title}
            </span>
            <span className="station-line-marker" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
