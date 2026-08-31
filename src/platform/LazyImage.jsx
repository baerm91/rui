import React, { useEffect, useRef, useState } from 'react';

// Unlike native lazy loading alone, this avoids even assigning a URL to distant
// cards. The parent reserves the image's dimensions, so nothing shifts on load.
export function LazyImage({ src, fallback, className = '', priority = false, onLoad }) {
  const imageRef = useRef(null);
  const [inRange, setInRange] = useState(priority);
  const [source, setSource] = useState(src || fallback);
  const [state, setState] = useState('pending');

  useEffect(() => {
    if (inRange) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setInRange(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setInRange(true);
      observer.disconnect();
    }, { rootMargin: '100px' });
    if (imageRef.current) observer.observe(imageRef.current);
    return () => observer.disconnect();
  }, [inRange]);

  return <img ref={imageRef} className={`${className} lazy-image`} src={inRange && source ? source : undefined}
    alt="" loading={priority ? 'eager' : 'lazy'} decoding="async" fetchPriority={priority ? 'high' : 'low'}
    data-image-state={state} onLoad={(event) => { setState('loaded'); onLoad?.(event); }} onError={() => {
      if (fallback && source !== fallback) {
        setSource(fallback);
      } else {
        setState('error');
      }
    }} />;
}
