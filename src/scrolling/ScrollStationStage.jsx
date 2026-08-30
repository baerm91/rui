import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight, Eye } from 'lucide-react';
import { resolveSpatialThumbnailUrl } from '../utils/spatialStory.js';
import { getStationRendererDescriptor, normalizeStationBehavior } from '../utils/stationBehavior.js';
import { normalizeStationRelations } from '../utils/stationRelations.js';
import { normalizeNarrativeSteps } from '../utils/stationNarrative.js';

gsap.registerPlugin(ScrollTrigger);

const POINTS = {
  cluster: [[50, 21], [26, 37], [74, 37], [34, 72], [68, 70], [51, 53]],
  grid: [[25, 28], [50, 28], [75, 28], [25, 70], [50, 70], [75, 70]],
  orbit: [[50, 17], [78, 34], [72, 70], [50, 82], [25, 68], [22, 35]],
  timeline: [[17, 34], [31, 64], [45, 34], [59, 64], [73, 34], [87, 64]],
  freeform: [[18, 27], [47, 18], [76, 32], [29, 73], [58, 62], [82, 76]]
};

const safeItems = (station) => Array.isArray(station?.items) ? station.items.filter(Boolean).slice(0, 6) : [];

export default function ScrollStationStage({ station, stationIndex, onOpen, openItemId }) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const sceneRef = useRef(null);
  const lightRef = useRef(null);
  const kickerRef = useRef(null);
  const particlesRef = useRef(null);
  const relationCopyRef = useRef(null);
  const narrativeRef = useRef(null);
  const pointerFrameRef = useRef(0);
  const pointerEventRef = useRef(null);
  const [activeItemId, setActiveItemId] = useState('');
  const [discovered, setDiscovered] = useState(() => new Set());
  const behavior = normalizeStationBehavior(station?.behavior);
  const renderer = getStationRendererDescriptor(behavior);
  const items = safeItems(station);
  const narrativeSteps = normalizeNarrativeSteps(station?.narrativeSteps, items);
  const narrativeLinkSignature = narrativeSteps.map((step) => step.itemId || '').join('|');
  const sequentialNarrative = behavior.motion.progressiveText && behavior.layout === 'timeline';
  const points = POINTS[behavior.layout] || POINTS.cluster;
  const hubId = station?.initialItemId || items[0]?.id || '';
  const relations = useMemo(() => {
    const authored = normalizeStationRelations(station?.relations, items);
    return authored.length ? authored : items.slice(1).map((item, index) => ({ id: `visual-${index}`, fromItemId: hubId, toItemId: item.id, label: '' }));
  }, [hubId, items, station?.relations]);
  const activeRelation = relations.find((relation) => activeItemId && [relation.fromItemId, relation.toItemId].includes(activeItemId));
  const relatedIds = new Set(relations.flatMap((relation) => {
    if (relation.fromItemId === activeItemId) return [relation.toItemId];
    if (relation.toItemId === activeItemId) return [relation.fromItemId];
    return [];
  }));

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      root.classList.toggle('is-stage-nearby', entry.isIntersecting);
    }, { rootMargin: '70% 0px', threshold: 0 });
    observer.observe(root);
    return () => {
      observer.disconnect();
      if (pointerFrameRef.current) cancelAnimationFrame(pointerFrameRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const scene = sceneRef.current;
    if (!root || !stage || !scene || items.length < 2) return undefined;
    let media;
    let context;
    let refreshFrame;
    const setupFrame = requestAnimationFrame(() => {
      if (!root.isConnected || !stage.isConnected || !scene.isConnected) return;
      context = gsap.context(() => {
        media = gsap.matchMedia();
        media.add('(min-width: 761px) and (prefers-reduced-motion: no-preference)', () => {
          const objects = Array.from(scene.querySelectorAll('.stage-object'));
          const labels = Array.from(scene.querySelectorAll('.stage-object-label'));
          const lines = Array.from(scene.querySelectorAll('.stage-relation-line'));
          const narrative = narrativeRef.current ? Array.from(narrativeRef.current.querySelectorAll('.stage-narrative-step')) : [];
          const objectMoments = [];
          if (!objects.length) return undefined;
          const entranceState = behavior.entrance === 'fade'
            ? { scale: .96, opacity: .78 }
            : behavior.entrance === 'rise'
              ? { scale: .9, opacity: .76, y: 34 }
              : { scale: .78, opacity: behavior.entrance === 'from-darkness' ? .58 : .72 };
          gsap.set(labels, { opacity: .72, y: 6 });
          if (lines.length) gsap.set(lines, { opacity: 0, scaleX: 0, transformOrigin: '0 50%' });
          if (narrative.length) gsap.set(narrative, { opacity: sequentialNarrative ? (index) => index === 0 ? 1 : .72 : .9, y: sequentialNarrative ? (index) => index === 0 ? 0 : 6 : 0 });

          const timeline = gsap.timeline({ scrollTrigger: {
            trigger: root,
            start: renderer.pin ? 'top 68px' : 'top 92%',
            end: renderer.pin ? () => `+=${Math.max(window.innerHeight * renderer.distance, 1050)}` : 'bottom 18%',
            pin: renderer.pin ? stage : false,
            scrub: true,
            anticipatePin: 1,
            invalidateOnRefresh: true
          } });

          const setFinalPoint = (object, index, extra = {}) => timeline.to(object, { left: `${points[index][0]}%`, top: `${points[index][1]}%`, opacity: 1, duration: .46, ease: 'power2.inOut', ...extra }, .04 + index * .012);
          if (behavior.scroll === 'horizontal') {
            objects.forEach((object, index) => gsap.set(object, { left: `${50 + index * 34}%`, top: `${index % 2 ? 61 : 38}%`, xPercent: -50, yPercent: -50, scale: index ? .88 : 1.08, opacity: index ? .7 : 1 }));
            timeline.to(scene, { x: () => -Math.max(0, objects.length - 1) * window.innerWidth * .31, duration: 1, ease: 'none' }, 0);
            objects.forEach((object, index) => timeline.to(object, { scale: 1.08, opacity: 1, duration: .18 }, Math.min(.82, index / Math.max(1, objects.length - 1) * .78)));
          } else if (behavior.layout === 'orbit') {
            const orbitState = { progress: 0 };
            const orbitSize = { width: scene.clientWidth, height: scene.clientHeight };
            objects.forEach((object, index) => gsap.set(object, { left: '50%', top: '50%', xPercent: -50, yPercent: -50, opacity: .82, scale: .78 + (index % 3) * .1 }));
            const renderOrbit = () => {
              objects.forEach((object, index) => {
                const [finalX, finalY] = points[index];
                const dx = finalX - 50; const dy = finalY - 50;
                const angle = (-135 * (1 - orbitState.progress)) * Math.PI / 180;
                const contraction = .72 + orbitState.progress * .28;
                gsap.set(object, { x: (dx * Math.cos(angle) - dy * Math.sin(angle)) * contraction * orbitSize.width / 100, y: (dx * Math.sin(angle) + dy * Math.cos(angle)) * contraction * orbitSize.height / 100, rotationY: 24 * (1 - orbitState.progress), scale: .78 + orbitState.progress * .22, opacity: .82 + orbitState.progress * .18 });
              });
            };
            renderOrbit();
            timeline.to(orbitState, { progress: 1, duration: .78, ease: 'none', onUpdate: renderOrbit }, 0);
          } else if (behavior.layout === 'timeline') {
            objects.forEach((object, index) => gsap.set(object, { left: '68%', top: `${42 + (index % 2) * 13}%`, xPercent: -50, yPercent: -50, scale: .68, opacity: .12 }));
            objects.forEach((object, index) => {
              const moment = .08 + index / Math.max(1, objects.length - 1) * .68;
              objectMoments[index] = moment;
              if (index) timeline.to(objects[index - 1], { left: '25%', scale: .62, opacity: .2, duration: .16 }, moment);
              timeline.to(object, { left: '50%', top: '48%', scale: 1.12, opacity: 1, duration: .2, ease: 'power2.out' }, moment);
            });
          } else {
            const scales = behavior.layout === 'cluster' ? [1.18, .82, .72, .98, .78, 1.04] : behavior.layout === 'freeform' ? [.78, 1.16, .88, 1.05, .7, .94] : [1, .9, 1.05, .88, 1.08, .94];
            objects.forEach((object, index) => gsap.set(object, { left: `${50 + (points[index][0] - 50) * .25}%`, top: `${50 + (points[index][1] - 50) * .25}%`, xPercent: -50, yPercent: -50, rotationZ: behavior.layout === 'freeform' ? (index % 2 ? 5 : -4) : 0, ...entranceState }));
            objects.forEach((object, index) => setFinalPoint(object, index, { scale: scales[index] || 1, rotationZ: behavior.layout === 'freeform' ? (index % 2 ? -3 : 2) : 0 }));
          }

          if (lightRef.current) timeline.to(lightRef.current, { opacity: .9, scale: 1.15, duration: .45 }, .05);
          if (behavior.scroll === 'zoom') {
            const focusObject = objects.find((object) => object.dataset.itemId === hubId) || objects[0];
            const others = objects.filter((object) => object !== focusObject);
            if (others.length) timeline.to(others, { opacity: .08, scale: .62, duration: .2 }, .52);
            timeline.to(focusObject, { left: '50%', top: '50%', scale: 3.6, zIndex: 8, duration: .26, ease: 'power2.in' }, .5)
              .to(focusObject, { scale: 1.08, duration: .2, ease: 'power2.out' }, .82);
            if (others.length) timeline.to(others, { opacity: .72, duration: .18 }, .82);
          }
          if (behavior.scroll === 'camera-motion') {
            timeline.fromTo(scene, { rotationY: -11, rotationX: 3, xPercent: -4, scale: .9 }, { rotationY: 10, rotationX: -2, xPercent: 5, scale: 1.08, transformOrigin: '50% 50%', duration: .5, ease: 'sine.inOut' }, 0)
              .to(scene, { rotationY: -5, rotationX: 1, xPercent: 0, scale: .96, duration: .42, ease: 'sine.inOut' }, .55);
            objects.forEach((object, index) => timeline.to(object, { z: (index % 3 - 1) * 140, y: index % 2 ? -26 : 24, duration: .65 }, .12));
          }
          if (behavior.motion.parallax) {
            if (lightRef.current) timeline.to(lightRef.current, { yPercent: -18, xPercent: 4, duration: .8 }, .15);
            if (kickerRef.current) timeline.to(kickerRef.current, { y: -22, duration: .7 }, .08);
            if (particlesRef.current) timeline.to(particlesRef.current, { yPercent: -9, xPercent: 3, duration: .82 }, .08);
            if (relationCopyRef.current) timeline.to(relationCopyRef.current, { y: 18, duration: .7 }, .2);
            objects.forEach((object, index) => timeline.to(object, { y: index % 3 === 0 ? -28 : index % 3 === 1 ? 10 : 34, duration: .45 }, .5));
          }
          if (labels.length) timeline.to(labels, { opacity: 1, y: 0, duration: .14, stagger: .018 }, behavior.layout === 'cluster' ? .28 : .48);
          if (behavior.interactions.connections && lines.length) timeline.to(lines, { opacity: .72, scaleX: 1, duration: .2, stagger: .025 }, .64);
          if (relationCopyRef.current) timeline.to(relationCopyRef.current, { opacity: 1, duration: .14 }, .72);
          if (narrative.length && sequentialNarrative) narrative.forEach((step, index) => {
            const linkedObjectIndex = narrativeSteps[index]?.itemId
              ? objects.findIndex((object) => object.dataset.itemId === narrativeSteps[index].itemId)
              : index;
            const moment = behavior.layout === 'timeline'
              ? (objectMoments[Math.max(0, linkedObjectIndex)] ?? objectMoments[index] ?? .48)
              : .48 + index * .12;
            if (index) timeline.to(narrative[index - 1], { opacity: .72, y: -4, duration: .06 }, moment);
            timeline.to(step, { opacity: 1, y: 0, duration: .1 }, moment);
          });
          else if (narrative.length) timeline.to(narrative, { opacity: 1, y: 0, duration: .08 }, behavior.layout === 'cluster' ? .16 : .38);
          refreshFrame = requestAnimationFrame(() => { if (root.isConnected) ScrollTrigger.refresh(); });
          return () => timeline.scrollTrigger?.kill();
        });
      }, root);
    });
    return () => { cancelAnimationFrame(setupFrame); if (refreshFrame) cancelAnimationFrame(refreshFrame); media?.revert(); context?.revert(); };
  }, [behavior.entrance, behavior.interactions.connections, behavior.layout, behavior.motion.parallax, behavior.motion.progressiveText, behavior.scroll, hubId, items.length, narrativeLinkSignature, narrativeSteps.length, renderer.distance, renderer.pin, station?.id]);

  const discover = (itemId) => {
    setActiveItemId(itemId);
    if (behavior.interactions.discoveryMode) setDiscovered((current) => new Set([...current, itemId]));
  };
  const moveStagePointer = (event) => {
    pointerEventRef.current = { clientX: event.clientX, clientY: event.clientY };
    if (pointerFrameRef.current) return;
    pointerFrameRef.current = requestAnimationFrame(() => {
      pointerFrameRef.current = 0;
      const stage = stageRef.current;
      const pointer = pointerEventRef.current;
      if (!stage || !pointer) return;
      const bounds = stage.getBoundingClientRect();
      const objects = behavior.motion.magneticCursor ? Array.from(stage.querySelectorAll('.stage-object')) : [];
      const objectBounds = objects.map((object) => object.getBoundingClientRect());
      const x = pointer.clientX - bounds.left;
      const y = pointer.clientY - bounds.top;
      stage.style.setProperty('--cursor-x', `${x}px`);
      stage.style.setProperty('--cursor-y', `${y}px`);
      if (behavior.interactions.spotlight) {
        stage.style.setProperty('--spot-x', `${x}px`);
        stage.style.setProperty('--spot-y', `${y}px`);
      }
      if (behavior.motion.parallax) {
        stage.style.setProperty('--pointer-x', `${(x / bounds.width - .5) * 2}`);
        stage.style.setProperty('--pointer-y', `${(y / bounds.height - .5) * 2}`);
      }
      objects.forEach((object, index) => {
        const rect = objectBounds[index];
        const dx = pointer.clientX - (rect.left + rect.width / 2);
        const dy = pointer.clientY - (rect.top + rect.height / 2);
        const strength = Math.max(0, 1 - Math.hypot(dx, dy) / 240);
        object.style.setProperty('--mag-x', `${dx * strength * .075}px`);
        object.style.setProperty('--mag-y', `${dy * strength * .075}px`);
      });
    });
  };
  const resetStagePointer = () => {
    if (pointerFrameRef.current) cancelAnimationFrame(pointerFrameRef.current);
    pointerFrameRef.current = 0;
    stageRef.current?.querySelectorAll('.stage-object').forEach((object) => { object.style.setProperty('--mag-x', '0px'); object.style.setProperty('--mag-y', '0px'); });
  };
  return <div ref={rootRef} className={`station-stage-shell ${renderer.layoutClass} ${renderer.scrollClass} ${renderer.motionClass} entrance-${behavior.entrance} atmosphere-${behavior.atmosphere.theme}`} style={{ '--station-accent': behavior.atmosphere.accent }}>
    <div ref={stageRef} className={`station-stage ${activeItemId ? 'has-active-object' : ''} ${behavior.interactions.spotlight ? 'has-spotlight' : ''} ${behavior.interactions.discoveryMode ? 'has-discovery' : ''} ${behavior.motion.floating ? 'has-floating' : ''} ${behavior.motion.depthOfField ? 'has-depth' : ''} ${behavior.motion.clusterExplode ? 'has-explode' : ''}`} onPointerMove={moveStagePointer} onPointerLeave={resetStagePointer}>
      {behavior.atmosphere.grain && <div className="stage-grain" aria-hidden="true" />}
      {behavior.atmosphere.particles && <div ref={particlesRef} className="stage-particles" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} style={{ '--particle-index': index }} />)}</div>}
      <div ref={lightRef} className="stage-light" aria-hidden="true" />
      <div ref={kickerRef} className="stage-kicker"><span>Station {String(stationIndex + 1).padStart(2, '0')}</span><b>{behavior.layout === 'orbit' ? 'Objekte im Umlauf' : behavior.layout === 'timeline' ? 'Objekte in Folge' : behavior.scroll === 'horizontal' ? 'Horizontaler Rundgang' : behavior.scroll === 'zoom' ? 'Annäherung' : behavior.scroll === 'camera-motion' ? 'Perspektivwechsel' : 'Objektkonstellation'}</b></div>
      {behavior.layout === 'orbit' && <div className="stage-orbit-geometry" aria-hidden="true"><i /><i /><i /></div>}
      {behavior.layout === 'timeline' && <div className="stage-timeline-geometry" aria-hidden="true"><i /></div>}
      {(behavior.layout === 'cluster' || behavior.scroll === 'camera-motion') && <div className="stage-depth-geometry" aria-hidden="true"><i /><i /><i /></div>}
      <div ref={sceneRef} className={`stage-scene ${renderer.layoutClass} ${renderer.scrollClass}`}>
        {behavior.interactions.connections && relations.map((relation, index) => {
          const { fromItemId: fromId, toItemId: toId } = relation;
          const fromIndex = Math.max(0, items.findIndex((item) => item.id === fromId));
          const toIndex = Math.max(0, items.findIndex((item) => item.id === toId));
          const [x1, y1] = points[fromIndex]; const [x2, y2] = points[toIndex];
          const length = Math.hypot(x2 - x1, y2 - y1); const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
          return <i key={relation.id || `${fromId}-${toId}-${index}`} className={`stage-relation-line ${activeItemId && ![fromId, toId].includes(activeItemId) ? 'is-muted' : ''}`} style={{ left: `${x1}%`, top: `${y1}%`, width: `${length}%`, transform: `rotate(${angle}deg)`, '--relation-angle': `${angle}deg` }} aria-hidden="true"><span>{relation.label}</span></i>;
        })}
        {items.map((item, index) => {
          const image = resolveSpatialThumbnailUrl(item);
          const active = activeItemId === item.id;
          const related = relatedIds.has(item.id);
          const hidden = behavior.interactions.discoveryMode && !discovered.has(item.id) && !active;
          const muted = behavior.interactions.objectFocus && activeItemId && !active && !related;
          return <button key={item.id || index} type="button" className={`stage-object depth-${index % 3} ${active ? 'is-active' : ''} ${muted ? 'is-muted' : ''} ${hidden ? 'is-undiscovered' : ''}`}
            data-item-id={item.id}
            style={{ left: `${points[index][0]}%`, top: `${points[index][1]}%`, '--depth': index % 3, '--float-delay': `${index * -.7}s`, viewTransitionName: openItemId === item.id ? 'none' : `riu-object-${item.id || index}` }}
            onPointerEnter={() => discover(item.id)} onPointerLeave={(event) => { setActiveItemId(''); event.currentTarget.style.setProperty('--rx', '0deg'); event.currentTarget.style.setProperty('--ry', '0deg'); }} onFocus={() => discover(item.id)} onBlur={() => setActiveItemId('')}
            onPointerMove={(event) => { if (!behavior.interactions.hoverTilt) return; const rect = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty('--rx', `${((event.clientY - rect.top) / rect.height - .5) * -7}deg`); event.currentTarget.style.setProperty('--ry', `${((event.clientX - rect.left) / rect.width - .5) * 7}deg`); }}
            onClick={(event) => onOpen(item, behavior.viewerTransition, event.currentTarget)} aria-label={`${item.title || `Objekt ${index + 1}`} öffnen`}>
            <span className="stage-object-art">{image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <b>{String(index + 1).padStart(2, '0')}</b>}</span>
            <span className="stage-object-label"><b>{item.title || `Objekt ${index + 1}`}</b><small>{item.attribution || item.license || 'Sammlungsobjekt'}</small></span>
            <i className="stage-object-open"><ArrowUpRight size={15} /></i>
          </button>;
        })}
      </div>
      <div ref={relationCopyRef} className="stage-relation-copy"><span>{activeRelation?.label || (activeItemId ? 'Objekt im Zusammenhang' : 'Beziehungen lesen')}</span><p>{activeRelation?.description || (activeItemId ? items.find((item) => item.id === activeItemId)?.description : 'Ein Objekt tritt hervor, verwandte Stücke antworten. Öffne es, um vom Überblick in die 3D-Nahsicht zu wechseln.')}</p></div>
      {narrativeSteps.length > 0 && <div ref={narrativeRef} className="stage-narrative" aria-label="Kuratorische Erzählmomente">{narrativeSteps.map((step, index) => <article key={step.id} className="stage-narrative-step"><span>{step.eyebrow || `Moment ${String(index + 1).padStart(2, '0')}`}</span><b>{step.title}</b>{step.text && <p>{step.text}</p>}</article>)}</div>}
      {behavior.interactions.discoveryMode && <div className="stage-discovery-count"><Eye size={14} /> {discovered.size} von {items.length} entdeckt</div>}
      <div className="stage-cursor-feedback" aria-hidden="true"><span /></div>
    </div>
  </div>;
}
