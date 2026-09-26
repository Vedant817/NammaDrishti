// src/hooks/useEventData.js
import { useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { initialBengaluruEvents } from "../data/sampleEvents";

const STORAGE_KEY = "nammapulse_events_v1";
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";

export const useEventData = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const socketRef = useRef(null);

  // Initialize from backend API or localStorage fallback
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        const res = await fetch(`${API_BASE}/incidents`, { signal: AbortSignal.timeout(2500) });
        if (res.ok) {
          const remoteEvents = await res.json();
          if (isMounted && Array.isArray(remoteEvents) && remoteEvents.length > 0) {
            setEvents(remoteEvents);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteEvents));
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        // Backend not reachable - fallback to local storage
      }

      // Local storage fallback
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (isMounted) setEvents(parsed);
            return;
          }
        }
      } catch (e) {
        // Ignore parse error
      }

      if (isMounted) {
        setEvents(initialBengaluruEvents);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialBengaluruEvents));
      }
    };

    loadInitialData().finally(() => {
      if (isMounted) setLoading(false);
    });

    // Establish WebSocket Connection
    try {
      const socket = io(SOCKET_URL, {
        transports: ["websocket", "polling"],
        timeout: 3000,
        reconnectionAttempts: 3,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        if (isMounted) setIsLiveConnected(true);
      });

      socket.on("disconnect", () => {
        if (isMounted) setIsLiveConnected(false);
      });

      socket.on("incident:created", (newIncident) => {
        if (!isMounted) return;
        setEvents((prev) => {
          if (prev.some((e) => e.id === newIncident.id)) return prev;
          const next = [newIncident, ...prev];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      });

      socket.on("incident:verified", ({ id, verificationCount, isVerified }) => {
        if (!isMounted) return;
        setEvents((prev) => {
          const next = prev.map((e) =>
            e.id === id ? { ...e, verificationCount, isVerified } : e
          );
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      });

      socket.on("incident:resolved", ({ id }) => {
        if (!isMounted) return;
        setEvents((prev) => {
          const next = prev.filter((e) => e.id !== id);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      });
    } catch (err) {
      console.warn("WebSocket init deferred:", err.message);
    }

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Save changes locally
  const persistLocally = useCallback((updatedEvents) => {
    setEvents(updatedEvents);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedEvents));
    } catch (e) {
      console.warn("Failed to persist locally", e);
    }
  }, []);

  // Add new citizen report
  const addEvent = useCallback(async (newEvent) => {
    const fallbackId = `evt_user_${Date.now()}`;
    const formatted = {
      id: fallbackId,
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

    // Attempt remote post
    try {
      const res = await fetch(`${API_BASE}/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formatted),
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const created = await res.json();
        setEvents((prev) => [created, ...prev]);
        return created;
      }
    } catch (err) {
      // Fallback to local optimistic update
    }

    setEvents((prev) => {
      const next = [formatted, ...prev];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    return formatted;
  }, []);

  // Upvote / Verify an incident (+1 consensus)
  const verifyEvent = useCallback(async (id) => {
    // Attempt remote verification
    try {
      fetch(`${API_BASE}/incidents/${id}/verify`, {
        method: "POST",
        signal: AbortSignal.timeout(2000),
      }).catch(() => {});
    } catch {}

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
      persistLocally(next);
      return next;
    });
  }, [persistLocally]);

  // Mark an incident as resolved or cleared
  const resolveEvent = useCallback(async (id) => {
    try {
      fetch(`${API_BASE}/incidents/${id}/resolve`, {
        method: "POST",
        signal: AbortSignal.timeout(2000),
      }).catch(() => {});
    } catch {}

    setEvents((prev) => {
      const next = prev.filter((evt) => evt.id !== id);
      persistLocally(next);
      return next;
    });
  }, [persistLocally]);

  return {
    events,
    loading,
    isLiveConnected,
    addEvent,
    verifyEvent,
    resolveEvent,
  };
};
