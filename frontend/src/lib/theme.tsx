import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "portsync-theme";

function systemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function storedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

interface ThemeValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeValue>({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => storedTheme() ?? systemTheme());

  useEffect(() => {
    const root = document.documentElement;
    const apply = (next: Theme) => {
      root.classList.toggle("dark", next === "dark");
      root.style.colorScheme = next;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#07111F" : "#F4F8FB");
    };
    apply(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage can be blocked */
    }
  }, [theme]);

  useEffect(() => {
    if (storedTheme() !== null) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setThemeState(media.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(() => setThemeState((current) => (current === "dark" ? "light" : "dark")), []);
  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
