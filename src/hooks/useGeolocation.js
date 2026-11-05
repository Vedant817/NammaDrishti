// src/hooks/useGeolocation.js
import { useState, useCallback } from "react";

export const useGeolocation = () => {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
        });
        setLoading(false);
      },
      (err) => {
        setError(err.message || "Failed to retrieve location.");
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, []);

  const getPosition = useCallback((onSuccess, onError) => {
    if (!navigator.geolocation) {
      const err = new Error("Geolocation is not supported by this browser.");
      setError(err.message);
      if (typeof onError === "function") onError(err);
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
        };
        setLocation(coords);
        setLoading(false);
        if (typeof onSuccess === "function") onSuccess(coords);
      },
      (err) => {
        const errObj = new Error(err.message || "Failed to retrieve GPS location.");
        setError(errObj.message);
        setLoading(false);
        if (typeof onError === "function") onError(errObj);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, []);

  return { location, loading, error, getCurrentLocation, getPosition };
};
