// src/App.jsx
import React, { useEffect } from 'react';
import CityPulseDashboard from './components/Dashboard/CityPulseDashboard';
import { LanguageProvider } from './context/LanguageContext';
import './App.css';

function App() {
  useEffect(() => {
    document.body.classList.add('app-loaded');
    return () => document.body.classList.remove('app-loaded');
  }, []);

  return (
    <LanguageProvider>
      <div className="App">
        <CityPulseDashboard />
      </div>
    </LanguageProvider>
  );
}

export default App;
