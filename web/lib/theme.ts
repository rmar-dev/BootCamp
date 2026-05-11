export type ThemeMode = 'system' | 'light' | 'dark';
export type Density = 'comfortable' | 'compact';

export const THEME_STORAGE_KEY = 'bootcamp.theme';
export const DENSITY_STORAGE_KEY = 'bootcamp.density';

/**
 * Inline script body (as a string) to set theme + density attributes on <html>
 * before React hydrates. Prevents a light-to-dark flash on page load.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem('${THEME_STORAGE_KEY}') || 'system';
    var density = localStorage.getItem('${DENSITY_STORAGE_KEY}') || 'comfortable';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = theme === 'dark' || (theme === 'system' && prefersDark);
    var root = document.documentElement;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.setAttribute('data-density', density);
    if (dark) root.classList.add('dark');
    else root.classList.remove('dark');
  } catch (e) {}
})();
`.trim();

export function applyTheme(mode: ThemeMode) {
  if (typeof window === 'undefined') return;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = mode === 'dark' || (mode === 'system' && prefersDark);
  const root = document.documentElement;
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  root.classList.toggle('dark', dark);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function applyDensity(density: Density) {
  if (typeof window === 'undefined') return;
  document.documentElement.setAttribute('data-density', density);
  try {
    localStorage.setItem(DENSITY_STORAGE_KEY, density);
  } catch {
    /* ignore */
  }
}

export function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'system';
}

export function readStoredDensity(): Density {
  if (typeof window === 'undefined') return 'comfortable';
  try {
    const v = localStorage.getItem(DENSITY_STORAGE_KEY) as Density | null;
    if (v === 'comfortable' || v === 'compact') return v;
  } catch {
    /* ignore */
  }
  return 'comfortable';
}
