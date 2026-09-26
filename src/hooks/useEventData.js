// src/hooks/useEventData.js
import { useState, useEffect, useCallback } from "react";
import { initialBengaluruEvents } from "../data/sampleEvents";

const STORAGE_KEY = "nammapulse_events_v1";

export const useEventData = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState(null);

  // Initialize from localStorage or fallback to default sample events
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEvents(parsed);
          setLoading(false);
          return;
        }
      }
      // If nothing saved, load seed incidents
      setEvents(initialBengaluruEvents);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialBengaluruEvents));
    } catch {
      setEvents(initialBengaluruEvents);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save changes to localStorage
  const persistEvents = useCallback((updatedEvents) => {
    setEvents(updatedEvents);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedEvents));
    } catch (e) {
      console.warn("Failed to persist to localStorage", e);
    }
  }, []);

  // Add new citizen report
  const addEvent = useCallback((newEvent) => {
    const formatted = {
      id: `evt_user_${Date.now()}`,
      position: newEvent.position || { lat: 12.9716, lng: 77.5946 },
      type: newEvent.type || "Infrastructure",
      title: newEvent.title || "Citizen Reported Incident",
      urgency: newEvent.urgency || "Medium",
      description: newEvent.description || "Reported via NammaPulse Web App",
      ward: newEvent.ward || "Bengaluru Urban",
      timestamp: "Just now",
      verificationCount: 1,
      isVerified: false,
      reportedBy: "You (Citizen)",
      mediaUrl: newEvent.mediaUrl || null,
      ...newEvent,
    };

    setEvents((prev) => {
      const next = [formatted, ...prev];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to persist to localStorage", e);
      }
      return next;
    });

    return formatted;
  }, []);

  // Upvote / Verify an incident (+1 consensus)
  const verifyEvent = useCallback((id) => {
    setEvents((prev) => {
      const next = prev.map((evt) => {
        if (evt.id === id) {
          const nextCount = (evt.verificationCount || 0) + 1;
          return {
            ...evt,
            verificationCount: nextCount,
            isVerified: nextCount >= 3,
          };
        }
        return evt;
      });
      persistEvents(next);
      return next;
    });
  }, [persistEvents]);

  // Mark an incident as resolved or cleared
  const resolveEvent = useCallback((id) => {
    setEvents((prev) => {
      const next = prev.filter((evt) => evt.id !== id);
      persistEvents(next);
      return next;
    });
  }, [persistEvents]);

  // Reset to default Bengaluru dataset
  const resetToDefaults = useCallback(() => {
    setEvents(initialBengaluruEvents);
    persistEvents(initialBengaluruEvents);
  }, [persistEvents]);

  return {
    events,
    loading,
    error,
    addEvent,
    verifyEvent,
    resolveEvent,
    resetToDefaults,
  };
};
