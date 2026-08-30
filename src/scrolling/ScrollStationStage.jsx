import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight, Eye } from 'lucide-react';
import { resolveSpatialThumbnailUrl } from '../utils/spatialStory.js';
import { normalizeStationBehavior } from '../utils/stationBehavior.js';
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
  const [activeItemId, setActiveItemId] = useState('');
  const [discovered, setDiscovered] = useState(() => new Set());
  const behavior = normalizeStationBehavior(station?.behavior);
  const items = safeItems(station);
  const narrativeSteps = normalizeNarrativeSteps(station?.narrativeSteps, items);
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

  useLayoutEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage || items.length < 2) return undefined;
    let media;
    const context = gsap.context(() => {
      media = gsap.matchMedia();
      media.add('(min-width: 761px) and (prefers-reduced-motion: no-preference)', () => {
        const objects = gsap.utils.toArray('.stage-object');
        const labels = gsap.utils.toArray('.stage-object-label');
        const lines = gsap.utils.toArray('.stage-relation-line');
        const narrative = gsap.utils.toArray('.stage-narrative-step');
        const entranceState = behavior.entrance === 'fade'
          ? { scale: .96, opacity: .78, filter: 'none' }
          : behavior.entrance === 'rise'
            ? { scale: .9, opacity: .76, filter: 'none', y: 34 }
            : { scale: .78, opacity: .72, filter: behavior.entrance === 'from-darkness' ? 'brightness(.84)' : 'brightness(.92)' };
        objects.forEach((object, index) => gsap.set(object, { left: `${50 + (points[index][0] - 50) * .32}%`, top: `${50 + (points[index][1] - 50) * .32}%`, xPercent: -50, yPercent: -50, ...entranceState }));
        gsap.set(labels, { opacity: .68, y: 7 });
        gsap.set(lines, { opacity: 0, scaleX: 0, transformOrigin: '0 50%' });
        gsap.set(narrative, { opacity: (index) => index === 0 ? .82 : .16, y: (index) => index === 0 ? 0 : 10 });
        const timeline = gsap.timeline({ scrollTrigger: {
          trigger: root,
          start: 'top 68px',
          end: () => `+=${Math.max(window.innerHeight * 1.65, 1200)}`,
          pin: behavior.scroll === 'pinned' ? stage : false,
          scrub: .65,
          anticipatePin: 1,
          invalidateOnRefresh: true
        } });
        timeline.to(objects, { opacity: 1, scale: .82, filter: 'brightness(.94)', duration: .18, stagger: .02 }, 0);
        objects.forEach((object, index) => timeline.to(object, { left: `${points[index][0]}%`, top: `${points[index][1]}%`, scale: 1, duration: .48, ease: 'power2.inOut' }, .2 + index * .015));
        timeline.to('.stage-light', { opacity: 1, scale: 1.18, duration: .35 }, .05);
        if (behavior.motion.parallax) {
          timeline.to('.stage-light', { yPercent: -12, duration: .75 }, .15);
          objects.forEach((object, index) => timeline.to(object, { y: index % 2 ? -18 : 18, duration: .25 }, .72));
        }
        timeline.to(labels, { opacity: 1, y: 0, duration: .16, stagger: .025 }, .62);
        if (behavior.interactions.connections) timeline.to(lines, { opacity: .55, scaleX: 1, duration: .16, stagger: .02 }, .73);
        timeline.to('.stage-relation-copy', { opacity: 1, y: 0, duration: .16 }, .78);
        if (narrative.length && behavior.motion.progressiveText) narrative.forEach((step, index) => {
          const moment = .56 + index * .105;
          if (index) timeline.to(narrative[index - 1], { opacity: .2, duration: .06 }, moment);
          timeline.to(step, { opacity: 1, y: 0, duration: .09 }, moment);
          const focusId = narrativeSteps[index]?.itemId;
          const focusObject = focusId ? objects.find((object) => object.dataset.itemId === focusId) : null;
          if (focusObject) timeline.to(focusObject, { filter: 'brightness(1.18)', duration: .07 }, moment);
        });
        else if (narrative.length) timeline.to(narrative, { opacity: 1, y: 0, duration: .01 }, .58);
        if (behavior.scroll === 'horizontal') timeline.to('.stage-object-cluster', { xPercent: -8, duration: .2 }, .8);
        if (behavior.scroll === 'zoom') timeline.to(objects, { scale: 1.12, duration: .2, stagger: .015 }, .8);
        if (behavior.scroll === 'camera-motion') timeline.to('.stage-object-cluster', { rotationZ: .8, scale: 1.025, duration: .2 }, .8);
        requestAnimationFrame(() => ScrollTrigger.refresh());
      });
    }, root);
    return () => { media?.revert(); context.revert(); };
  }, [behavior.entrance, behavior.interactions.connections, behavior.layout, behavior.motion.parallax, behavior.motion.progressiveText, behavior.scroll, items.length, narrativeSteps.length, station?.id]);

  const discover = (itemId) => {
    setActiveItemId(itemId);
    if (behavior.interactions.discoveryMode) setDiscovered((current) => new Set([...current, itemId]));
  };
  const moveStagePointer = (event) => {
    const bounds = stageRef.current.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    stageRef.current.style.setProperty('--cursor-x', `${x}px`);
    stageRef.current.style.setProperty('--cursor-y', `${y}px`);
    if (behavior.interactions.spotlight) {
      stageRef.current.style.setProperty('--spot-x', `${x}px`);
      stageRef.current.style.setProperty('--spot-y', `${y}px`);
    }
    if (behavior.motion.parallax) {
      stageRef.current.style.setProperty('--pointer-x', `${(x / bounds.width - .5) * 2}`);
      stageRef.current.style.setProperty('--pointer-y', `${(y / bounds.height - .5) * 2}`);
    }
    if (behavior.motion.magneticCursor) stageRef.current.querySelectorAll('.stage-object').forEach((object) => {
      const objectBounds = object.getBoundingClientRect();
      const dx = event.clientX - (objectBounds.left + objectBounds.width / 2);
      const dy = event.clientY - (objectBounds.top + objectBounds.height / 2);
      const strength = Math.max(0, 1 - Math.hypot(dx, dy) / 240);
      object.style.setProperty('--mag-x', `${dx * strength * .075}px`);
      object.style.setProperty('--mag-y', `${dy * strength * .075}px`);
    });
  };
  const resetStagePointer = () => stageRef.current?.querySelectorAll('.stage-object').forEach((object) => { object.style.setProperty('--mag-x', '0px'); object.style.setProperty('--mag-y', '0px'); });
  return <div ref={rootRef} className={`station-stage-shell layout-${behavior.layout} entrance-${behavior.entrance} scroll-${behavior.scroll} atmosphere-${behavior.atmosphere.theme}`} style={{ '--station-accent': behavior.atmosphere.accent }}>
    <div ref={stageRef} className={`station-stage ${activeItemId ? 'has-active-object' : ''} ${behavior.interactions.spotlight ? 'has-spotlight' : ''} ${behavior.interactions.discoveryMode ? 'has-discovery' : ''} ${behavior.motion.floating ? 'has-floating' : ''} ${behavior.motion.depthOfField ? 'has-depth' : ''} ${behavior.motion.clusterExplode ? 'has-explode' : ''}`} onPointerMove={moveStagePointer} onPointerLeave={resetStagePointer}>
      {behavior.atmosphere.grain && <div className="stage-grain" aria-hidden="true" />}
      {behavior.atmosphere.particles && <div className="stage-particles" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ '--particle-index': index }} />)}</div>}
      <div className="stage-light" aria-hidden="true" />
      <div className="stage-kicker"><span>Station {String(stationIndex + 1).padStart(2, '0')}</span><b>Objektkonstellation</b></div>
      <div className="stage-object-cluster">
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
            <span className="stage-object-art">{image ? <img src={image} alt="" loading="lazy" onLoad={() => ScrollTrigger.refresh()} /> : <b>{String(index + 1).padStart(2, '0')}</b>}</span>
            <span className="stage-object-label"><b>{item.title || `Objekt ${index + 1}`}</b><small>{item.attribution || item.license || 'Sammlungsobjekt'}</small></span>
            <i className="stage-object-open"><ArrowUpRight size={15} /></i>
          </button>;
        })}
      </div>
      <div className="stage-relation-copy"><span>{activeRelation?.label || (activeItemId ? 'Objekt im Zusammenhang' : 'Beziehungen lesen')}</span><p>{activeRelation?.description || (activeItemId ? items.find((item) => item.id === activeItemId)?.description : 'Ein Objekt tritt hervor, verwandte Stücke antworten. Öffne es, um vom Überblick in die 3D-Nahsicht zu wechseln.')}</p></div>
      {narrativeSteps.length > 0 && <div className="stage-narrative" aria-label="Kuratorische Erzählmomente">{narrativeSteps.map((step, index) => <article key={step.id} className="stage-narrative-step"><span>{step.eyebrow || `Moment ${String(index + 1).padStart(2, '0')}`}</span><b>{step.title}</b>{step.text && <p>{step.text}</p>}</article>)}</div>}
      {behavior.interactions.discoveryMode && <div className="stage-discovery-count"><Eye size={14} /> {discovered.size} von {items.length} entdeckt</div>}
      <div className="stage-cursor-feedback" aria-hidden="true"><span /></div>
    </div>
  </div>;
}
