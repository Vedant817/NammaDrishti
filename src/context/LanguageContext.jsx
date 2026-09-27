// src/context/LanguageContext.jsx
import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { translations } from "../data/translations";

const LanguageContext = createContext();

// Recursive deep merge: ensures every key from English base is available even if missing in regional translations
function mergeTranslations(base, target) {
  if (!target || typeof target !== 'object') return base;
  const merged = { ...base };
  for (const key of Object.keys(target)) {
    if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      merged[key] = mergeTranslations(base[key] || {}, target[key]);
    } else if (target[key] !== undefined) {
      merged[key] = target[key];
    }
  }
  return merged;
}

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem("nammadrishti_lang") || localStorage.getItem("nammapulse_lang") || "en";
      }
    } catch (e) {
      // Storage blocked or inaccessible
    }
    return "en";
  });

  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem("nammadrishti_lang", lang);
      }
    } catch (e) {
      // Ignore storage write issues
    }
  }, [lang]);

  const t = useMemo(() => {
    const regional = translations[lang] || translations.en;
    if (lang === 'en') return regional;
    return mergeTranslations(translations.en, regional);
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      lang: "en",
      setLang: () => {},
      t: translations.en,
    };
  }
  return context;
};
