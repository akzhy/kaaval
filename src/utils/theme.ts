import type { ThemePreference } from "./types";

const THEME_STORAGE_KEY = "kaaval.theme-preference";
const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

let activeSystemThemeQuery: MediaQueryList | null = null;
let activeSystemThemeListener: ((event: MediaQueryListEvent) => void) | null =
  null;

function getResolvedTheme(preference: ThemePreference): "dark" | "light" {
  if (preference !== "system") {
    return preference;
  }

  return window.matchMedia(SYSTEM_THEME_QUERY).matches ? "dark" : "light";
}

function applyResolvedTheme(theme: "dark" | "light") {
  document.body.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  const storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (
    storedPreference === "system" ||
    storedPreference === "dark" ||
    storedPreference === "light"
  ) {
    return storedPreference;
  }

  return "system";
}

export function setStoredThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
}

export function applyThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  if (activeSystemThemeQuery && activeSystemThemeListener) {
    activeSystemThemeQuery.removeEventListener(
      "change",
      activeSystemThemeListener,
    );
  }

  activeSystemThemeQuery = window.matchMedia(SYSTEM_THEME_QUERY);

  if (preference === "system") {
    const syncTheme = () => {
      applyResolvedTheme(getResolvedTheme(preference));
    };

    activeSystemThemeListener = syncTheme;
    activeSystemThemeQuery.addEventListener("change", syncTheme);
    syncTheme();
    return;
  }

  activeSystemThemeListener = null;
  applyResolvedTheme(preference);
}

export function applyStoredThemePreference() {
  const preference = getStoredThemePreference();
  applyThemePreference(preference);
  return preference;
}