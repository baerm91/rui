import React from 'react';

/**
 * Parses *highlight* syntax into gold-colored <span> elements.
 * Used for station titles and descriptions throughout the UI.
 */
export const parseTextWithHighlights = (text, isDescription = false) => {
  if (!text) return "";
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <span key={index} className={`gold-text-gradient ${isDescription ? 'station-description-highlight' : 'font-serif font-black tracking-wide'}`}>
          {part.slice(1, -1)}
        </span>
      );
    }
    if (isDescription) {
      return (
        <span key={index} className="text-[#c8c3bc] font-light">
          {part}
        </span>
      );
    }
    return (
      <span key={index} className="stone-text-gradient font-serif font-bold">
        {part}
      </span>
    );
  });
};

/**
 * Strips *highlight* markers from text for plain display (e.g. in tooltips).
 */
export const stripHighlights = (text) => {
  if (!text) return "";
  return text.replace(/\*/g, '');
};
