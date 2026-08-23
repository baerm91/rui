import React, { useEffect, useRef } from 'react';
import { attachStoryRelight, detachStoryRelight, moveStoryRelight } from './storyRelight.js';
import { resolveRelightPointer } from './storyRelightMath.js';

export function StoryPreviewMedia({ story, className, mediaClassName, fallbackImage, children }) {
  const mountRef = useRef(null);
  const imageUrl = story.coverImage || fallbackImage;
  const depthMapUrl = story.coverDepthMap || story.depthMap || '';

  const updatePointer = (event) => {
    if (event.pointerType === 'touch') return null;
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointer = resolveRelightPointer(
      event.clientX,
      event.clientY,
      bounds.left,
      bounds.top,
      bounds.width,
      bounds.height
    );
    event.currentTarget.style.setProperty('--relight-x', `${pointer.x * 100}%`);
    event.currentTarget.style.setProperty('--relight-y', `${pointer.y * 100}%`);
    return pointer;
  };

  const activate = (event) => {
    if (event.pointerType === 'touch' || !window.matchMedia('(hover: hover)').matches) return;
    const pointer = updatePointer(event);
    if (!pointer || !mountRef.current) return;
    attachStoryRelight({
      mount: mountRef.current,
      owner: event.currentTarget,
      imageUrl,
      depthMapUrl,
      pointer
    });
  };

  const moveLight = (event) => {
    const pointer = updatePointer(event);
    if (pointer && mountRef.current) moveStoryRelight(mountRef.current, pointer);
  };

  const deactivate = () => {
    if (mountRef.current) detachStoryRelight(mountRef.current);
  };

  useEffect(() => {
    const mount = mountRef.current;
    return () => {
      if (mount) detachStoryRelight(mount);
    };
  }, []);

  return (
    <div className={`${className} story-preview-media`}
      onPointerEnter={activate} onPointerMove={moveLight} onPointerLeave={deactivate}>
      <div className={`${mediaClassName} story-preview-poster`} style={{ backgroundImage: `url("${imageUrl}")` }} />
      <div className={`${mediaClassName} story-relight-color`} style={{ backgroundImage: `url("${imageUrl}")` }} aria-hidden="true" />
      <span ref={mountRef} className="story-relight-mount" aria-hidden="true" />
      {children}
    </div>
  );
}
