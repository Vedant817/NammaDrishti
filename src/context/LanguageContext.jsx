// src/context/LanguageContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { translations } from "../data/translations";

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem("nammadrishti_lang") || localStorage.getItem("nammapulse_lang") || "en";
  });

  useEffect(() => {
    localStorage.setItem("nammadrishti_lang", lang);
  }, [lang]);

  const t = translations[lang] || translations.en;

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
