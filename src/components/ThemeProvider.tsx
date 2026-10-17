"use client";

import * as React from "react";

type Theme = "light" | "dark";
type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
});

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const [theme, setThemeState] = React.useState<Theme>("light");

  React.useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    const initialTheme: Theme = storedTheme === "dark" ? "dark" : "light";
    setThemeState(initialTheme);
    applyTheme(initialTheme);

    const syncTheme = (event: StorageEvent) => {
      if (event.key !== "theme") return;
      const nextTheme: Theme = event.newValue === "dark" ? "dark" : "light";
      setThemeState(nextTheme);
      applyTheme(nextTheme);
    };

    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, []);

  const setTheme = React.useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return React.useContext(ThemeContext);
}
