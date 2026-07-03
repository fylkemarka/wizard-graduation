// =============================================================================
// AUDIO — synthesized SFX + procedural combat music, with file overrides.
// (Alan, 2026-07-03: "sound effects for hits/defends/casts + an animal sound
// per summon; combat music that escalates normal → elite → boss.")
//
// Everything here is WebAudio-synthesized so it works TODAY with zero assets.
// Any real file dropped into public/audio/sfx/<name>.mp3 or
// public/audio/music/<tier>.mp3 overrides its synth version automatically
// (same pattern as ArtSlot + public/art/**). See design/AUDIO_PROMPTS.md for
// the full filename list.
//
// Hard rules:
//  - NEVER throw: every entry point is try/catch'd; a broken AudioContext
//    (headless e2e, old browser) degrades to silence, not a crash.
//  - No sound before a user gesture (browser autoplay policy). The context
//    unlocks on the first pointerdown/keydown; music requested before that is
//    queued and starts on unlock.
// =============================================================================

let ctx = null;
let masterGain = null;
let unlocked = false;
let pendingMusicTier = null;

const LS_MUTED = 'wg-audio-muted';
const LS_VOLUME = 'wg-audio-volume';

let muted = false;
let volume = 0.7;
try {
  muted = localStorage.getItem(LS_MUTED) === '1';
  const v = parseFloat(localStorage.getItem(LS_VOLUME));
  if (!Number.isNaN(v)) volume = Math.min(1, Math.max(0, v));
} catch { /* no localStorage — defaults */ }

function ensureCtx() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : volume;
    masterGain.connect(ctx.destination);
  } catch { ctx = null; }
  return ctx;
}

// One-time gesture unlock. Installed at module load; idempotent.
function unlock() {
  if (unlocked) return;
  unlocked = true;
  const c = ensureCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
  if (pendingMusicTier) { const t = pendingMusicTier; pendingMusicTier = null; startMusic(t); }
}
try {
  window.addEventListener('pointerdown', unlock, { once: false });
  window.addEventListener('keydown', unlock, { once: false });
} catch { /* SSR/headless */ }

export function setMuted(m) {
  muted = !!m;
  try { localStorage.setItem(LS_MUTED, muted ? '1' : '0'); } catch {}
  if (masterGain) masterGain.gain.value = muted ? 0 : volume;
  if (fileMusicEl) fileMusicEl.muted = muted;
}
export function isMuted() { return muted; }
export function setVolume(v) {
  volume = Math.min(1, Math.max(0, v));
  try { localStorage.setItem(LS_VOLUME, String(volume)); } catch {}
  if (masterGain && !muted) masterGain.gain.value = volume;
  if (fileMusicEl) fileMusicEl.volume = volume * 0.6;
}
export function getVolume() { return volume; }

// ---------- file overrides ----------------------------------------------
// HEAD-probe /audio/... once per name; the SPA fallback returns text/html for
// missing files, so require an audio/* content-type to accept the override.
const probeCache = new Map(); // url -> Promise<boolean>
function fileExists(url) {
  if (!probeCache.has(url)) {
    probeCache.set(url, fetch(url, { method: 'HEAD' })
      .then(r => r.ok && (r.headers.get('content-type') || '').startsWith('audio'))
      .catch(() => false));
  }
  return probeCache.get(url);
}

const sfxElCache = new Map(); // url -> HTMLAudioElement (template; cloned per play)
async function tryFileSfx(name) {
  const url = `/audio/sfx/${name}.mp3`;
  if (!(await fileExists(url))) return false;
  try {
    let el = sfxElCache.get(url);
    if (!el) { el = new Audio(url); sfxElCache.set(url, el); }
    const inst = el.cloneNode();
    inst.volume = muted ? 0 : volume;
    inst.play().catch(() => {});
    return true;
  } catch { return false; }
}

// ---------- synth building blocks ----------------------------------------
function now() { return ctx.currentTime; }

function env(g, t0, attack, peak, decay) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
}

function tone({ type = 'sine', from, to = null, t0, dur, peak = 0.3, glide = null }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t0);
  if (to != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + (glide ?? dur));
  env(g, t0, 0.005, peak, dur);
  o.connect(g); g.connect(masterGain);
  o.start(t0); o.stop(t0 + dur + 0.1);
}

let noiseBuf = null;
function noise({ t0, dur, peak = 0.3, filterType = 'lowpass', freq = 800, q = 1 }) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = filterType; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  env(g, t0, 0.005, peak, dur);
  src.connect(f); f.connect(g); g.connect(masterGain);
  src.start(t0); src.stop(t0 + dur + 0.1);
}

// ---------- SFX library ---------------------------------------------------
// Combat verbs. Names are the public API + the override filenames.
const SFX = {
  // player or enemy takes a physical hit — low thud
  hit:       (t) => { noise({ t0: t, dur: 0.12, peak: 0.5, freq: 300 }); tone({ from: 90, to: 45, t0: t, dur: 0.18, peak: 0.4, type: 'sine' }); },
  // composure damage — a verbal sting; sharper, higher
  'hit-composure': (t) => { noise({ t0: t, dur: 0.08, peak: 0.25, filterType: 'bandpass', freq: 1800, q: 6 }); tone({ from: 700, to: 320, t0: t, dur: 0.14, peak: 0.3, type: 'triangle' }); },
  // gaining Block — metallic clink
  block:     (t) => { tone({ from: 1250, t0: t, dur: 0.09, peak: 0.22, type: 'square' }); tone({ from: 1875, t0: t + 0.01, dur: 0.07, peak: 0.12, type: 'sine' }); },
  // gaining Poise — softer glassy ting
  poise:     (t) => { tone({ from: 1560, t0: t, dur: 0.16, peak: 0.15, type: 'sine' }); tone({ from: 2340, t0: t + 0.03, dur: 0.12, peak: 0.08, type: 'sine' }); },
  // casting a spell — rising shimmer
  cast:      (t) => { tone({ from: 320, to: 960, t0: t, dur: 0.3, peak: 0.2, type: 'sawtooth' }); tone({ from: 480, to: 1440, t0: t + 0.04, dur: 0.28, peak: 0.12, type: 'triangle' }); noise({ t0: t + 0.1, dur: 0.2, peak: 0.06, filterType: 'highpass', freq: 4000 }); },
  // enemy defeated — small settling resolution
  victory:   (t) => { [523, 659, 784].forEach((f, i) => tone({ from: f, t0: t + i * 0.09, dur: 0.25, peak: 0.15, type: 'triangle' })); },
};

// Animal calls, keyed by animalId. Each is a tiny synth caricature.
const ANIMAL_SFX = {
  goose:            (t) => { tone({ from: 220, to: 175, t0: t, dur: 0.16, peak: 0.35, type: 'square' }); tone({ from: 230, to: 180, t0: t + 0.2, dur: 0.14, peak: 0.3, type: 'square' }); },
  raven:            (t) => { for (let i = 0; i < 2; i++) tone({ from: 480, to: 260, t0: t + i * 0.18, dur: 0.13, peak: 0.28, type: 'sawtooth' }); },
  'field-mouse':    (t) => { tone({ from: 1900, to: 2600, t0: t, dur: 0.08, peak: 0.18, type: 'sine' }); tone({ from: 2100, to: 2800, t0: t + 0.1, dur: 0.06, peak: 0.14, type: 'sine' }); },
  'mecha-mouse':    (t) => { tone({ from: 1900, to: 2600, t0: t, dur: 0.07, peak: 0.16, type: 'sine' }); tone({ from: 700, t0: t + 0.1, dur: 0.05, peak: 0.14, type: 'square' }); },
  'young-buck':     (t) => { noise({ t0: t, dur: 0.14, peak: 0.35, freq: 500 }); tone({ from: 140, to: 90, t0: t, dur: 0.14, peak: 0.2, type: 'triangle' }); },
  'james-deer':     (t) => { noise({ t0: t, dur: 0.1, peak: 0.28, freq: 450 }); tone({ from: 160, to: 110, t0: t + 0.12, dur: 0.16, peak: 0.2, type: 'triangle' }); },
  rabbit:           (t) => { tone({ from: 130, t0: t, dur: 0.06, peak: 0.3, type: 'sine' }); tone({ from: 130, t0: t + 0.11, dur: 0.06, peak: 0.3, type: 'sine' }); },
  'bonzai-bunaroo': (t) => { tone({ from: 150, t0: t, dur: 0.06, peak: 0.3, type: 'sine' }); tone({ from: 200, to: 400, t0: t + 0.12, dur: 0.1, peak: 0.2, type: 'triangle' }); },
  ox:               (t) => { tone({ from: 95, to: 78, t0: t, dur: 0.5, peak: 0.35, type: 'sawtooth' }); tone({ from: 190, to: 156, t0: t + 0.05, dur: 0.4, peak: 0.12, type: 'sine' }); },
  sheepdog:         (t) => { for (let i = 0; i < 2; i++) { noise({ t0: t + i * 0.16, dur: 0.07, peak: 0.3, filterType: 'bandpass', freq: 900, q: 2 }); tone({ from: 420, to: 300, t0: t + i * 0.16, dur: 0.08, peak: 0.22, type: 'square' }); } },
  lyrebird:         (t) => { [880, 1320, 990, 1480].forEach((f, i) => tone({ from: f, t0: t + i * 0.07, dur: 0.06, peak: 0.15, type: 'sine' })); },
  porcupine:        (t) => { noise({ t0: t, dur: 0.25, peak: 0.15, filterType: 'highpass', freq: 2500 }); },
  sloth:            (t) => { tone({ from: 420, to: 180, t0: t, dur: 0.7, peak: 0.15, type: 'sine', glide: 0.7 }); },
  pigeon:           (t) => { for (let i = 0; i < 2; i++) tone({ from: 380, to: 430, t0: t + i * 0.22, dur: 0.16, peak: 0.2, type: 'sine' }); },
  kangaroo:         (t) => { tone({ from: 180, to: 520, t0: t, dur: 0.22, peak: 0.25, type: 'triangle', glide: 0.18 }); },
  salmon:           (t) => { noise({ t0: t, dur: 0.3, peak: 0.3, filterType: 'highpass', freq: 1200 }); noise({ t0: t + 0.12, dur: 0.15, peak: 0.15, filterType: 'highpass', freq: 2000 }); },
  bear:             (t) => { tone({ from: 110, to: 70, t0: t, dur: 0.7, peak: 0.4, type: 'sawtooth' }); noise({ t0: t, dur: 0.6, peak: 0.2, freq: 400 }); },
  hawk:             (t) => { tone({ from: 2800, to: 1400, t0: t, dur: 0.35, peak: 0.2, type: 'sawtooth' }); },
  owl:              (t) => { for (let i = 0; i < 2; i++) tone({ from: 500, to: 470, t0: t + i * 0.28, dur: 0.2, peak: 0.2, type: 'sine' }); },
  'rabid-scrubjay': (t) => { for (let i = 0; i < 3; i++) tone({ from: 1600, to: 1100, t0: t + i * 0.09, dur: 0.06, peak: 0.2, type: 'square' }); },
};
const ANIMAL_FALLBACK = (t) => { tone({ from: 900, to: 1300, t0: t, dur: 0.1, peak: 0.18, type: 'sine' }); };

// Throttle per-name so a 6-swing volley doesn't stack 6 identical thuds.
const lastPlayed = new Map();
function throttled(name, ms = 60) {
  const t = Date.now();
  if ((lastPlayed.get(name) || 0) + ms > t) return true;
  lastPlayed.set(name, t);
  return false;
}

export function playSfx(name) {
  try {
    if (muted || throttled(name)) return;
    tryFileSfx(name).then(usedFile => {
      if (usedFile) return;
      const c = ensureCtx();
      if (!c || c.state !== 'running') return;
      const fn = SFX[name];
      if (fn) fn(now());
    });
  } catch { /* silence over crash, always */ }
}

export function playAnimalSfx(animalId) {
  try {
    if (muted || throttled(`animal-${animalId}`, 150)) return;
    tryFileSfx(`animal-${animalId}`).then(usedFile => {
      if (usedFile) return;
      const c = ensureCtx();
      if (!c || c.state !== 'running') return;
      (ANIMAL_SFX[animalId] || ANIMAL_FALLBACK)(now());
    });
  } catch { /* silence */ }
}

// ---------- procedural combat music --------------------------------------
// Three escalating tiers. A shared scheduler walks a per-tier pattern with a
// lookahead timer; all voices route through musicGain (under masterGain) so
// SFX stay audible above the bed.
//   normal — a slow two-note drone + sparse plucked minor pentatonic
//   elite  — + driving eighth-note bass pulse, quicker, dorian tension
//   boss   — + percussion (noise hats, kick), arpeggio runs, half-step menace
let musicTimer = null;
let musicGain = null;
let musicTier = null;
let stepIdx = 0;
let nextStepTime = 0;
let fileMusicEl = null;

const SCALES = {
  normal: [110, 130.81, 146.83, 164.81, 196],           // A minor pentatonic-ish
  elite:  [110, 123.47, 130.81, 146.83, 164.81, 174.61], // A dorian colour
  boss:   [110, 116.54, 130.81, 146.83, 155.56, 164.81], // half-step menace
};
const TEMPO = { normal: 70, elite: 104, boss: 128 };

function musicVoiceTone(freq, t0, dur, type, peak) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  env(g, t0, 0.01, peak, dur);
  o.connect(g); g.connect(musicGain);
  o.start(t0); o.stop(t0 + dur + 0.1);
}
function musicNoise(t0, dur, peak, freq) {
  if (!noiseBuf) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
  const g = ctx.createGain(); env(g, t0, 0.003, peak, dur);
  src.connect(f); f.connect(g); g.connect(musicGain);
  src.start(t0); src.stop(t0 + dur + 0.05);
}

function scheduleStep(tier, i, t) {
  const scale = SCALES[tier];
  const beat = 60 / TEMPO[tier];
  // Drone: refresh root + fifth every 8 steps.
  if (i % 8 === 0) {
    musicVoiceTone(scale[0] / 2, t, beat * 8, 'sawtooth', 0.05);
    musicVoiceTone(scale[0] * 1.5 / 2, t, beat * 8, 'sine', 0.04);
  }
  if (tier === 'normal') {
    // Sparse pluck on some off-beats.
    if (i % 4 === 2 && Math.random() < 0.7) {
      musicVoiceTone(scale[1 + Math.floor(Math.random() * (scale.length - 1))] * 2, t, beat * 0.9, 'triangle', 0.08);
    }
  } else {
    // Elite+: eighth-note bass pulse.
    musicVoiceTone(scale[0], t, beat * 0.4, 'square', i % 2 === 0 ? 0.07 : 0.045);
    if (i % 4 === 2) musicVoiceTone(scale[2] * 2, t, beat * 0.8, 'triangle', 0.07);
    if (i % 8 === 6) musicVoiceTone(scale[4] * 2, t, beat * 0.8, 'triangle', 0.06);
  }
  if (tier === 'boss') {
    // Percussion: hat every step, kick on the 1 and the and-of-2.
    musicNoise(t, 0.04, 0.05, 6000);
    if (i % 4 === 0 || i % 8 === 5) {
      musicVoiceTone(55, t, 0.15, 'sine', 0.22);
    }
    // Menace arpeggio run every other bar.
    if (i % 16 === 12) {
      [0, 1, 3, 5].forEach((s, k) => musicVoiceTone(scale[s % scale.length] * 4, t + k * beat * 0.25, beat * 0.22, 'sawtooth', 0.05));
    }
  }
}

function musicLoop() {
  if (!ctx || musicTier == null) return;
  const beat = 60 / TEMPO[musicTier];
  const step = musicTier === 'normal' ? beat : beat / 2;
  while (nextStepTime < ctx.currentTime + 0.15) {
    scheduleStep(musicTier, stepIdx, Math.max(nextStepTime, ctx.currentTime + 0.01));
    stepIdx += 1;
    nextStepTime += step;
  }
}

export function startMusic(tierRaw) {
  try {
    const tier = tierRaw === 'boss' ? 'boss' : tierRaw === 'elite' ? 'elite' : 'normal';
    if (!unlocked) { pendingMusicTier = tier; return; }
    stopMusic();
    // File override first.
    const url = `/audio/music/${tier}.mp3`;
    fileExists(url).then(has => {
      if (musicTier !== null || fileMusicEl) return; // something else started meanwhile
      if (has) {
        try {
          fileMusicEl = new Audio(url);
          fileMusicEl.loop = true;
          fileMusicEl.volume = volume * 0.6;
          fileMusicEl.muted = muted;
          fileMusicEl.play().catch(() => {});
          return;
        } catch { /* fall through to synth */ }
      }
      const c = ensureCtx();
      if (!c || c.state !== 'running') return;
      musicGain = c.createGain();
      musicGain.gain.value = 0.5; // bed sits under the SFX
      musicGain.connect(masterGain);
      musicTier = tier;
      stepIdx = 0;
      nextStepTime = c.currentTime + 0.05;
      musicTimer = setInterval(musicLoop, 40);
    });
  } catch { /* silence */ }
}

export function stopMusic() {
  try {
    pendingMusicTier = null;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (musicGain) {
      const g = musicGain; musicGain = null;
      // Quick fade so the bed doesn't clip off.
      try { g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.4); } catch {}
      setTimeout(() => { try { g.disconnect(); } catch {} }, 600);
    }
    musicTier = null;
    if (fileMusicEl) { try { fileMusicEl.pause(); } catch {} fileMusicEl = null; }
  } catch { /* silence */ }
}
