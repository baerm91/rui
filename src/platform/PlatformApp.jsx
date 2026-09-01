import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, BarChart3, Box, CalendarDays, Check, ChevronDown, ChevronRight, CircleUserRound, ExternalLink,
  Ban, Camera, Eye, FilePenLine, Globe2, History, Layers3, Library, ListFilter, LockKeyhole, LogIn, LogOut, MapPin, Menu, Moon, Play, Plus, RotateCcw, Search, Settings, ShieldCheck, Sparkles, Sun, Timer, Upload, UserPlus, Users, X
} from 'lucide-react';
import {
  canEditStory, createStory, deleteStory, getStory, getStoryEditors, getStoryPermission, inviteStoryCollaborator,
  isPlatformInitialized, isValidModelUrl, loginWithOAuth, loginWithPassword, logoutUser, normalizeStoryCategories, normalizeStoryCollaborators, platformReady, publishStory,
  readSession, readStories, removeStoryCollaborator, respondToCollaboration,
  saveStory, setDirectLoginPassword, unpublishStory, updateStoryCollaboratorRole, updateStoryMetadata, updateUserProfile, writeStories
} from './platformStore.js';
import { readProjects, updateProjectListingMetadata } from '../projects/projectStore.js';
import { getStoryCreatedAt, getStoryPublishedAt } from './storyDates.js';
import { StoryPreviewMedia } from './StoryPreviewMedia.jsx';
import { canCreateStories, isAdmin, USER_ROLE_LABELS, USER_ROLES } from './accessControl.js';
import {
  fetchAdminUsers, fetchOwnedStoryViewCounts, fetchPlatformAccess, fetchStoryAnalytics, fetchStoryVersions, restoreStoryVersion,
  updateAdminUser, updatePlatformAccess
} from './supabaseStore.js';
import { readRememberLoginPreference } from './supabaseClient.js';
import { filterOwnedStories } from './dashboardStories.js';
import { formatAnalyticsDuration } from './storyAnalytics.js';
import { getPublishedDiscoverStories, getRandomFeaturedDiscoverStoryId } from './discoverStories.js';
import { createAutomaticStoryPreviewImage } from './storyPreviewImage.js';
import { filterStoriesByExperienceKind, getStoryExperienceLabel, isRoomStory } from '../utils/storyExperience.js';
import { getStoryCounts } from './storyCounts.js';
import { resolveSpatialThumbnailUrl } from '../utils/spatialStory.js';
import { registerRiuWebMcpTools } from './webMcp.js';

const go = (path) => { window.location.href = path; };
const getPreferredTheme = () => {
  try {
    const stored = window.localStorage.getItem('riu-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage may be unavailable in hardened browser contexts.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};
document.documentElement.dataset.riuTheme = getPreferredTheme();

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
  : 'Entwurf';

const STORY_LANGUAGES = {
  de: 'Deutsch',
  en: 'Englisch',
  fr: 'Französisch',
  it: 'Italienisch',
  es: 'Spanisch'
};

const STORY_CATEGORIES = ['Archäologie', 'Architektur', 'Kulturerbe', 'Kunst', 'Natur', 'Sonstiges'];
const getStoryLanguage = (story) => story.metadata?.language || story.language || 'de';
const getStoryCategories = (story) => normalizeStoryCategories(
  story.metadata?.categories,
  story.metadata?.category || story.category
);
const getEditorNames = (story) => getStoryEditors(story).map((editor) => editor.name || `@${editor.username}`);
function CategoryPicker({ defaultCategories = ['Kulturerbe'] }) {
  const selected = new Set(normalizeStoryCategories(defaultCategories));
  return (
    <fieldset className="story-category-picker">
      <legend>Kategorien <span>Mehrfachauswahl möglich</span></legend>
      <div>
        {STORY_CATEGORIES.map((category) => (
          <label key={category}>
            <input
              type="checkbox"
              name="categories"
              value={category}
              defaultChecked={selected.has(category)}
            />
            <span>{category}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function StoryFacts({ story, className }) {
  const counts = getStoryCounts(story);
  const facts = [
    { icon: Box, count: counts.models, singular: 'Modell', plural: 'Modelle' },
    { icon: Layers3, count: counts.stations, singular: 'Thema', plural: 'Themen' },
    { icon: MapPin, count: counts.annotations, singular: 'Annotation', plural: 'Annotationen' }
  ];
  const label = facts.map((fact) => `${fact.count} ${fact.count === 1 ? fact.singular : fact.plural}`).join(', ');
  return (
    <div className={className} aria-label={label}>
      {facts.map((fact) => {
        const Icon = fact.icon;
        return <span key={fact.singular}><Icon size={14} /><strong>{fact.count}</strong> {fact.count === 1 ? fact.singular : fact.plural}</span>;
      })}
    </div>
  );
}

const VERSION_REASON_LABELS = {
  autosave: 'Automatischer Stand',
  published: 'Veröffentlichung',
  unpublished: 'Freigabe aufgehoben',
  before_restore: 'Vor Wiederherstellung',
  restored: 'Wiederhergestellt'
};

const createCoverImageFromFile = async (file) => {
  if (!file?.type?.startsWith('image/')) throw new Error('Bitte wählen Sie eine Bilddatei aus.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Das Bild konnte nicht verarbeitet werden.');
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = canvas.width / canvas.height;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;
    if (sourceRatio > targetRatio) {
      sourceWidth = image.naturalHeight * targetRatio;
      sourceX = (image.naturalWidth - sourceWidth) / 2;
    } else {
      sourceHeight = image.naturalWidth / targetRatio;
      sourceY = (image.naturalHeight - sourceHeight) / 2;
    }
    context.fillStyle = '#080907';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const loadPreviewImage = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Das Objektbild konnte nicht geladen werden.');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Für dieses Objekt ist kein gültiges Thumbnail verfügbar.');
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const drawPreviewText = (context, text, x, y, maximumWidth, lineHeight, maximumLines) => {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  let line = '';
  let lineIndex = 0;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maximumWidth || !line) {
      line = candidate;
      continue;
    }
    context.fillText(line, x, y + lineIndex * lineHeight);
    lineIndex += 1;
    if (lineIndex >= maximumLines) return;
    line = word;
  }
  if (line && lineIndex < maximumLines) context.fillText(line, x, y + lineIndex * lineHeight);
};

const createExhibitionPreviewImage = async (story, station, item) => {
  const thumbnailUrl = resolveSpatialThumbnailUrl(item);
  if (!thumbnailUrl) throw new Error('Dieses Objekt besitzt noch kein Thumbnail.');
  const image = await loadPreviewImage(thumbnailUrl);
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 540;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Das Vorschaubild konnte nicht erzeugt werden.');

  context.fillStyle = '#a79c85';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = canvas.width / canvas.height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  if (sourceRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }
  context.save();
  context.globalAlpha = .38;
  context.filter = 'blur(22px)';
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, -28, -28, canvas.width + 56, canvas.height + 56);
  context.restore();
  context.fillStyle = 'rgba(151, 141, 120, .28)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const objectArea = { x: 370, y: 24, width: 560, height: 410 };
  const objectScale = Math.min(objectArea.width / image.naturalWidth, objectArea.height / image.naturalHeight);
  const objectWidth = image.naturalWidth * objectScale;
  const objectHeight = image.naturalHeight * objectScale;
  context.drawImage(
    image,
    objectArea.x + (objectArea.width - objectWidth) / 2,
    objectArea.y + (objectArea.height - objectHeight) / 2,
    objectWidth,
    objectHeight
  );
  const gradient = context.createLinearGradient(0, 0, 560, 0);
  gradient.addColorStop(0, 'rgba(235, 231, 220, .97)');
  gradient.addColorStop(.68, 'rgba(235, 231, 220, .83)');
  gradient.addColorStop(1, 'rgba(235, 231, 220, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 610, canvas.height);
  context.fillStyle = '#a65331';
  context.font = '700 13px Arial, sans-serif';
  context.fillText('STATION 01', 58, 70);
  context.fillStyle = '#292a25';
  context.font = '52px Georgia, serif';
  drawPreviewText(context, station?.title || story.name, 58, 142, 410, 54, 3);
  context.fillStyle = '#555650';
  context.font = '16px Arial, sans-serif';
  drawPreviewText(context, station?.introduction || station?.description || story.description, 60, 330, 360, 25, 4);
  context.fillStyle = 'rgba(235, 231, 220, .9)';
  context.fillRect(610, 455, 310, 58);
  context.fillStyle = '#292a25';
  context.font = '24px Georgia, serif';
  context.fillText(String(item.title || 'Objekt').slice(0, 28), 630, 489);
  return canvas.toDataURL('image/jpeg', .86);
};

function Brand({ compact = false, onClick = () => go('/') }) {
  return (
    <button className="riu-brand" onClick={onClick} aria-label="RIU Startseite">
      <span className="riu-mark"><span /></span>
      {!compact && <span>RIU</span>}
    </button>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState(getPreferredTheme);

  useEffect(() => {
    document.documentElement.dataset.riuTheme = theme;
    try {
      window.localStorage.setItem('riu-theme', theme);
    } catch {
      // The visible theme still works for this session without persistence.
    }
  }, [theme]);

  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      className="riu-theme-toggle"
      type="button"
      aria-label={`${nextTheme === 'dark' ? 'Dunkles' : 'Helles'} Farbschema aktivieren`}
      title={`${nextTheme === 'dark' ? 'Dark' : 'Light'} Mode`}
      onClick={() => setTheme(nextTheme)}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function Header({ session, sticky = false, showThemeToggle = true }) {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const path = window.location.pathname;

  useEffect(() => {
    if (!accountOpen) return undefined;

    const closeAccountMenu = (event) => {
      if (event.key === 'Escape' || !accountMenuRef.current?.contains(event.target)) {
        setAccountOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeAccountMenu);
    document.addEventListener('keydown', closeAccountMenu);
    return () => {
      document.removeEventListener('pointerdown', closeAccountMenu);
      document.removeEventListener('keydown', closeAccountMenu);
    };
  }, [accountOpen]);

  return (
    <header className={`riu-header ${sticky ? 'is-sticky' : ''}`}>
      <Brand />
      <button className="riu-menu" onClick={() => setOpen(!open)} aria-label={open ? 'Menü schließen' : 'Menü öffnen'} aria-expanded={open}>
        {open ? <X /> : <Menu />}
      </button>
      <nav className={open ? 'is-open' : ''}>
        <a className={path === '/' ? 'is-active' : ''} href="/" onClick={() => setOpen(false)}>Home</a>
        <a className={path === '/discover' ? 'is-active' : ''} href="/discover" onClick={() => setOpen(false)}>Discover</a>
        {showThemeToggle && <ThemeToggle />}
        {session ? (
          <div className="riu-account-menu" ref={accountMenuRef}>
            <button
              className="riu-account"
              type="button"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((current) => !current)}
            >
              <CircleUserRound size={17} />
              <span>{session.name}</span>
              <ChevronDown className="riu-account-chevron" size={14} />
            </button>
            {accountOpen && (
              <div className="riu-account-dropdown" role="menu">
                <a href="/account" role="menuitem"><Settings size={16} /> Einstellungen</a>
                <a href="/dashboard" role="menuitem"><Library size={16} /> Meine Stories</a>
                {isAdmin(session) && <a href="/admin" role="menuitem"><ShieldCheck size={16} /> Administration</a>}
                <button type="button" role="menuitem" onClick={async () => { await logoutUser(); go('/'); }}><LogOut size={16} /> Abmelden</button>
              </div>
            )}
          </div>
        ) : (
          <div className="riu-account-menu" ref={accountMenuRef}>
            <button
              className="riu-account riu-account-guest"
              type="button"
              aria-label="Einloggen oder registrieren"
              title="Einloggen oder registrieren"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((current) => !current)}
            >
              <CircleUserRound size={19} />
              <span className="riu-account-guest-label">Einloggen oder registrieren</span>
              <ChevronDown className="riu-account-chevron" size={14} />
            </button>
            {accountOpen && (
              <div className="riu-account-dropdown riu-auth-dropdown" role="menu">
                <span className="riu-account-dropdown-label">Einloggen oder registrieren</span>
                <a href="/login" role="menuitem"><LogIn size={16} /> Einloggen</a>
                <a href="/register" role="menuitem"><UserPlus size={16} /> Registrieren</a>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}

function DiscoverCard({ story, selected = false, onSelect }) {
  return (
    <article
      className={`discover-card ${selected ? 'is-selected' : ''}`}
      onClick={() => onSelect(story.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(story.id);
        }
      }}
      role="button"
      tabIndex="0"
      aria-pressed={selected}
      aria-label={`${story.name} als Hauptstory anzeigen`}
    >
      <StoryPreviewMedia story={story} className="discover-card-image" mediaClassName="discover-card-media" fallbackImage="/star_sky_bg.png">
        <span className="discover-card-category">{getStoryExperienceLabel(story)} · {getStoryCategories(story)[0]}</span>
        <StoryFacts story={story} className="discover-card-facts" />
      </StoryPreviewMedia>
    </article>
  );
}

function DiscoverFacet({ children, icon, label, onChange, value, valueLabel }) {
  const accessibleLabel = label || 'Sortierung';
  return <label className="discover-facet">
    {icon}
    {label && <span className="discover-facet-label">{label}</span>}
    <strong className="discover-facet-value" aria-hidden="true">{valueLabel}</strong>
    <ChevronDown className="discover-facet-chevron" size={14} aria-hidden="true" />
    <select aria-label={accessibleLabel} value={value} onChange={onChange}>{children}</select>
  </label>;
}

function Discover({ session, loading = false }) {
  const published = loading ? [] : getPublishedDiscoverStories(readStories());
  const authorId = new URLSearchParams(window.location.search).get('author') || '';
  const selectedAuthor = published.find((story) => story.ownerId === authorId)?.authorName || '';
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('');
  const [category, setCategory] = useState('');
  const [experienceKind, setExperienceKind] = useState('');
  const [sort, setSort] = useState('latest');
  const [selectedStoryId, setSelectedStoryId] = useState(() => getRandomFeaturedDiscoverStoryId(
    authorId ? published.filter((story) => story.ownerId === authorId) : published
  ));
  const availableLanguages = [...new Set(published.map(getStoryLanguage))];
  const availableCategories = [...new Set(published.flatMap(getStoryCategories))].sort();
  const normalizedQuery = query.trim().toLocaleLowerCase('de');
  const filtered = filterStoriesByExperienceKind(published, experienceKind)
    .filter((story) => !authorId || story.ownerId === authorId)
    .filter((story) => !language || getStoryLanguage(story) === language)
    .filter((story) => !category || getStoryCategories(story).includes(category))
    .filter((story) => !normalizedQuery || [story.name, story.description, story.authorName, getEditorNames(story).join(' '), story.location, getStoryCategories(story).join(' ')]
      .some((value) => String(value || '').toLocaleLowerCase('de').includes(normalizedQuery)))
    .sort((left, right) => sort === 'oldest'
      ? new Date(left.publishedAt || left.createdAt) - new Date(right.publishedAt || right.createdAt)
      : new Date(right.publishedAt || right.createdAt) - new Date(left.publishedAt || left.createdAt));
  const selectedStory = filtered.find((story) => story.id === selectedStoryId) || filtered[0];
  useEffect(() => {
    if (!loading && !selectedStoryId) {
      setSelectedStoryId(getRandomFeaturedDiscoverStoryId(
        authorId ? published.filter((story) => story.ownerId === authorId) : published
      ));
    }
  }, [loading, selectedStoryId, authorId]);

  const selectStory = (storyId) => {
    setSelectedStoryId(storyId);
    document.querySelector('.discover-hero')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="riu-page discover-page">
      <Header session={session} showThemeToggle />
      <main className="discover-shell">
        {loading && <article className="discover-hero" aria-busy="true"><div className="discover-hero-media media-placeholder" aria-hidden="true" /><div className="discover-hero-copy"><span>Öffentliche Galerie</span><h1>Stories entdecken</h1><p role="status">Stories werden geladen. Sie können bereits suchen und sortieren.</p></div></article>}
        {selectedStory && (
          <article className="discover-hero" aria-live="polite">
            <StoryPreviewMedia
              key={selectedStory.id}
              story={selectedStory}
              className="discover-hero-media"
              mediaClassName="discover-hero-poster"
              fallbackImage="/star_sky_bg.png"
              priority
              autoPlay
            >
            </StoryPreviewMedia>
            <div className="discover-hero-copy">
              <span>Ausgewählte {getStoryExperienceLabel(selectedStory)} · {getStoryCategories(selectedStory)[0]}</span>
              <h1>{selectedStory.name}</h1>
              <p>{selectedStory.description || 'Eine interaktive, räumliche Erzählung.'}</p>
              <StoryFacts story={selectedStory} className="discover-hero-facts" />
              <button key={selectedStory.id} className="discover-story-open" type="button" aria-describedby="discover-story-open-hint" onClick={() => go(`/stories/${selectedStory.slug || selectedStory.id}`)}>
                <Play size={18} fill="currentColor" aria-hidden="true" /> Story öffnen <ArrowRight size={20} aria-hidden="true" />
              </button>
              <span className="discover-story-open-hint" id="discover-story-open-hint">Hier starten Sie die interaktive 3D-Story.</span>
            </div>
          </article>
        )}
        <div className="discover-category-tabs" aria-label="Story-Kategorien">
          <button className={!category ? 'is-active' : ''} type="button" onClick={() => setCategory('')}>Alle Stories</button>
          {availableCategories.map((item) => <button className={category === item ? 'is-active' : ''} type="button" onClick={() => setCategory(item)} key={item}>{item}</button>)}
        </div>
        <div className="discover-tools">
          <label className="discover-search">
            <Search size={20} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Stories, Autor:innen oder Epochen suchen …" />
          </label>
          <div className="discover-filters">
            <DiscoverFacet label="Format" value={experienceKind} valueLabel={experienceKind === 'tour' ? 'Führungen' : experienceKind === 'exhibition' ? 'Ausstellungen' : 'Alle'} onChange={(event) => setExperienceKind(event.target.value)}><option value="">Alle</option><option value="tour">Führungen</option><option value="exhibition">Ausstellungen</option></DiscoverFacet>
            <DiscoverFacet label="Kategorie" value={category} valueLabel={category || 'Alle'} onChange={(event) => setCategory(event.target.value)}><option value="">Alle</option>{availableCategories.map((item) => <option key={item}>{item}</option>)}</DiscoverFacet>
            <DiscoverFacet label="Sprache" value={language} valueLabel={language ? STORY_LANGUAGES[language] || language : 'Alle'} onChange={(event) => setLanguage(event.target.value)}><option value="">Alle</option>{availableLanguages.map((code) => <option value={code} key={code}>{STORY_LANGUAGES[code] || code}</option>)}</DiscoverFacet>
            <DiscoverFacet icon={<ListFilter size={15} aria-hidden="true" />} value={sort} valueLabel={sort === 'oldest' ? 'Älteste' : 'Neueste'} onChange={(event) => setSort(event.target.value)}><option value="latest">Neueste</option><option value="oldest">Älteste</option></DiscoverFacet>
          </div>
        </div>
        {authorId && (
          <div className="discover-author-filter">
            <span>Kuratiert von <strong>{selectedAuthor || 'Unbekannte Autor:in'}</strong></span>
            <button type="button" onClick={() => go('/discover')}>Alle Autor:innen anzeigen <X size={13} /></button>
          </div>
        )}
        <div className="discover-results"><span>{loading ? 'Stories werden geladen …' : `${filtered.length} ${filtered.length === 1 ? 'Story' : 'Stories'} kuratiert`}</span></div>
        {loading ? <StoryGridPlaceholder className="discover-grid" /> : filtered.length ? (
          <div className="discover-grid">
            {filtered.map((story) => <DiscoverCard key={story.id} story={story} selected={story.id === selectedStory?.id} onSelect={selectStory} />)}
          </div>
        ) : (
          <div className="empty-state"><Search size={34} /><h2>Keine Stories gefunden</h2><p>Versuchen Sie eine andere Suche oder setzen Sie die Filter zurück.</p><button className="riu-button" onClick={() => { if (authorId) go('/discover'); else { setQuery(''); setLanguage(''); setCategory(''); setExperienceKind(''); } }}>Filter zurücksetzen</button></div>
        )}
      </main>
      <footer><Brand /><span>Interaktive 3D-Stories, sorgfältig erzählt.</span><span>Prototyp · 2026</span></footer>
    </div>
  );
}

function CollaborationDialog({ story, session, onClose, onChange }) {
  const [currentStory, setCurrentStory] = useState(story);
  const [error, setError] = useState('');
  const collaborators = normalizeStoryCollaborators(currentStory.collaborators);

  function apply(action) {
    setError('');
    try {
      const updated = action();
      setCurrentStory(updated);
      onChange(updated);
      return true;
    } catch (cause) {
      setError(cause.message);
      return false;
    }
  }

  function invite(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const invited = apply(() => inviteStoryCollaborator(currentStory.id, session.id, {
      username: form.get('username'),
      role: form.get('role')
    }));
    if (invited) event.currentTarget.reset();
  }

  return (
    <div className="metadata-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="metadata-dialog collaboration-dialog" role="dialog" aria-modal="true" aria-labelledby="collaboration-title">
        <div className="metadata-dialog-header"><div><span className="riu-overline">Gemeinsam erzählen</span><h2 id="collaboration-title">Zusammenarbeit</h2></div><button type="button" onClick={onClose} aria-label="Dialog schließen"><X size={19} /></button></div>
        <p className="collaboration-intro">Laden Sie eine Person über ihren Username ein und legen Sie vorab fest, ob sie bearbeiten oder nur ansehen darf.</p>
        <form className="collaboration-invite" onSubmit={invite}>
          <label>Username<input name="username" required placeholder="username" autoComplete="off" /></label>
          <label>Rolle<select name="role" defaultValue="editor"><option value="editor">Editor · darf bearbeiten</option><option value="viewer">Viewer · darf ansehen</option></select></label>
          <button className="riu-button"><UserPlus size={16} /> Anfrage senden</button>
        </form>
        {error && <div className="form-error">{error}</div>}
        <div className="collaborator-list">
          <div className="collaborator-owner"><span className="collaborator-avatar">{(session.name || '?')[0]}</span><div><strong>{session.name}</strong><small>@{session.username} · Ersteller:in</small></div></div>
          {collaborators.map((collaborator) => (
            <div className="collaborator-row" key={collaborator.userId}>
              <span className="collaborator-avatar">{(collaborator.name || collaborator.username || '?')[0]}</span>
              <div><strong>{collaborator.name || collaborator.username}</strong><small>@{collaborator.username} · {collaborator.status === 'pending' ? 'Anfrage offen' : collaborator.status === 'declined' ? 'Abgelehnt' : 'Aktiv'}</small></div>
              <select aria-label={`Rolle von ${collaborator.name}`} value={collaborator.role} onChange={(event) => apply(() => updateStoryCollaboratorRole(currentStory.id, session.id, collaborator.userId, event.target.value))}><option value="editor">Editor</option><option value="viewer">Viewer</option></select>
              <button type="button" onClick={() => apply(() => removeStoryCollaborator(currentStory.id, session.id, collaborator.userId))}>Entfernen</button>
            </div>
          ))}
          {!collaborators.length && <p className="collaboration-empty">Noch niemand eingeladen.</p>}
        </div>
      </section>
    </div>
  );
}

function StoryMetadataDialog({ story, onClose, onSave }) {
  const [coverImage, setCoverImage] = useState(story.coverImage || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewBuilderOpen, setPreviewBuilderOpen] = useState(false);
  const firstStation = story.stations?.[0] || null;
  const previewItems = isRoomStory(story) ? (firstStation?.items || []).filter((item) => item?.modelUrl) : [];
  const [previewItemId, setPreviewItemId] = useState(() => previewItems.find((item) => resolveSpatialThumbnailUrl(item))?.id || previewItems[0]?.id || '');

  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  async function uploadCover(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      setCoverImage(await createCoverImageFromFile(file));
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  async function createPreview() {
    setError('');
    if (!isRoomStory(story)) {
      setCoverImage(createAutomaticStoryPreviewImage(story));
      return;
    }
    if (!previewBuilderOpen) {
      if (!previewItems.length) setError('Station 1 enthält noch kein Objekt für das Vorschaubild.');
      else setPreviewBuilderOpen(true);
      return;
    }
    const item = previewItems.find((entry) => entry.id === previewItemId);
    if (!item) {
      setError('Bitte wählen Sie ein Objekt aus Station 1 aus.');
      return;
    }
    setBusy(true);
    try {
      setCoverImage(await createExhibitionPreviewImage(story, firstStation, item));
      setPreviewBuilderOpen(false);
    } catch (cause) {
      const thumbnailUrl = resolveSpatialThumbnailUrl(item);
      if (/^https?:\/\//i.test(thumbnailUrl)) {
        setCoverImage(thumbnailUrl);
        setPreviewBuilderOpen(false);
      } else {
        setError(cause.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const categories = form.getAll('categories').map(String);
    try {
      if (!categories.length) throw new Error('Bitte wählen Sie mindestens eine Kategorie aus.');
      setBusy(true);
      await onSave({
        name: form.get('name'),
        description: form.get('description'),
        coverImage,
        language: form.get('language'),
        categories,
        license: form.get('license')
      });
      onClose();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="metadata-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="metadata-dialog" role="dialog" aria-modal="true" aria-labelledby="metadata-dialog-title">
        <div className="metadata-dialog-header"><div><span className="riu-overline">Story bearbeiten</span><h2 id="metadata-dialog-title">Metadaten</h2></div><div className="metadata-dialog-header-actions"><button type="button" className="metadata-create-preview" onClick={createPreview} disabled={busy}><Camera size={15} />{coverImage ? 'Preview neu erstellen' : 'Preview erstellen'}</button><button type="button" onClick={onClose} aria-label="Dialog schließen"><X size={19} /></button></div></div>
        <form onSubmit={submit}>
          {previewBuilderOpen && <section className="metadata-preview-builder"><div><span>Ausstellung · Station 1</span><strong>Objekt für das Preview wählen</strong><small>Das gewählte Objekt wird zusammen mit Titel und Einführung der ersten Station als 16:9-Vorschau gestaltet.</small></div><div className="metadata-preview-object-list">{previewItems.map((item) => { const thumbnailUrl = resolveSpatialThumbnailUrl(item); return <button key={item.id} type="button" className={item.id === previewItemId ? 'is-selected' : ''} onClick={() => setPreviewItemId(item.id)} disabled={!thumbnailUrl}><span>{thumbnailUrl ? <img src={thumbnailUrl} alt="" /> : <Box size={22} />}</span><b>{item.title || 'Unbenanntes Objekt'}</b>{!thumbnailUrl && <small>Kein Thumbnail</small>}</button>; })}</div><div className="metadata-preview-builder-actions"><button type="button" onClick={() => setPreviewBuilderOpen(false)}>Abbrechen</button><button type="button" className="riu-button" onClick={createPreview} disabled={busy || !previewItemId}>{busy ? 'Preview wird erstellt …' : 'Aus Auswahl erstellen'}</button></div></section>}
          <div className="metadata-cover" style={{ backgroundImage: `url("${coverImage || '/roman_blueprint_bg.png'}")` }}><span>Vorschau · 16:9</span></div>
          <div className="metadata-cover-actions">
            <label><Upload size={15} /> Eigenes Bild hochladen<input type="file" accept="image/*" onChange={uploadCover} /></label>
            {coverImage && <button type="button" onClick={() => setCoverImage('')}>Bild entfernen</button>}
          </div>
          <label>Vorschaubild-URL <span>(alternativ)</span><input type="url" value={coverImage.startsWith('data:') ? '' : coverImage} onChange={(event) => setCoverImage(event.target.value)} placeholder="https://example.org/cover.jpg" /></label>
          <label>Name der Story<input name="name" required defaultValue={story.name} /></label>
          <label>Kurzbeschreibung<textarea name="description" rows="3" defaultValue={story.description} /></label>
          <div className="metadata-form-row"><label>Sprache<select name="language" defaultValue={getStoryLanguage(story)}>{Object.entries(STORY_LANGUAGES).map(([code, label]) => <option value={code} key={code}>{label}</option>)}</select></label><CategoryPicker defaultCategories={getStoryCategories(story)} /></div>
          <label>Lizenzangabe<textarea name="license" rows="2" defaultValue={story.metadata?.license || ''} placeholder="z. B. CC BY 4.0 · Modell: Museum Musterstadt" /><small>Wird für die korrekte Wiedergabe und Quellenzuordnung der Story gespeichert.</small></label>
          {error && <div className="form-error">{error}</div>}
          <div className="metadata-dialog-actions"><button type="button" onClick={onClose}>Abbrechen</button><button className="riu-button" disabled={busy}>{busy ? 'Bild wird verarbeitet …' : 'Metadaten speichern'}</button></div>
        </form>
      </section>
    </div>
  );
}

function StoryVersionDialog({ story, onClose, onRestored }) {
  const [versions, setVersions] = useState([]);
  const [busy, setBusy] = useState(true);
  const [restoringId, setRestoringId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchStoryVersions(story.id)
      .then((items) => { if (active) setVersions(items); })
      .catch((cause) => { if (active) setError(cause.message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [story.id]);

  async function restore(version) {
    if (confirmId !== version.id) {
      setConfirmId(version.id);
      return;
    }
    setRestoringId(version.id);
    setError('');
    try {
      const restored = await restoreStoryVersion(version.id);
      if (!restored) throw new Error('Die wiederhergestellte Story konnte nicht geladen werden.');
      writeStories(readStories().map((item) => item.id === restored.id ? restored : item));
      onRestored(restored);
    } catch (cause) {
      setError(cause.message);
      setRestoringId(null);
      setConfirmId(null);
    }
  }

  return (
    <div className="metadata-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="metadata-dialog version-dialog" role="dialog" aria-modal="true" aria-labelledby="version-dialog-title">
        <div className="metadata-dialog-header">
          <div><span className="riu-overline">Sicher bearbeiten</span><h2 id="version-dialog-title">Versionsverlauf</h2></div>
          <button type="button" onClick={onClose} aria-label="Dialog schließen"><X size={19} /></button>
        </div>
        <p className="version-intro">RIU legt bei Änderungen gebündelte Zwischenstände und bei Veröffentlichungen eigene Versionen an. Vor einer Wiederherstellung wird der aktuelle Stand zusätzlich gesichert.</p>
        {error && <div className="form-error">{error}</div>}
        {busy ? <div className="version-empty">Versionen werden geladen …</div> : versions.length ? (
          <div className="version-list">
            {versions.map((version) => (
              <article key={version.id}>
                <span className="version-number">v{version.versionNumber}</span>
                <div><strong>{VERSION_REASON_LABELS[version.reason] || 'Gespeicherter Stand'}</strong><small>{new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(version.createdAt))}</small></div>
                <button type="button" className={confirmId === version.id ? 'is-confirming' : ''} disabled={restoringId !== null} onClick={() => restore(version)}>
                  <RotateCcw size={14} /> {restoringId === version.id ? 'Wird wiederhergestellt …' : confirmId === version.id ? 'Jetzt bestätigen' : 'Wiederherstellen'}
                </button>
              </article>
            ))}
          </div>
        ) : <div className="version-empty">Noch keine ältere Version vorhanden. Der erste Stand entsteht automatisch bei der nächsten Änderung.</div>}
      </section>
    </div>
  );
}

function StoryAnalyticsPage({ story, session }) {
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetchStoryAnalytics(story.id)
      .then((result) => { if (active) setAnalytics(result); })
      .catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [story.id]);

  const maximumStationViews = Math.max(1, ...(analytics?.stations || []).map((station) => station.views));
  const totalDeviceViews = Math.max(1, (analytics?.devices || []).reduce((sum, device) => sum + device.views, 0));
  const deviceLabels = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobil' };

  return (
    <div className="riu-page analytics-page">
      <Header session={session} />
      <main className="analytics-shell">
        <button className="analytics-back" onClick={() => go('/dashboard')}><ArrowRight size={15} /> Zurück zu meinen Stories</button>
        <div className="analytics-heading">
          <div><span className="riu-overline">Nur für Autor:innen</span><h1>Analytics</h1><p>{story.name}</p></div>
          <BarChart3 size={44} />
        </div>
        {error && <div className="form-error">Die Auswertung konnte nicht geladen werden: {error}</div>}
        {!analytics && !error && <div className="analytics-loading">Auswertung wird geladen …</div>}
        {analytics && <>
          <section className="analytics-kpis" aria-label="Kennzahlen">
            <article><Eye size={18} /><span>Aufrufe</span><strong>{analytics.summary.views.toLocaleString('de-AT')}</strong></article>
            <article><Check size={18} /><span>Abgeschlossen</span><strong>{analytics.summary.completionRate.toLocaleString('de-AT')} %</strong><small>{analytics.summary.completed} Durchläufe</small></article>
            <article><Timer size={18} /><span>Ø Verweildauer</span><strong>{formatAnalyticsDuration(analytics.summary.averageDurationSeconds)}</strong></article>
            <article><MapPin size={18} /><span>Annotationen geöffnet</span><strong>{analytics.summary.annotationOpens.toLocaleString('de-AT')}</strong></article>
            <article><Sparkles size={18} /><span>Ø Ladezeit</span><strong>{(analytics.summary.averageLoadMs / 1000).toLocaleString('de-AT', { maximumFractionDigits: 1 })} Sek.</strong></article>
          </section>
          <div className="analytics-grid">
            <section className="analytics-panel">
              <div className="analytics-panel-heading"><div><span className="riu-overline">Story-Verlauf</span><h2>Besuche je Station</h2></div><small>Eindeutige Sitzungen</small></div>
              <div className="station-analytics-list">
                {analytics.stations.map((station, index) => {
                  const nextViews = analytics.stations[index + 1]?.views;
                  const dropOff = nextViews === undefined || station.views === 0
                    ? null
                    : Math.max(0, Math.round(((station.views - nextViews) / station.views) * 100));
                  return <div key={station.stationId}><span>{String(station.position).padStart(2, '0')}</span><strong>{station.title}</strong><div><i style={{ width: `${(station.views / maximumStationViews) * 100}%` }} /></div><b>{station.views}{dropOff !== null && <small>{dropOff} % Abbruch</small>}</b></div>;
                })}
                {!analytics.stations.length && <p>Noch keine Stationsdaten vorhanden.</p>}
              </div>
            </section>
            <section className="analytics-panel device-panel">
              <div className="analytics-panel-heading"><div><span className="riu-overline">Geräte</span><h2>Nutzung</h2></div></div>
              {analytics.devices.map((device) => <div className="device-row" key={device.device}><span>{deviceLabels[device.device] || device.device}</span><div><i style={{ width: `${(device.views / totalDeviceViews) * 100}%` }} /></div><strong>{Math.round((device.views / totalDeviceViews) * 100)} %</strong></div>)}
              {!analytics.devices.length && <p>Noch keine Gerätedaten vorhanden.</p>}
              <small className="analytics-privacy">Datensparsam: RIU speichert dafür keine IP-Adressen, Namen oder E-Mail-Adressen.</small>
            </section>
          </div>
        </>}
      </main>
    </div>
  );
}

function StoryCard({ story, featured = false }) {
  return (
    <article className={`story-card ${featured ? 'is-featured' : ''}`} onClick={() => go(`/stories/${story.slug || story.id}`)}>
      <StoryPreviewMedia story={story} className="story-card-image" mediaClassName="story-card-media" fallbackImage="/star_sky_bg.png">
        <div className="story-card-shade" />
        <span className="story-stations"><Layers3 size={13} /> {story.stations?.length || 0} {(story.stations?.length || 0) === 1 ? 'Thema' : 'Themen'}</span>
        <button className="story-open" aria-label={`${story.name} öffnen`}><ArrowRight /></button>
      </StoryPreviewMedia>
      <div className="story-card-copy">
        <div className="story-kicker">{story.location || 'Räumliche Story'}</div>
        <h3>{story.name}</h3>
        <p>{story.description}</p>
        <div className="story-meta"><span>von {story.authorName || 'RIU Autor:in'}</span><span>{formatDate(story.publishedAt)}</span></div>
      </div>
    </article>
  );
}

function StoryGridPlaceholder({ className = 'story-grid' }) {
  return <div className={className} aria-busy="true"><p className="story-loading-status" role="status">Stories werden geladen …</p>{[0, 1].map((index) => <div key={index} className="story-card" aria-hidden="true"><div className="story-card-image media-placeholder" /><div className="story-placeholder-line" /><div className="story-placeholder-line is-short" /></div>)}</div>;
}

function Gallery({ session, loading = false }) {
  const published = loading ? [] : getPublishedDiscoverStories(readStories());
  return (
    <div className="riu-page home-page">
      <Header session={session} sticky />
      <main>
        <section className="riu-hero">
          <div className="riu-hero-art" aria-hidden="true"><div className="hero-orbit" /><div className="hero-stone" /></div>
          <div className="riu-hero-copy">
            <div className="riu-eyebrow"><Sparkles size={14} /> Räumliche Geschichten</div>
            <h1>Modelle zeigen.<br /><em>Geschichten erzählen.</em></h1>
            <p>RIU verwandelt 3D-Modelle in kuratierte Reisen aus Perspektiven, Texten und räumlichen Annotationen.</p>
            <div className="riu-hero-actions">
              <button className="riu-button" onClick={() => go(session ? (canCreateStories(session) ? '/stories/new' : '/dashboard') : '/register')}>Eigene Story erstellen <ArrowRight size={17} /></button>
              <a href="#stories">Galerie entdecken <ChevronRight size={16} /></a>
            </div>
          </div>
          <div className="riu-scroll-note">Ausgewählte Stories <span /></div>
        </section>

        <section className="riu-gallery" id="stories">
          <div className="section-heading">
            <div><span className="riu-overline">Öffentliche Galerie</span><h2>Räume, die etwas erzählen</h2></div>
            <div className="gallery-count">{loading ? 'Wird geladen …' : `${String(published.length).padStart(2, '0')} Stories`}</div>
          </div>
          {loading ? <StoryGridPlaceholder /> : <div className="story-grid">
            {published.map((story, index) => <StoryCard key={story.id} story={story} featured={index === 0} />)}
          </div>}
        </section>

        <section className="riu-manifesto" id="about">
          <span className="riu-overline">Das Prinzip</span>
          <blockquote>„Eine Story ist eine Abfolge räumlicher Zustände mit einer erzählerischen Absicht.“</blockquote>
          <div className="manifesto-grid">
            <div><span>01</span><h3>Extern verbinden</h3><p>Ihr GLB- oder glTF-Modell bleibt dort, wo Sie es hosten.</p></div>
            <div><span>02</span><h3>Räumlich inszenieren</h3><p>Speichern Sie Kamerapositionen, Texte und Annotationen als Stationen.</p></div>
            <div><span>03</span><h3>Als Story teilen</h3><p>Veröffentlichen Sie eine geführte Reise statt eines isolierten Modells.</p></div>
          </div>
        </section>
      </main>
      <footer><Brand /><span>Interaktive 3D-Stories, sorgfältig erzählt.</span><span>Prototyp · 2026</span></footer>
    </div>
  );
}

function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [rememberLogin, setRememberLogin] = useState(() => readRememberLoginPreference());
  const [registrationsEnabled, setRegistrationsEnabled] = useState(!isRegister);
  const [settingsBusy, setSettingsBusy] = useState(isRegister);
  useEffect(() => {
    const notice = localStorage.getItem('riu_auth_notice');
    if (notice) { setError(notice); localStorage.removeItem('riu_auth_notice'); }
    if (!isRegister) return;
    fetchPlatformAccess()
      .then((settings) => setRegistrationsEnabled(settings.registrationsEnabled))
      .catch((cause) => setError(cause.message))
      .finally(() => setSettingsBusy(false));
  }, [isRegister]);
  async function authenticateWithGoogle() {
    setBusy('google'); setError('');
    try {
      await loginWithOAuth(isRegister ? 'register' : 'login', isRegister || rememberLogin);
    } catch (cause) { setError(cause.message); setBusy(''); }
  }
  async function authenticateWithPassword(event) {
    event.preventDefault();
    setBusy('password'); setError('');
    try {
      const form = new FormData(event.currentTarget);
      await loginWithPassword(form.get('email'), form.get('password'), rememberLogin);
      go('/dashboard');
    } catch (cause) { setError(cause.message); setBusy(''); }
  }
  return (
    <div className="riu-page auth-page">
      <Header session={null} />
      <main className="auth-layout">
        <section className="auth-intro">
          <span className="riu-overline">RIU Studio</span>
          <h1>{isRegister ? 'Erzählen Sie mit Raum.' : 'Willkommen zurück.'}</h1>
          <p>{isRegister ? 'Ein Modell ist der Ort. Sie bestimmen Blick, Rhythmus und Bedeutung.' : 'Ihre Stories, Stationen und Entwürfe warten auf Sie.'}</p>
          <div className="auth-quote">Perspektive wird zu Dramaturgie.<br />Geometrie wird zu Erinnerung.</div>
        </section>
        <section className="auth-panel">
          <div className="auth-card">
            <span className="riu-overline">{isRegister ? 'Kostenlos beginnen' : 'Anmelden'}</span>
            <h2>{isRegister ? 'Konto erstellen' : 'Zum Studio'}</h2>
            <div className="auth-oauth">
              <p>{isRegister
                ? 'Wählen Sie Ihr Google-Konto. Damit wird Ihr RIU-Konto erstellt; anschließend kommen Sie automatisch in Ihren persönlichen Bereich.'
                : 'Melden Sie sich direkt bei RIU an. Das funktioniert auch in Cloud-Browsern, sobald Sie in Ihren Kontoeinstellungen ein RIU-Passwort eingerichtet haben.'}</p>
              {error && <div className="form-error">{error}</div>}
              {isRegister && !settingsBusy && !registrationsEnabled && <div className="form-error">Neue Konten sind derzeit nicht freigeschaltet. Bereits registrierte Personen können sich weiterhin anmelden.</div>}
              {!isRegister && (
                <form className="auth-direct" onSubmit={authenticateWithPassword}>
                  <label>E-Mail<input name="email" type="email" required autoComplete="email" /></label>
                  <label>RIU-Passwort<input name="password" type="password" required autoComplete="current-password" /></label>
                  <button className="riu-button" disabled={Boolean(busy)}>
                    <LogIn size={18} /> {busy === 'password' ? 'Anmelden …' : 'Direkt anmelden'}
                  </button>
                </form>
              )}
              {!isRegister && (
                <label className="auth-remember">
                  <input type="checkbox" checked={rememberLogin} onChange={(event) => setRememberLogin(event.target.checked)} />
                  <span className="auth-remember-box" aria-hidden="true"><Check size={12} /></span>
                  <span>Angemeldet bleiben</span>
                </label>
              )}
              {!isRegister && <div className="auth-divider"><span>oder</span></div>}
              <button type="button" className="riu-button auth-google" disabled={Boolean(busy) || settingsBusy || (isRegister && !registrationsEnabled)} onClick={authenticateWithGoogle}>
                <CircleUserRound size={18} /> {busy === 'google' ? 'Weiterleitung …' : settingsBusy ? 'Freigabe wird geprüft …' : (isRegister ? 'Mit Google registrieren' : 'Mit Google anmelden')}
              </button>
            </div>
            <p className="auth-switch">{isRegister
              ? <>Schon registriert? <a href="/login">Hier anmelden</a>.</>
              : <>Noch kein Konto? <a href="/register">Hier registrieren</a>.</>}</p>
          </div>
        </section>
      </main>
    </div>
  );
}

function Dashboard({ session, onSession }) {
  const readDashboardStories = () => {
    const projectCovers = new Map(readProjects()
      .filter((project) => project.coverImage)
      .map((project) => [project.id, project.coverImage]));
    return filterOwnedStories(readStories(), session.id)
      .map((story) => projectCovers.has(story.id) ? { ...story, coverImage: projectCovers.get(story.id) } : story);
  };
  const [stories, setStories] = useState(readDashboardStories);
  const [query, setQuery] = useState('');
  const [experienceKind, setExperienceKind] = useState('');
  const [metadataStory, setMetadataStory] = useState(null);
  const [collaborationStory, setCollaborationStory] = useState(null);
  const [versionStory, setVersionStory] = useState(null);
  const [viewCounts, setViewCounts] = useState({});
  const [releaseBusyId, setReleaseBusyId] = useState('');
  const [releaseError, setReleaseError] = useState('');
  const filtered = filterStoriesByExperienceKind(stories, experienceKind)
    .filter((story) => story.name.toLowerCase().includes(query.toLowerCase()));
  const getViewCount = (story) => viewCounts[story.id]?.views ?? (Number(story.stats?.views) || 0);
  const totalViews = stories.reduce((sum, story) => sum + getViewCount(story), 0);
  const publishedCount = stories.filter((story) => story.status === 'published').length;

  useEffect(() => {
    let active = true;
    fetchOwnedStoryViewCounts()
      .then((counts) => { if (active) setViewCounts(counts); })
      .catch(() => {});
    return () => { active = false; };
  }, [session.id]);

  useEffect(() => {
    const mergedStories = readDashboardStories();
    const covers = new Map(mergedStories.map((story) => [story.id, story.coverImage]));
    const currentStories = readStories();
    const nextStories = currentStories.map((story) => (
      covers.has(story.id) && covers.get(story.id) !== story.coverImage
        ? { ...story, coverImage: covers.get(story.id) }
        : story
    ));
    if (nextStories.some((story, index) => story.coverImage !== currentStories[index]?.coverImage)) {
      writeStories(nextStories);
    }
    setStories(mergedStories);
  }, [session.id]);

  function remove(story) {
    if (!window.confirm(`„${story.name}“ wirklich löschen?`)) return;
    deleteStory(story.id, session.id);
    setStories(readDashboardStories());
  }
  async function toggleRelease(story) {
    setReleaseBusyId(story.id);
    setReleaseError('');
    try {
      if (story.status === 'published') unpublishStory(story.id, session.id);
      else await publishStory(story.id, session.id);
      setStories(readDashboardStories());
    } catch (cause) {
      setReleaseError(cause?.message || 'Die Story konnte nicht veröffentlicht werden.');
    } finally {
      setReleaseBusyId('');
    }
  }
  async function saveMetadata(metadata) {
    const updated = await updateStoryMetadata(metadataStory.id, session.id, metadata);
    updateProjectListingMetadata(metadataStory.id, {
      name: updated.name,
      description: updated.description,
      coverImage: updated.coverImage,
      metadata: updated.metadata
    });
    setStories(readDashboardStories());
  }
  return (
    <div className="riu-page dashboard-page">
      <Header session={session} />
      <main className="dashboard-shell">
        <div className="dashboard-heading"><div><span className="riu-overline">Persönlicher Bereich</span><h1>Meine Stories</h1><p>Guten Tag, {session.name}. Was möchten Sie heute erzählen?</p></div>{canCreateStories(session) && <button className="riu-button" onClick={() => go('/stories/new')}><Plus size={17} /> Neue Story</button>}</div>
        <div className="dashboard-content">
          <div className="dashboard-main">
            <div className="dashboard-tools"><label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Stories durchsuchen" /></label><label className="dashboard-format-filter"><Layers3 size={15} /><span>Format</span><select value={experienceKind} onChange={(event) => setExperienceKind(event.target.value)}><option value="">Alle</option><option value="tour">Führungen</option><option value="exhibition">Ausstellungen</option></select><ChevronDown size={14} /></label></div>
            {releaseError && <div className="form-error">{releaseError}</div>}
            {filtered.length ? <div className="dashboard-grid">{filtered.map((story) => (
          <article className="dashboard-card" key={story.id}>
            <a className="dashboard-cover-link" href={`/stories/${story.slug || story.id}`} aria-label={`„${story.name}“ ansehen`}>
              <StoryPreviewMedia story={story} className="dashboard-cover" mediaClassName="dashboard-cover-media" fallbackImage="/roman_blueprint_bg.png"><span className={`status-pill ${story.status}`}>{story.status === 'published' ? 'Veröffentlicht' : 'Entwurf'}</span></StoryPreviewMedia>
            </a>
            <div className="dashboard-card-copy">
              <span>{getStoryExperienceLabel(story)} · Geändert {formatDate(story.updatedAt)}</span>
              <h3>{story.name}</h3>
              <p>{story.description || 'Noch keine Beschreibung.'}</p>
              <div className="dashboard-card-dates">
                <span><CalendarDays size={14} /><span><small>Erstellt am</small><strong>{formatDate(getStoryCreatedAt(story))}</strong></span></span>
                <span><Globe2 size={14} /><span><small>Veröffentlicht seit</small><strong>{getStoryPublishedAt(story) ? formatDate(getStoryPublishedAt(story)) : 'Noch nicht veröffentlicht'}</strong></span></span>
              </div>
              <StoryFacts story={story} className="dashboard-card-facts" />
              <div className="dashboard-card-views"><Eye size={14} /><strong>{getViewCount(story)}</strong> Aufrufe</div>
            </div>
            <div className="dashboard-actions">
              {canEditStory(story, session.id) && <button onClick={() => go(`/studio/${story.id}`)}>Bearbeiten <ArrowRight size={15} /></button>}
              {canEditStory(story, session.id) && <button onClick={() => setMetadataStory(story)}><FilePenLine size={15} /> Metadaten</button>}
              <button onClick={() => go(`/stories/${story.slug || story.id}`)}><Eye size={15} /> Vorschau</button>
              {story.ownerId === session.id && <button onClick={() => setCollaborationStory(story)}><Users size={15} /> Team</button>}
              {story.ownerId === session.id && <button onClick={() => setVersionStory(story)}><History size={15} /> Versionen</button>}
              {story.ownerId === session.id && <button onClick={() => go(`/analytics/${story.id}`)}><BarChart3 size={15} /> Analytics</button>}
              {story.ownerId === session.id && <button className="release" disabled={releaseBusyId === story.id} onClick={() => toggleRelease(story)}>{releaseBusyId === story.id ? 'Wird veröffentlicht …' : story.status === 'published' ? <><LockKeyhole size={15} /> Freigabe aufheben</> : <><Globe2 size={15} /> Story freigeben</>}</button>}
              {story.ownerId === session.id && <button className="danger" onClick={() => remove(story)}>Löschen</button>}
            </div>
          </article>
            ))}</div> : <div className="empty-state"><Box size={34} /><h2>Noch keine eigene Story</h2><p>{canCreateStories(session) ? 'Verbinden Sie ein extern gehostetes 3D-Modell und legen Sie Ihre erste Station an.' : 'Unter „Meine Stories“ erscheinen nur selbst erstellte Stories. Veröffentlichte Stories finden Sie in der Galerie und Kooperationen in Ihrem Konto.'}</p>{canCreateStories(session) && <button className="riu-button" onClick={() => go('/stories/new')}>Erste Story erstellen</button>}</div>}
          </div>
          <aside className="dashboard-stats" aria-label="Story-Statistik">
            <div><Eye size={18} /><span>Gesamtaufrufe</span><strong>{totalViews.toLocaleString('de-AT')}</strong></div>
            <div><Check size={18} /><span>Veröffentlicht</span><strong>{publishedCount}</strong></div>
            <div><BarChart3 size={18} /><span>Stories gesamt</span><strong>{stories.length}</strong></div>
          </aside>
        </div>
      </main>
      {metadataStory && <StoryMetadataDialog story={metadataStory} onClose={() => setMetadataStory(null)} onSave={saveMetadata} />}
      {collaborationStory && <CollaborationDialog story={collaborationStory} session={session} onClose={() => setCollaborationStory(null)} onChange={(updated) => { setCollaborationStory(updated); setStories(readDashboardStories()); }} />}
      {versionStory && <StoryVersionDialog story={versionStory} onClose={() => setVersionStory(null)} onRestored={() => { setVersionStory(null); setStories(readDashboardStories()); }} />}
    </div>
  );
}

function AccountPage({ session, onSession }) {
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [, setCollaborationRevision] = useState(0);
  const collaborationStories = readStories().filter((story) => normalizeStoryCollaborators(story.collaborators)
    .some((collaborator) => collaborator.userId === session.id));
  const pendingInvites = collaborationStories.filter((story) => normalizeStoryCollaborators(story.collaborators)
    .some((collaborator) => collaborator.userId === session.id && collaborator.status === 'pending'));
  const activeCollaborations = collaborationStories.filter((story) => normalizeStoryCollaborators(story.collaborators)
    .some((collaborator) => collaborator.userId === session.id && collaborator.status === 'accepted'));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const form = new FormData(event.currentTarget);
      const updated = await updateUserProfile(session.id, { name: form.get('name'), username: form.get('username') });
      onSession(updated);
      setSaved(true);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPasswordBusy(true);
    setPasswordError('');
    setPasswordSaved(false);
    try {
      const form = new FormData(formElement);
      const password = String(form.get('password') || '');
      if (password !== String(form.get('passwordConfirmation') || '')) {
        throw new Error('Die beiden Passwörter stimmen nicht überein.');
      }
      await setDirectLoginPassword(password);
      formElement.reset();
      setPasswordSaved(true);
    } catch (cause) {
      setPasswordError(cause.message);
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="riu-page account-page">
      <Header session={session} />
      <main className="account-layout">
        <section className="account-intro">
          <span className="riu-overline">Persönlicher Bereich</span>
          <h1>Ihr Konto.</h1>
          <p>Ändern Sie hier den Namen, der im Studio und als Autor Ihrer Stories angezeigt wird.</p>
          <button className="account-dashboard-link" onClick={() => go('/dashboard')}>
            Zu meinen Stories <ArrowRight size={16} />
          </button>
        </section>
        <section className="account-panel">
          <div className="account-content">
          <form className="account-form" onSubmit={submit}>
            <span className="riu-overline">Profil</span>
            <h2>Kontodaten</h2>
            <label>Name<input name="name" required defaultValue={session.name} autoComplete="name" /></label>
            <label>Username<input name="username" required minLength="3" pattern="[A-Za-z0-9._-]+" defaultValue={session.username} autoComplete="username" /><small>Über diesen eindeutigen Namen erhalten Sie Einladungen.</small></label>
            <label>E-Mail<input value={session.email} disabled type="email" /></label>
            <small>Die E-Mail-Adresse kann in diesem Prototyp nicht geändert werden.</small>
            {error && <div className="form-error">{error}</div>}
            {saved && <div className="form-success"><Check size={16} /> Profil gespeichert</div>}
            <button className="riu-button" disabled={busy}>{busy ? 'Speichern …' : 'Änderungen speichern'}</button>
          </form>
          <form className="account-form account-security" onSubmit={submitPassword}>
            <span className="riu-overline">Direkte Anmeldung</span>
            <h2>RIU-Passwort</h2>
            <p>Richten Sie ein zusätzliches Passwort für <strong>{session.email}</strong> ein. Damit können Sie sich ohne Google-Weiterleitung anmelden, etwa im ChatGPT-Cloud-Browser.</p>
            <label>Neues Passwort<input name="password" type="password" required minLength="8" autoComplete="new-password" /></label>
            <label>Passwort bestätigen<input name="passwordConfirmation" type="password" required minLength="8" autoComplete="new-password" /></label>
            <small>Mindestens 8 Zeichen. Ihre Google-Anmeldung bleibt weiterhin verfügbar.</small>
            {passwordError && <div className="form-error">{passwordError}</div>}
            {passwordSaved && <div className="form-success"><Check size={16} /> Direkte Anmeldung ist eingerichtet</div>}
            <button className="riu-button" disabled={passwordBusy}>{passwordBusy ? 'Speichern …' : 'RIU-Passwort speichern'}</button>
          </form>
          <section className="account-collaborations" aria-labelledby="collaboration-settings-title">
            <span className="riu-overline">Zusammenarbeit</span>
            <h2 id="collaboration-settings-title">Story-Anfragen</h2>
            {pendingInvites.map((story) => {
              const invitation = normalizeStoryCollaborators(story.collaborators).find((item) => item.userId === session.id);
              return <article className="account-invite" key={story.id}><div><strong>{story.name}</strong><span>{story.authorName} lädt Sie als {invitation.role === 'editor' ? 'Editor:in' : 'Viewer:in'} ein.</span></div><div><button onClick={() => { respondToCollaboration(story.id, session.id, 'declined'); setCollaborationRevision((current) => current + 1); }}>Ablehnen</button><button className="riu-button" onClick={() => { respondToCollaboration(story.id, session.id, 'accepted'); setCollaborationRevision((current) => current + 1); }}>Annehmen</button></div></article>;
            })}
            {!pendingInvites.length && <p className="collaboration-empty">Keine offenen Anfragen.</p>}
            {activeCollaborations.length > 0 && <><h3>Aktive Stories</h3><div className="account-active-stories">{activeCollaborations.map((story) => { const permission = getStoryPermission(story, session.id); return <button key={story.id} onClick={() => go(permission === 'editor' ? `/studio/${story.id}` : `/stories/${story.slug || story.id}`)}><span><strong>{story.name}</strong><small>{permission === 'editor' ? 'Editor:in' : 'Viewer:in'} · von {story.authorName}</small></span><ArrowRight size={15} /></button>; })}</div></>}
          </section>
          </div>
        </section>
      </main>
    </div>
  );
}

function AdminPage({ session }) {
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState({ registrationsEnabled: true, defaultRole: 'light-user' });
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState('');
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  async function reload() {
    setError('');
    try {
      const [nextUsers, nextSettings] = await Promise.all([fetchAdminUsers(), fetchPlatformAccess()]);
      setUsers(nextUsers);
      setSettings(nextSettings);
      setDrafts(Object.fromEntries(nextUsers.map((user) => [user.id, { role: user.role, isBlocked: user.isBlocked }])));
    } catch (cause) {
      setError(cause.message);
    }
  }

  useEffect(() => { reload(); }, []);

  async function saveUser(user) {
    setBusyId(user.id); setError(''); setSaved('');
    try {
      await updateAdminUser(user.id, drafts[user.id]);
      setSaved(`${user.name} wurde aktualisiert.`);
      await reload();
    } catch (cause) { setError(cause.message); }
    finally { setBusyId(''); }
  }

  async function saveSettings() {
    setSettingsBusy(true); setError(''); setSaved('');
    try {
      await updatePlatformAccess(settings);
      setSaved('Die Zugangseinstellungen wurden gespeichert.');
      await reload();
    } catch (cause) { setError(cause.message); }
    finally { setSettingsBusy(false); }
  }

  return (
    <div className="riu-page admin-page">
      <Header session={session} />
      <main className="admin-shell">
        <div className="admin-heading">
          <div><span className="riu-overline">Administration</span><h1>Zugänge & Rollen</h1><p>Steuern Sie neue Konten, Berechtigungen und Sperren zentral.</p></div>
          <ShieldCheck size={46} />
        </div>
        {error && <div className="form-error admin-message">{error}</div>}
        {saved && <div className="form-success admin-message"><Check size={16} /> {saved}</div>}
        <section className="admin-settings">
          <div><span className="riu-overline">Neue Konten</span><h2>Anmeldungen freigeben</h2><p>Ist der Schalter aus, werden keine neuen Google-Konten angelegt. Bestehende Konten können sich weiterhin anmelden.</p></div>
          <label className="admin-toggle"><input type="checkbox" checked={settings.registrationsEnabled} onChange={(event) => setSettings((current) => ({ ...current, registrationsEnabled: event.target.checked }))} /><span />{settings.registrationsEnabled ? 'Freigegeben' : 'Geschlossen'}</label>
          <label className="admin-default-role">Standardrolle für neue Konten<select value={settings.defaultRole} onChange={(event) => setSettings((current) => ({ ...current, defaultRole: event.target.value }))}><option value="light-user">Light-User</option><option value="pro-user">Pro-User</option></select></label>
          <button className="riu-button" disabled={settingsBusy} onClick={saveSettings}>{settingsBusy ? 'Speichern …' : 'Einstellungen speichern'}</button>
        </section>
        <section className="admin-users" aria-labelledby="admin-users-title">
          <div className="admin-section-heading"><div><span className="riu-overline">Personen</span><h2 id="admin-users-title">Benutzerverwaltung</h2></div><span>{users.length} Konten</span></div>
          <div className="admin-user-list">
            {users.map((user) => {
              const draft = drafts[user.id] || { role: user.role, isBlocked: user.isBlocked };
              const changed = draft.role !== user.role || draft.isBlocked !== user.isBlocked;
              const isSelf = user.id === session.id;
              return <article className={`admin-user ${draft.isBlocked ? 'is-blocked' : ''}`} key={user.id}>
                <div className="admin-user-person"><span>{(user.name || '?').slice(0, 1)}</span><div><strong>{user.name}</strong><small>@{user.username} · {user.email}</small><small>Seit {formatDate(user.createdAt)}</small></div></div>
                <label>Rolle<select value={draft.role} onChange={(event) => setDrafts((current) => ({ ...current, [user.id]: { ...draft, role: event.target.value } }))}>{USER_ROLES.map((role) => <option value={role} key={role}>{USER_ROLE_LABELS[role]}</option>)}</select></label>
                <label className="admin-block"><input type="checkbox" checked={draft.isBlocked} disabled={isSelf} onChange={(event) => setDrafts((current) => ({ ...current, [user.id]: { ...draft, isBlocked: event.target.checked } }))} /><Ban size={15} /> {draft.isBlocked ? 'Gesperrt' : 'Aktiv'}</label>
                <button className="riu-button" disabled={!changed || busyId === user.id} onClick={() => saveUser(user)}>{busyId === user.id ? 'Speichern …' : 'Übernehmen'}</button>
              </article>;
            })}
            {!users.length && !error && <div className="empty-state">Benutzer werden geladen …</div>}
          </div>
        </section>
      </main>
    </div>
  );
}

function NewStory({ session }) {
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const modelUrl = String(form.get('modelUrl')).trim();
    const categories = form.getAll('categories').map(String);
    if (!categories.length) { setError('Bitte wählen Sie mindestens eine Kategorie aus.'); return; }
    if (modelUrl && !isValidModelUrl(modelUrl)) { setError('Bitte geben Sie eine vollständige HTTP(S)-URL zu einer .fbx-, .glb- oder .gltf-Datei oder zu einem Sketchfab-Modell ein – oder lassen Sie das Feld für einen 3D-Raum leer.'); return; }
    const story = createStory({ ownerId: session.id, authorName: session.name, name: String(form.get('name')), description: String(form.get('description')), modelUrl, coverImage: String(form.get('coverImage')), language: String(form.get('language')), categories });
    try {
      await saveStory(story);
      go(`/studio/${story.id}`);
    } catch (saveError) {
      setError(`Die Story konnte nicht gespeichert werden: ${saveError.message}`);
    }
  }
  return (
    <div className="riu-page create-page"><Header session={session} /><main className="create-layout"><section><span className="riu-overline">Neue Story</span><h1>Ein Ort für Ihre Erzählung.</h1><p>Beginnen Sie mit einem einzelnen 3D-Modell oder erstellen Sie einen begehbaren Raum für mehrere Objekte und Stationen.</p><div className="cors-note"><ExternalLink size={19} /><div><strong>Mit eigenem Modell</strong><span>Bei glTF-, GLB- und FBX-Dateien muss der Modellserver Browserzugriffe per CORS erlauben. Bei Sketchfab genügt die kopierte URL der Modellseite.</span></div></div></section><form className="create-form" onSubmit={submit}><label>Titel der Story<input required name="name" placeholder="Zum Beispiel: Spuren einer Stadt" /></label><label>Kurzbeschreibung<textarea required name="description" rows="4" placeholder="Worum geht es in dieser räumlichen Erzählung?" /></label><div className="create-form-row"><label>Sprache<select required name="language" defaultValue="de">{Object.entries(STORY_LANGUAGES).map(([code, label]) => <option value={code} key={code}>{label}</option>)}</select></label><CategoryPicker /></div><label>URL zum 3D-Modell <span>(optional)</span><input name="modelUrl" type="url" placeholder="https://sketchfab.com/3d-models/… oder https://…/modell.glb" /><small>Sketchfab-Modellseite einfach kopieren und einfügen. Alternativ: FBX, GLB oder glTF über HTTP(S).</small><span className="model-room-hint"><Box size={16} /><span><strong>Kein Modell zur Hand?</strong>Lassen Sie das Feld leer. RIU erstellt dann einen neutralen 3D-Ausstellungsraum, in den Sie später mehrere Objekte einfügen können.</span></span></label><label>Vorschaubild URL <span>(optional)</span><input name="coverImage" type="url" placeholder="https://example.org/cover.jpg" /></label>{error && <div className="form-error">{error}</div>}<div className="create-actions"><button type="button" onClick={() => go('/dashboard')}>Abbrechen</button><button className="riu-button">Story anlegen <ArrowRight size={17} /></button></div></form></main></div>
  );
}

function NotFound({ session }) {
  return <div className="riu-page"><Header session={session} /><main className="not-found"><span>404</span><h1>Diese Seite erzählt noch nichts.</h1><button className="riu-button" onClick={() => go('/')}>Zur Galerie</button></main></div>;
}

export default function PlatformApp() {
  const [ready, setReady] = useState(isPlatformInitialized);
  const [session, setSession] = useState(() => isPlatformInitialized() ? readSession() : null);
  useEffect(() => {
    let active = true;
    platformReady.then(() => {
      if (!active) return;
      setSession(readSession());
      setReady(true);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!session || !document.modelContext?.registerTool) return undefined;
    const controller = new AbortController();
    registerRiuWebMcpTools(document.modelContext, controller.signal).catch((error) => {
      if (!controller.signal.aborted) console.warn('RIU WebMCP tools could not be registered.', error);
    });
    return () => controller.abort();
  }, [session?.id, session?.role, session?.isBlocked]);
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return <Gallery session={session} loading={!ready} />;
  if (path === '/discover') return <Discover session={session} loading={!ready} />;
  // Never read cached private stories or render author controls before auth has
  // finished. Navigation remains usable during slow network initialization.
  if (!ready) return <div className="riu-page"><Header session={null} /><main className="platform-pending" role="status"><h1>Ihr Bereich wird vorbereitet</h1><p>Anmeldung und Stories werden geladen …</p></main></div>;
  if (path === '/login') return session ? <Dashboard session={session} onSession={setSession} /> : <AuthPage mode="login" onSession={setSession} />;
  if (path === '/register') return session ? <Dashboard session={session} onSession={setSession} /> : <AuthPage mode="register" onSession={setSession} />;
  if (path === '/reset-password') return session ? <Dashboard session={session} onSession={setSession} /> : <AuthPage mode="login" />;
  if (path === '/dashboard') return session ? <Dashboard session={session} onSession={setSession} /> : <AuthPage mode="login" onSession={setSession} />;
  if (path === '/account') return session ? <AccountPage session={session} onSession={setSession} /> : <AuthPage mode="login" onSession={setSession} />;
  if (path === '/admin') return isAdmin(session) ? <AdminPage session={session} /> : <NotFound session={session} />;
  if (path.startsWith('/analytics/')) {
    const story = getStory(decodeURIComponent(path.slice('/analytics/'.length)));
    return session && story?.ownerId === session.id
      ? <StoryAnalyticsPage story={story} session={session} />
      : <NotFound session={session} />;
  }
  if (path === '/stories/new') return session ? (canCreateStories(session) ? <NewStory session={session} /> : <Dashboard session={session} onSession={setSession} />) : <AuthPage mode="login" onSession={setSession} />;
  return <NotFound session={session} />;
}
