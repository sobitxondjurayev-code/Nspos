"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { applyTheme, chartColors, DEFAULTS } from "@/lib/themes";

const ThemeCtx = createContext({
  ...DEFAULTS, resolved: "light", setTheme: () => {}, toggle: () => {}, reset: () => {},
});
export const useTheme = () => useContext(ThemeCtx);

const STORAGE_KEY = "nspos-theme";
const systemDark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

export default function ThemeProvider({ children }) {
  // Server har doim standart bilan chizadi; saqlangani mount'dan keyin qo'llanadi
  const [cfg, setCfg] = useState(DEFAULTS);
  const [systemIsDark, setSystemIsDark] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved) setCfg({ ...DEFAULTS, ...saved });
    } catch { /* buzilgan qiymat bo'lsa standartda qolamiz */ }

    setSystemIsDark(systemDark());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemIsDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved = cfg.mode === "system" ? (systemIsDark ? "dark" : "light") : cfg.mode;

  useEffect(() => {
    applyTheme({ resolved, darkPreset: cfg.darkPreset, accent: cfg.accent });
  }, [resolved, cfg.darkPreset, cfg.accent]);

  const setTheme = (patch) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Sidebar'dagi tez almashtirish: tizim rejimida bo'lsa ham aniq tanlovga o'tadi
  const toggle = () => setTheme({ mode: resolved === "dark" ? "light" : "dark" });

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCfg(DEFAULTS);
  };

  return (
    <ThemeCtx.Provider value={{
      ...cfg, resolved, theme: resolved, setTheme, toggle, reset,
      chart: chartColors({ resolved, darkPreset: cfg.darkPreset, accent: cfg.accent }),
    }}>
      {children}
    </ThemeCtx.Provider>
  );
}
