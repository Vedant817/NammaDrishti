// src/App.jsx
import React from 'react';
import CityPulseDashboard from './components/Dashboard/CityPulseDashboard';
import { LanguageProvider } from './context/LanguageContext';
import './App.css';

function App() {
  return (
    <LanguageProvider>
      <div className="App">
        <CityPulseDashboard />
      </div>
    </LanguageProvider>
  );
}

export default App;
