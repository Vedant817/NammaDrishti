import { useState, useEffect } from 'react';

// Free Open-Meteo API endpoint for Bengaluru coordinates
const BENGALURU_COORDS = { lat: 12.9716, lng: 77.5946 };

export const useWeather = () => {
  const [weather, setWeather] = useState({
    temp: 24,
    humidity: 72,
    precipitation: 0,
    windSpeed: 12,
    weatherCode: 1,
    description: 'Partly Cloudy',
    floodRisk: 'Low',
    lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    loading: true,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchWeatherData = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${BENGALURU_COORDS.lat}&longitude=${BENGALURU_COORDS.lng}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=Asia%2FKolkata`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Weather fetch failed');
        const data = await res.json();
        
        if (data.current && isMounted) {
          const current = data.current;
          const precip = current.precipitation || 0;
          
          let desc = 'Clear Sky';
          const code = current.weather_code;
          if (code >= 1 && code <= 3) desc = 'Partly Cloudy';
          else if (code >= 45 && code <= 48) desc = 'Foggy / Hazy';
          else if (code >= 51 && code <= 67) desc = 'Light / Moderate Rain';
          else if (code >= 71 && code <= 77) desc = 'Showers';
          else if (code >= 80 && code <= 82) desc = 'Heavy Downpour';
          else if (code >= 95) desc = 'Thunderstorm';

          // Flood risk heuristic based on precipitation rate
          let floodRisk = 'Low';
          if (precip > 15) floodRisk = 'Critical';
          else if (precip > 5) floodRisk = 'Moderate';

          setWeather({
            temp: Math.round(current.temperature_2m),
            humidity: Math.round(current.relative_humidity_2m),
            precipitation: precip,
            windSpeed: Math.round(current.wind_speed_10m),
            weatherCode: code,
            description: desc,
            floodRisk,
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            loading: false,
          });
        }
      } catch (err) {
        if (isMounted) {
          // Graceful fallback to default Bengaluru standard values
          setWeather((prev) => ({
            ...prev,
            loading: false,
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }));
        }
      }
    };

    fetchWeatherData();
    // Poll every 10 minutes
    const interval = setInterval(fetchWeatherData, 10 * 60 * 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return weather;
};
