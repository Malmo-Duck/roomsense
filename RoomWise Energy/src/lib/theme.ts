// Light/dark theme toggle. Mirrors the app's other localStorage-first
// patterns (optimizer/settings.ts, optimizer/feedback.ts) — no backend, just
// a class on <html> the CSS custom properties in styles.css key off of.

export type Theme = "dark" | "light";

const KEY = "roomwise-theme";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(KEY) === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function setTheme(theme: Theme) {
  applyTheme(theme);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    // Storage full/blocked — theme just won't persist across reloads.
  }
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

/** Inline, blocking script string — run from <head> before first paint so
 *  a stored light preference never flashes the default dark theme first. */
export const NO_FLASH_THEME_SCRIPT = `(function(){try{if(localStorage.getItem('${KEY}')==='light')document.documentElement.classList.remove('dark');}catch(e){}})();`;
