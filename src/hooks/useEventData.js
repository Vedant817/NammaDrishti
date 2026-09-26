// src/hooks/useEventData.js
import { useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { initialBengaluruEvents } from "../data/sampleEvents";

const STORAGE_KEY = "nammapulse_events_v1";
const VOTES_STORAGE_KEY = "nammapulse_user_votes_v1";

const getApiBase = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    return `${window.location.origin}/api`;
  }
  return "http://localhost:5001/api";
};

const getSocketUrl = () => {
  if (process.env.REACT_APP_SOCKET_URL) return process.env.REACT_APP_SOCKET_URL;
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    return window.location.origin;
  }
  return "http://localhost:5001";
};

const API_BASE = getApiBase();
const SOCKET_URL = getSocketUrl();

// Safe storage persistence with quota fallback (strips base64 image if quota exceeded)
const safeSaveStorage = (eventsList) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(eventsList));
  } catch (err) {
    if (err.name === "QuotaExceededError" || err.code === 22) {
      try {
        const leanEvents = eventsList.map((evt, idx) => {
          if (idx < 2) return evt;
          const { mediaUrl, ...rest } = evt;
          return rest;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(leanEvents));
      } catch (retryErr) {
        const noMediaEvents = eventsList.map(({ mediaUrl, ...rest }) => rest);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(noMediaEvents));
        } catch {}
      }
    }
  }
};

const getUserVotes = () => {
  try {
    return JSON.parse(localStorage.getItem(VOTES_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

const recordUserVote = (id, type) => {
  try {
    const votes = getUserVotes();
    votes[`${type}_${id}`] = true;
    localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(votes));
  } catch (e) {}
};

const hasUserVoted = (id, type) => {
  const votes = getUserVotes();
  return Boolean(votes[`${type}_${id}`]);
};

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
        const res = await fetch(`${API_BASE}/incidents`, {
          signal: AbortSignal.timeout(2500),
        });
        if (res.ok) {
          const remoteEvents = await res.json();
          if (isMounted && Array.isArray(remoteEvents)) {
            setEvents((prev) => {
              // Reconcile and merge safely without overwriting live socket updates
              const merged = [...remoteEvents];
              for (const p of prev) {
                if (!merged.some((m) => m.id === p.id)) {
                  merged.unshift(p);
                }
              }
              safeSaveStorage(merged);
              return merged;
            });
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        // Backend offline or unreachable
      }

      // Local storage fallback (respect empty array if user cleared incidents)
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved !== null) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            if (isMounted) setEvents(parsed);
            return;
          }
        }
      } catch (e) {
        // Ignore parse error
      }

      // First run default seed
      if (isMounted) {
        setEvents(initialBengaluruEvents);
        safeSaveStorage(initialBengaluruEvents);
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
        reconnectionAttempts: 5,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        if (isMounted) setIsLiveConnected(true);
      });

      socket.on("disconnect", () => {
        if (isMounted) setIsLiveConnected(false);
      });

      // Synchronize latest server snapshot on initial connection & reconnect
      socket.on("initial:data", (remoteIncidents) => {
        if (!isMounted || !Array.isArray(remoteIncidents)) return;
        setEvents((prev) => {
          const merged = [...remoteIncidents];
          for (const localEvt of prev) {
            if (!merged.some((r) => r.id === localEvt.id)) {
              merged.push(localEvt);
            }
          }
          safeSaveStorage(merged);
          return merged;
        });
      });

      socket.on("incident:created", (newIncident) => {
        if (!isMounted) return;
        setEvents((prev) => {
          if (prev.some((e) => e.id === newIncident.id)) return prev;
          const next = [newIncident, ...prev];
          safeSaveStorage(next);
          return next;
        });
      });

      socket.on("incident:verified", ({ id, verificationCount, isVerified }) => {
        if (!isMounted) return;
        setEvents((prev) => {
          const next = prev.map((e) =>
            e.id === id ? { ...e, verificationCount, isVerified } : e
          );
          safeSaveStorage(next);
          return next;
        });
      });

      socket.on("incident:resolution_voted", ({ id, resolutionVotes }) => {
        if (!isMounted) return;
        setEvents((prev) => {
          const next = prev.map((e) =>
            e.id === id ? { ...e, resolutionVotes } : e
          );
          safeSaveStorage(next);
          return next;
        });
      });

      socket.on("incident:resolved", ({ id }) => {
        if (!isMounted) return;
        setEvents((prev) => {
          const next = prev.filter((e) => e.id !== id);
          safeSaveStorage(next);
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
    safeSaveStorage(updatedEvents);
  }, []);

  // Add new citizen report
  const addEvent = useCallback(async (newEvent) => {
    // Generate deterministic client ID to prevent dual-insertion across HTTP & WebSocket
    const clientGeneratedId = `namma_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const formatted = {
      id: clientGeneratedId,
      position: newEvent.position || { lat: 12.9716, lng: 77.5946 },
      type: newEvent.type || "Infrastructure",
      title: newEvent.title || "Citizen Reported Incident",
      urgency: newEvent.urgency || "Medium",
      description: newEvent.description || "Reported via NammaPulse Web App",
      ward: newEvent.ward || "Bengaluru Urban",
      timestamp: "Just now",
      verificationCount: 1,
      isVerified: false,
      resolutionVotes: 0,
      reportedBy: "You (Citizen)",
      mediaUrl: newEvent.mediaUrl || null,
      ...newEvent,
    };

    // Optimistically insert locally without duplication
    setEvents((prev) => {
      if (prev.some((e) => e.id === formatted.id)) return prev;
      const next = [formatted, ...prev];
      safeSaveStorage(next);
      return next;
    });

    // Post to server preserving the client ID
    try {
      const res = await fetch(`${API_BASE}/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formatted),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const created = await res.json();
        setEvents((prev) => {
          const index = prev.findIndex((e) => e.id === formatted.id);
          if (index !== -1) {
            const copy = [...prev];
            copy[index] = created;
            safeSaveStorage(copy);
            return copy;
          }
          if (prev.some((e) => e.id === created.id)) return prev;
          const next = [created, ...prev];
          safeSaveStorage(next);
          return next;
        });
        return created;
      }
    } catch (err) {
      // Backend unavailable; local optimistic report is preserved
    }

    return formatted;
  }, []);

  // Upvote / Verify an incident with single-vote per device protection
  const verifyEvent = useCallback(
    async (id) => {
      if (hasUserVoted(id, "verify")) {
        return { alreadyVoted: true };
      }

      recordUserVote(id, "verify");

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

      return { success: true };
    },
    [persistLocally]
  );

  // Consensus clearance (requires 2 confirmations to permanently clear an active hazard)
  const resolveEvent = useCallback(
    async (id) => {
      if (hasUserVoted(id, "clear")) {
        return { alreadyVoted: true };
      }

      recordUserVote(id, "clear");

      // Attempt remote resolution
      try {
        fetch(`${API_BASE}/incidents/${id}/resolve`, {
          method: "POST",
          signal: AbortSignal.timeout(2000),
        }).catch(() => {});
      } catch {}

      setEvents((prev) => {
        const target = prev.find((e) => e.id === id);
        if (!target) return prev;

        const currentVotes = (target.resolutionVotes || 0) + 1;

        if (currentVotes >= 2) {
          // Permanently clear
          const next = prev.filter((e) => e.id !== id);
          persistLocally(next);
          return next;
        } else {
          // Record resolution vote
          const next = prev.map((e) =>
            e.id === id ? { ...e, resolutionVotes: currentVotes } : e
          );
          persistLocally(next);
          return next;
        }
      });

      return { success: true };
    },
    [persistLocally]
  );

  return {
    events,
    loading,
    isLiveConnected,
    addEvent,
    verifyEvent,
    resolveEvent,
    hasUserVoted,
  };
};
