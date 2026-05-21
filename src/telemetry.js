// Wizard Graduation — browser telemetry + error capture.
//
// What this does:
//   1. Captures uncaught JS errors + unhandled promise rejections.
//   2. Records gameplay events (card plays, picks, node choices, outcomes).
//   3. Persists to localStorage so a refresh doesn't wipe the session.
//   4. Exposes export/clear/stats helpers for a debug panel + the
//      future humanPolicy ingest step.
//
// Storage shape (localStorage key WG_TELEMETRY_KEY):
//   {
//     sessionId: "wg-<ms>-<random>",
//     startedAt: ISO string,
//     events:  [{ t, type, payload }],
//     errors:  [{ t, message, stack, context }],
//   }
//
// Events are capped at TELEMETRY_MAX_EVENTS to keep localStorage bounded.
// Each session writes its own key so multiple runs can coexist; export
// pulls every session matching the key prefix.

const STORAGE_PREFIX = 'wg-telemetry-';
const SESSION_VERSION = 1;
const TELEMETRY_MAX_EVENTS = 5000;
const TELEMETRY_MAX_ERRORS = 200;

function genSessionId() {
  return `wg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Module-level singleton. main.jsx imports installTelemetry() once at
// boot; the rest of the app calls logEvent / logError directly.
let SESSION = null;
let WRITE_TIMER = null;

function storageKey() { return `${STORAGE_PREFIX}${SESSION.sessionId}`; }

function persist() {
  // Debounce localStorage writes so a burst of events (e.g. 5 plays in
  // a turn) doesn't thrash the synchronous serializer.
  if (WRITE_TIMER) return;
  WRITE_TIMER = setTimeout(() => {
    WRITE_TIMER = null;
    try { localStorage.setItem(storageKey(), JSON.stringify(SESSION)); }
    catch (e) { /* localStorage quota — silent drop, in-memory log keeps going */ }
  }, 250);
}

export function installTelemetry() {
  if (SESSION) return SESSION;
  SESSION = {
    version: SESSION_VERSION,
    sessionId: genSessionId(),
    startedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    events: [],
    errors: [],
  };
  // Global error handlers — catch anything React/the game throws.
  window.addEventListener('error', (e) => {
    logError(e.error || e.message, { source: 'window.onerror', filename: e.filename, lineno: e.lineno, colno: e.colno });
  });
  window.addEventListener('unhandledrejection', (e) => {
    logError(e.reason, { source: 'unhandledrejection' });
  });
  // Console.error monkey-patch — catches React warnings + manual error logs.
  const origConsoleError = console.error.bind(console);
  console.error = (...args) => {
    try { logError(args.map(a => (a && a.stack) ? a.stack : String(a)).join(' '), { source: 'console.error' }); }
    catch (_) { /* never let telemetry break the app */ }
    origConsoleError(...args);
  };
  persist();
  return SESSION;
}

export function logEvent(type, payload) {
  if (!SESSION) installTelemetry();
  SESSION.events.push({ t: Date.now(), type, payload });
  // Keep the buffer bounded — drop oldest if exceeded.
  if (SESSION.events.length > TELEMETRY_MAX_EVENTS) {
    SESSION.events.splice(0, SESSION.events.length - TELEMETRY_MAX_EVENTS);
  }
  persist();
}

export function logError(errOrMsg, context = {}) {
  if (!SESSION) installTelemetry();
  const isErr = errOrMsg && typeof errOrMsg === 'object';
  SESSION.errors.push({
    t: Date.now(),
    message: isErr ? (errOrMsg.message || String(errOrMsg)) : String(errOrMsg),
    stack: isErr && errOrMsg.stack ? errOrMsg.stack : null,
    context,
  });
  if (SESSION.errors.length > TELEMETRY_MAX_ERRORS) {
    SESSION.errors.splice(0, SESSION.errors.length - TELEMETRY_MAX_ERRORS);
  }
  persist();
}

export function getStats() {
  if (!SESSION) return { events: 0, errors: 0, sessionId: null, startedAt: null };
  return {
    events: SESSION.events.length,
    errors: SESSION.errors.length,
    sessionId: SESSION.sessionId,
    startedAt: SESSION.startedAt,
  };
}

// Return all sessions in localStorage (the current one + any previous
// runs that weren't cleared). humanPolicy.js consumes this shape.
export function loadAllSessions() {
  const sessions = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(STORAGE_PREFIX)) continue;
    try { sessions.push(JSON.parse(localStorage.getItem(k))); }
    catch (_) { /* corrupt entry — skip */ }
  }
  return sessions.sort((a, b) => (a.startedAt || '').localeCompare(b.startedAt || ''));
}

export function exportAllSessions() {
  const sessions = loadAllSessions();
  const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `wg-telemetry-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function clearTelemetry() {
  // Drop every wg-telemetry-* key, then start a fresh session.
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith(STORAGE_PREFIX)) localStorage.removeItem(k);
  }
  SESSION = null;
  installTelemetry();
}

// Convenience: most game events fit the shape `{ stage, ...payload }`.
// Callers don't need to import the constant.
export const TelemetryEvents = {
  // Game flow
  RUN_START: 'run.start',
  RUN_END: 'run.end',
  ACT_CLEARED: 'act.cleared',
  STAGE_CHANGE: 'stage.change',
  // Picks
  CARD_PICK: 'pick.card',          // reward / supply / starter
  STARTING_PICK: 'pick.starting',
  REWARD_SKIP: 'pick.skip',
  MAP_NODE: 'pick.node',
  EVENT_CHOICE: 'pick.event_choice',
  SIDEQUEST_CHOICE: 'pick.sidequest_choice',
  REST_CHOICE: 'pick.rest_choice',
  // Combat
  COMBAT_START: 'combat.start',
  COMBAT_END: 'combat.end',
  CARD_PLAY: 'combat.card_play',
  SPELL_CAST: 'combat.spell_cast',
  TURN_END: 'combat.turn_end',
  // Crafting / progression
  MATERIAL_HARVEST: 'craft.harvest',
  CRAFT_DONE: 'craft.done',
  SKILL_LEVEL: 'craft.skill',
  // Insult
  INSULT_PICK: 'insult.pick',
  INSULT_RESOLVE: 'insult.resolve',
};
