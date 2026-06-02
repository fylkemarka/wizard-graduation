// Deterministic-RNG hook for E2E/dev. When the page is loaded with `?seed=N`,
// we replace Math.random with a seeded mulberry32 PRNG so the entire game
// (shuffles, draws, enemy intent rolls, Loom steal picks, postcards) plays out
// identically every run. This makes targeted mechanic tests — which otherwise
// depend on unseeded RNG firing the right way over many turns — fully
// deterministic in Playwright.
//
// Only the global Math.random is swapped; uid() is already counter-based, so
// the two together give a reproducible session. No-op when ?seed is absent, so
// normal play is untouched.

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function installSeedFromUrl() {
  if (typeof window === 'undefined') return false;
  let seed;
  try {
    const params = new URLSearchParams(window.location.search);
    // E2E hook: ?forceSwoop=owl|hawk makes the next eligible raptor swoop
    // fire deterministically (consumed once), so the swoop UI is regression-
    // testable without hunting a fragile RNG seed. No-op when absent.
    const forced = params.get('forceSwoop');
    if (forced === 'owl' || forced === 'hawk') window.__forceSwoop = forced;
    // E2E hook: ?forceSalmonRoll=owl|hawk|bear makes a Salmon's next predator
    // roll succeed deterministically with that species (consumed once), so the
    // Salmon→predator gamble + owl pre-attack-Vulnerable render path is
    // regression-testable without fighting the 50% roll. No-op when absent.
    const forcedSalmon = params.get('forceSalmonRoll');
    if (forcedSalmon === 'owl' || forcedSalmon === 'hawk' || forcedSalmon === 'bear') {
      window.__forceSalmonRoll = forcedSalmon;
    }
    // E2E hook: ?forceMaul makes the next enemy intent roll pick that enemy's
    // maul behavior (consumed once in rollIntent), so the maul render path is
    // regression-testable without hunting a fragile RNG seed. No-op when absent.
    if (params.get('forceMaul') != null) window.__forceMaul = true;
    // E2E hook: ?forceSpecies=field-mouse pins every random summon-pool pick to
    // that species (when the pool offers it), so a three-of-a-kind combine and
    // its on-form burst render path is regression-testable without fighting the
    // random Tender Greens roll. Persists (not consumed). No-op when absent.
    const forcedSpecies = params.get('forceSpecies');
    if (forcedSpecies) window.__forceSpecies = forcedSpecies;
    const raw = params.get('seed');
    if (raw === null) return false;
    seed = Number(raw);
  } catch {
    return false;
  }
  if (!Number.isFinite(seed)) return false;

  const rng = mulberry32(seed >>> 0);
  Math.random = rng;
  window.__seedRng = rng;
  window.__seed = seed >>> 0;
  return true;
}
