"use client";

import { createContext, useContext, useCallback, useSyncExternalStore } from "react";

export type Lang = "en" | "de";

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const STORAGE_KEY = "socialboost-lang";

import { translations } from "./translations";

let langListeners: Array<() => void> = [];

function langSubscribe(callback: () => void) {
  langListeners.push(callback);
  return () => {
    langListeners = langListeners.filter((l) => l !== callback);
  };
}

function getLangSnapshot(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "de") return stored;
  } catch {
    // localStorage unavailable
  }
  return "en";
}

export function getLangServerSnapshot(): Lang {
  return "en";
}

function setLangInStore(newLang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, newLang);
  } catch {
    // localStorage unavailable
  }
  for (const listener of langListeners) {
    listener();
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(langSubscribe, getLangSnapshot, getLangServerSnapshot);

  const setLang = useCallback((newLang: Lang) => {
    setLangInStore(newLang);
  }, []);

  const t = useCallback(
    (key: string): string => {
      const dict = translations[lang];
      return (dict as Record<string, string>)[key] ?? key;
    },
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
