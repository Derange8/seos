"use client";

import { useSyncExternalStore } from "react";

export type Language = "en" | "tr";

const STORAGE_KEY = "seos-language";
const listeners = new Set<() => void>();

// localStorage-backed rather than a React Context: the handful of pages
// that read this (Guide, the project dashboard) aren't nested under a
// shared layout that's worth wiring a provider into, and a toggle flipped
// on one page should still stick when navigating to another.
//
// useSyncExternalStore, not useState+useEffect: localStorage is state that
// lives outside React, so this is exactly the "subscribe to an external
// store" case the hook exists for — and it avoids the synchronous
// setState-in-an-effect pattern that triggers cascading renders.
function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): Language {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "en" || stored === "tr" ? stored : "en";
}

function getServerSnapshot(): Language {
  return "en";
}

export function useLanguage(): [Language, (language: Language) => void] {
  const language = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function setLanguage(next: Language) {
    localStorage.setItem(STORAGE_KEY, next);
    listeners.forEach((listener) => listener());
  }

  return [language, setLanguage];
}
