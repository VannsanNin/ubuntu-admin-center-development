
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface ThemeContextType {
  isLight: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ isLight: true, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Light mode is the default; only switch when the stored preference is dark.
  const [isLight, setIsLight] = useState(() => localStorage.getItem("theme") !== "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("light", isLight);
  }, [isLight]);

  const toggle = () => {
    setIsLight((prev) => {
      const next = !prev;
      localStorage.setItem("theme", next ? "light" : "dark");
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ isLight, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
