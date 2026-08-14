import { getActiveProjectSounds } from '../audio/projectSounds.js';
import { readProjectSoundFile } from '../audio/projectSoundStore.js';

export function detectThunderEvents(buffer) {
  if (!buffer?.getChannelData || !Number.isFinite(buffer.sampleRate) || buffer.duration < 1) return [];
  const channel = buffer.getChannelData(0);
  const windowSize = Math.max(1, Math.floor(buffer.sampleRate * 0.12));
  const energy = [];
  for (let start = 0; start < channel.length; start += windowSize) {
    let sum = 0;
    const end = Math.min(start + windowSize, channel.length);
    for (let index = start; index < end; index += 1) sum += channel[index] * channel[index];
    energy.push(Math.sqrt(sum / Math.max(1, end - start)));
  }
  if (!energy.length) return [];
  const sorted = [...energy].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length * 0.5)] || 0;
  const upperQuartile = sorted[Math.floor(sorted.length * 0.75)] || median;
  const threshold = Math.max(median * 1.65, upperQuartile * 1.28);
  const minimumGapWindows = Math.max(1, Math.round(3.5 / 0.12));
  const candidates = energy.map((value, index) => ({ value, index }))
    .filter(({ value, index }) => value >= threshold
      && value >= (energy[index - 1] ?? -Infinity)
      && value >= (energy[index + 1] ?? -Infinity))
    .sort((a, b) => b.value - a.value);
  const selected = [];
  candidates.forEach((candidate) => {
    if (selected.every((entry) => Math.abs(entry.index - candidate.index) >= minimumGapWindows)) {
      selected.push(candidate);
    }
  });
  if (selected.length === 0) {
    const strongest = energy.reduce((best, value, index) => value > best.value ? { value, index } : best, { value: -Infinity, index: 0 });
    selected.push(strongest);
  }
  const maximumEvents = Math.max(3, Math.min(14, Math.ceil(buffer.duration / 12)));
  return selected.slice(0, maximumEvents)
    .map(({ index }) => Math.min(buffer.duration - 0.01, index * 0.12))
    .sort((a, b) => a - b);
}

class AudioManager {
  constructor() {
    this.ctx = null;
    this.mainGain = null;
    this.isMuted = true;
    this.isInitialized = false;
    this.pendingAudio = {};
    this.pendingStationId = '';
    this.activeSources = new Map();
    this.bufferCache = new Map();
    this.syncRevision = 0;
    this._unlockAudio = this.unlockAudio.bind(this);
    if (typeof window !== 'undefined') {
      window.addEventListener('click', this._unlockAudio, { capture: true });
      window.addEventListener('touchstart', this._unlockAudio, { capture: true });
    }
  }

  init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      this.ctx = new AudioContextClass();
      this.mainGain = this.ctx.createGain();
      this.mainGain.gain.setValueAtTime(this.isMuted ? 0 : 0.8, this.ctx.currentTime);
      this.mainGain.connect(this.ctx.destination);
      this.isInitialized = true;
      this.refreshAmbience();
    } catch (error) {
      console.warn('AudioContext failed to start:', error);
    }
  }

  unlockAudio() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (this.ctx.state === 'running') {
      window.removeEventListener('click', this._unlockAudio, { capture: true });
      window.removeEventListener('touchstart', this._unlockAudio, { capture: true });
    }
  }

  syncAmbience(audio, stationId) {
    this.pendingAudio = audio ?? {};
    this.pendingStationId = stationId ?? '';
    if (this.isInitialized) this.refreshAmbience();
  }

  getActiveSoundIds() {
    return new Set(getActiveProjectSounds(this.pendingAudio, this.pendingStationId).map((sound) => sound.id));
  }

  getActiveSoundEffects() {
    return new Map(getActiveProjectSounds(this.pendingAudio, this.pendingStationId)
      .map((sound) => [sound.id, sound.dynamics ?? 100]));
  }

  getThunderCue() {
    const active = this.activeSources.get('builtin-thunder');
    if (!active?.thunderBuffer || !active.thunderEvents?.length || !this.ctx || active.intensity <= 0 || active.dynamics <= 0) return null;
    if (this.ctx.currentTime >= active.nextFlashAt) {
      active.flashSerial += 1;
      const dynamicsRate = Math.max(0.25, active.dynamics / 100);
      active.nextFlashAt = this.ctx.currentTime + Math.max(3, (6 + Math.random() * 10) / dynamicsRate);
      const thunderPeak = active.thunderEvents[Math.floor(Math.random() * active.thunderEvents.length)];
      const thunderDelay = 0.12;
      const offset = Math.max(0, thunderPeak - 0.03);
      const duration = Math.min(6, active.thunderBuffer.duration - offset);
      const outputDuration = duration;
      const source = this.ctx.createBufferSource();
      const thunderGain = this.ctx.createGain();
      source.buffer = active.thunderBuffer;
      thunderGain.gain.setValueAtTime(0.001, this.ctx.currentTime + thunderDelay);
      thunderGain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + thunderDelay + 0.06);
      thunderGain.gain.setValueAtTime(1, this.ctx.currentTime + thunderDelay + Math.max(0.1, outputDuration - 1));
      thunderGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + thunderDelay + outputDuration);
      source.connect(thunderGain);
      thunderGain.connect(active.gain);
      source.onended = () => {
        active.sources.delete(source);
        thunderGain.disconnect();
      };
      active.sources.add(source);
      source.start(this.ctx.currentTime + thunderDelay, offset, duration);
      active.lastThunderDelay = thunderDelay;
    }
    return { serial: active.flashSerial, thunderDelay: active.lastThunderDelay };
  }

  async getSoundBuffer(sound) {
    const cacheKey = sound.storageKey || sound.url;
    if (this.bufferCache.has(cacheKey)) return this.bufferCache.get(cacheKey);
    let arrayBuffer;
    if (sound.source === 'custom') {
      const blob = sound.storageKey ? await readProjectSoundFile(sound.storageKey) : null;
      if (!blob && !sound.url) throw new Error('Die lokale Audiodatei wurde nicht gefunden.');
      arrayBuffer = blob
        ? await blob.arrayBuffer()
        : await (await fetch(sound.url)).arrayBuffer();
    } else {
      arrayBuffer = await (await fetch(sound.url)).arrayBuffer();
    }
    const buffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.bufferCache.set(cacheKey, buffer);
    return buffer;
  }

  startLoopSound(sound, buffer) {
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const dynamicsGain = this.ctx.createGain();
    const dynamicsLfo = this.ctx.createOscillator();
    const dynamicsLfoGain = this.ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime((sound.volume ?? 0.28) * (sound.intensity ?? 100) / 100, this.ctx.currentTime + 0.6);
    source.connect(dynamicsGain);
    dynamicsGain.connect(gain);
    dynamicsLfo.connect(dynamicsLfoGain);
    dynamicsLfoGain.connect(dynamicsGain.gain);
    gain.connect(this.mainGain);
    dynamicsLfo.start();
    source.start();
    const active = {
      gain,
      sources: new Set([source]),
      modulators: new Set([dynamicsLfo]),
      dynamicsGain,
      dynamicsLfo,
      dynamicsLfoGain,
      soundId: sound.id,
      timer: null,
      startedAt: this.ctx.currentTime,
      duration: buffer.duration,
      thunderEvents: sound.id === 'builtin-thunder' ? detectThunderEvents(buffer) : []
    };
    this.applyLoopDynamics(active, sound.dynamics ?? 100, true);
    return active;
  }

  applyLoopDynamics(active, dynamics, immediate = false) {
    active.dynamics = dynamics;
    if (!active.dynamicsGain || !this.ctx) return;
    const amount = Math.max(0, Math.min(2, dynamics / 100));
    const depth = Math.min(0.72, amount * 0.38);
    const baseFrequency = active.soundId === 'builtin-wind' ? 0.075
      : active.soundId === 'builtin-rain' ? 0.16
        : active.soundId === 'builtin-fire' ? 0.34
          : active.soundId === 'builtin-night' ? 0.055
            : 0.09;
    const when = immediate ? this.ctx.currentTime : this.ctx.currentTime + 0.15;
    active.dynamicsGain.gain.linearRampToValueAtTime(1, when);
    active.dynamicsLfoGain.gain.linearRampToValueAtTime(depth / 2, when);
    active.dynamicsLfo.frequency.linearRampToValueAtTime(baseFrequency * (0.65 + amount * 0.55), when);
  }

  startRandomSound(sound, buffers) {
    const gain = this.ctx.createGain();
    const active = { gain, sources: new Set(), timer: null, dynamics: sound.dynamics ?? 100 };
    gain.gain.setValueAtTime((sound.volume ?? 0.4) * (sound.intensity ?? 100) / 100, this.ctx.currentTime);
    gain.connect(this.mainGain);
    const schedule = (initial = false) => {
      active.timer = window.setTimeout(() => {
        if (!this.activeSources.has(sound.id) || !buffers.length) return;
        if (active.dynamics <= 0) {
          schedule(true);
          return;
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffers[Math.floor(Math.random() * buffers.length)];
        source.connect(gain);
        source.onended = () => active.sources.delete(source);
        active.sources.add(source);
        source.start();
        schedule();
      }, initial ? 900 : Math.max(1600, (3500 + Math.random() * 6500) / Math.max(0.25, active.dynamics / 100)));
    };
    schedule(true);
    return active;
  }

  startThunderSound(sound, rainBuffer, thunderBuffer) {
    const active = this.startLoopSound(sound, rainBuffer);
    active.thunderBuffer = thunderBuffer;
    active.thunderEvents = detectThunderEvents(thunderBuffer);
    active.nextFlashAt = this.ctx.currentTime + (2 + Math.random() * 4) / Math.max(0.25, (sound.dynamics ?? 100) / 100);
    active.flashSerial = 0;
    active.lastThunderDelay = 0;
    active.intensity = sound.intensity ?? 100;
    active.dynamics = sound.dynamics ?? 100;
    return active;
  }

  stopSound(soundId) {
    const active = this.activeSources.get(soundId);
    if (!active || !this.ctx) return;
    active.gain.gain.cancelScheduledValues(this.ctx.currentTime);
    active.gain.gain.setValueAtTime(active.gain.gain.value, this.ctx.currentTime);
    active.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.35);
    if (active.timer) window.clearTimeout(active.timer);
    active.modulators?.forEach((source) => {
      try { source.stop(); source.disconnect(); } catch { /* Already stopped. */ }
    });
    window.setTimeout(() => {
      active.sources.forEach((source) => {
        try { source.stop(); source.disconnect(); } catch { /* Already stopped. */ }
      });
      try { active.gain.disconnect(); } catch { /* Already disconnected. */ }
    }, 400);
    this.activeSources.delete(soundId);
  }

  async refreshAmbience() {
    if (!this.ctx || !this.mainGain) return;
    const revision = ++this.syncRevision;
    const sounds = getActiveProjectSounds(this.pendingAudio, this.pendingStationId);
    const wantedIds = new Set(sounds.map((sound) => sound.id));
    [...this.activeSources.keys()].filter((id) => !wantedIds.has(id)).forEach((id) => this.stopSound(id));

    await Promise.all(sounds.map(async (sound) => {
      const existing = this.activeSources.get(sound.id);
      if (existing) {
        existing.intensity = sound.intensity ?? 100;
        existing.dynamics = sound.dynamics ?? 100;
        this.applyLoopDynamics(existing, existing.dynamics);
        existing.gain.gain.cancelScheduledValues(this.ctx.currentTime);
        existing.gain.gain.linearRampToValueAtTime(
          (sound.volume ?? (sound.mode === 'random' ? 0.4 : 0.28)) * (sound.intensity ?? 100) / 100,
          this.ctx.currentTime + 0.15
        );
        return;
      }
      try {
        const buffers = sound.mode === 'random'
          ? await Promise.all(sound.urls.map((url) => this.getSoundBuffer({ ...sound, url })))
          : sound.mode === 'thunder'
            ? await Promise.all([
              this.getSoundBuffer(sound),
              this.getSoundBuffer({ ...sound, url: sound.thunderUrl })
            ])
            : [await this.getSoundBuffer(sound)];
        if (revision !== this.syncRevision || !getActiveProjectSounds(this.pendingAudio, this.pendingStationId).some((entry) => entry.id === sound.id)) return;
        const active = sound.mode === 'random'
          ? this.startRandomSound(sound, buffers)
          : sound.mode === 'thunder'
            ? this.startThunderSound(sound, buffers[0], buffers[1])
            : this.startLoopSound(sound, buffers[0]);
        this.activeSources.set(sound.id, active);
      } catch (error) {
        console.warn(`Sound "${sound.name}" konnte nicht geladen werden.`, error);
      }
    }));
  }

  playTransition() {
    if (!this.isInitialized || this.isMuted || !this.ctx || this.ctx.state !== 'running') return;
    try {
      const oscillator = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(110, this.ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 1.8);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 1.8);
      gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.035, this.ctx.currentTime + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.8);
      oscillator.connect(filter); filter.connect(gain); gain.connect(this.mainGain);
      oscillator.start(); oscillator.stop(this.ctx.currentTime + 1.8);
    } catch { /* Optional UI sound. */ }
  }

  playClick() {
    if (!this.isInitialized || this.isMuted || !this.ctx || this.ctx.state !== 'running') return;
    try {
      const oscillator = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1200, this.ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.015, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
      oscillator.connect(gain); gain.connect(this.mainGain);
      oscillator.start(); oscillator.stop(this.ctx.currentTime + 0.12);
    } catch { /* Optional UI sound. */ }
  }

  setMute(mute) {
    this.isMuted = mute;
    if (!mute) this.unlockAudio();
    if (this.mainGain && this.ctx) {
      this.mainGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.mainGain.gain.linearRampToValueAtTime(mute ? 0 : 0.8, this.ctx.currentTime + 0.3);
    }
  }

  dispose() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('click', this._unlockAudio, { capture: true });
      window.removeEventListener('touchstart', this._unlockAudio, { capture: true });
    }
    [...this.activeSources.keys()].forEach((id) => this.stopSound(id));
    const audioContext = this.ctx;
    this.ctx = null;
    this.mainGain = null;
    this.activeSources.clear();
    this.bufferCache.clear();
    this.isInitialized = false;
    if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => {});
  }
}

export const audioManager = new AudioManager();
if (typeof window !== 'undefined') window.audioManager = audioManager;
