// src/hooks/useEventData.js
import { useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { initialBengaluruEvents } from "../data/sampleEvents";
import { recordReputationEvent } from "../utils/reputationService";

const STORAGE_KEY = "nammadrishti_events_v1";
const LEGACY_STORAGE_KEY = "nammapulse_events_v1";
const VOTES_STORAGE_KEY = "nammadrishti_user_votes_v1";
const LEGACY_VOTES_KEY = "nammapulse_user_votes_v1";
const OFFLINE_QUEUE_KEY = "nammadrishti_offline_queue_v1";

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

const getOfflineQueue = () => {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveOfflineQueue = (queue) => {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn("[OfflineQueue] Failed to save queue:", e);
  }
};

const getUserVotes = () => {
  try {
    return JSON.parse(localStorage.getItem(VOTES_STORAGE_KEY) || localStorage.getItem(LEGACY_VOTES_KEY) || "{}");
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

const removeUserVote = (id, type) => {
  try {
    const votes = getUserVotes();
    delete votes[`${type}_${id}`];
    localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(votes));
  } catch (e) {}
};

const hasUserVoted = (id, type) => {
  const votes = getUserVotes();
  return Boolean(votes[`${type}_${id}`]);
};

const getOrCreateDeviceId = () => {
  try {
    let id = localStorage.getItem("nammadrishti_device_id_v1") || localStorage.getItem("nammapulse_device_id_v1");
    if (!id) {
      id = `dev_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
      localStorage.setItem("nammadrishti_device_id_v1", id);
    }
    return id;
  } catch {
    return `dev_anon_${Date.now()}`;
  }
};

export const useEventData = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(() => getOfflineQueue().length);
  const socketRef = useRef(null);

  // Sync queued offline submissions to server
  const syncOfflineQueue = useCallback(async () => {
    const queue = getOfflineQueue();
    if (!queue || queue.length === 0) {
      setOfflineQueueCount(0);
      return;
    }

    const remaining = [];
    for (const item of queue) {
      try {
        const res = await fetch(`${API_BASE}/incidents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...item,
            voterId: getOrCreateDeviceId(),
          }),
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const created = await res.json();
          // Update in-memory state
          setEvents((prev) => {
            const idx = prev.findIndex((e) => e.id === item.id);
            if (idx !== -1) {
              const copy = [...prev];
              copy[idx] = { ...created, _isLocalPending: false };
              safeSaveStorage(copy);
              return copy;
            }
            if (!prev.some((e) => e.id === created.id)) {
              const next = [created, ...prev];
              safeSaveStorage(next);
              return next;
            }
            return prev;
          });
        } else {
          remaining.push(item);
        }
      } catch (err) {
        remaining.push(item);
      }
    }

    saveOfflineQueue(remaining);
    setOfflineQueueCount(remaining.length);
  }, []);

  // Listen to network status changes to drain offline queue
  useEffect(() => {
    const handleOnline = () => {
      syncOfflineQueue();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncOfflineQueue]);

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
              // Reconcile: Remote server snapshot is authoritative; keep local un-synced offline drafts
              const pendingDrafts = prev.filter((p) => p._isLocalPending && !remoteEvents.some((r) => r.id === p.id));
              const synced = [...remoteEvents, ...pendingDrafts];
              safeSaveStorage(synced);
              return synced;
            });
            setLoading(false);
            // Also attempt to sync any offline queue items
            syncOfflineQueue();
            return;
          }
        }
      } catch (err) {
        // Backend offline or unreachable
      }

      // Local storage fallback (respect empty array if user cleared incidents)
      try {
        const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
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

    // Establish WebSocket Connection with automatic reconnection
    try {
      const socket = io(SOCKET_URL, {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        transports: ["websocket", "polling"],
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        if (isMounted) {
          setIsLiveConnected(true);
          syncOfflineQueue();
        }
      });

      socket.on("disconnect", () => {
        if (isMounted) setIsLiveConnected(false);
      });

      // Handle full initial snapshot emitted by server on connection
      socket.on("initial:data", (serverIncidents) => {
        if (isMounted && Array.isArray(serverIncidents)) {
          setEvents((prev) => {
            const pendingDrafts = prev.filter((p) => p._isLocalPending && !serverIncidents.some((r) => r.id === p.id));
            const synced = [...serverIncidents, ...pendingDrafts];
            safeSaveStorage(synced);
            return synced;
          });
        }
      });

      // Handle live incoming incidents
      socket.on("incident:new", (newIncident) => {
        if (!newIncident || !isMounted) return;
        setEvents((prev) => {
          if (prev.some((e) => e.id === newIncident.id)) return prev;
          const next = [newIncident, ...prev];
          safeSaveStorage(next);
          return next;
        });
      });

      // Handle spatial cluster merge updates
      socket.on("incident:clustered", (data) => {
        if (!data || !isMounted) return;
        setEvents((prev) => {
          const next = prev.map((e) =>
            e.id === data.clusterId
              ? {
                  ...e,
                  verificationCount: data.verificationCount,
                  verificationScore: data.verificationScore,
                  clusterCount: data.clusterCount,
                  isVerified: data.isVerified,
                  updates: data.updates || e.updates,
                }
              : e
          );
          safeSaveStorage(next);
          return next;
        });
      });

      // Handle proximity-weighted verification score updates
      socket.on("incident:verified", (data) => {
        if (!data || !isMounted) return;
        setEvents((prev) => {
          const next = prev.map((e) =>
            e.id === data.id
              ? {
                  ...e,
                  verificationCount: data.verificationCount,
                  verificationScore: data.verificationScore,
                  isVerified: data.isVerified,
                }
              : e
          );
          safeSaveStorage(next);
          return next;
        });
      });

      // Handle multi-citizen consensus clearance votes
      socket.on("incident:clearance_vote", (data) => {
        if (!data || !isMounted) return;
        setEvents((prev) => {
          const next = prev.map((e) =>
            e.id === data.id
              ? {
                  ...e,
                  resolutionVotes: data.clearanceVotes,
                  clearanceVotes: data.clearanceVotes,
                }
              : e
          );
          safeSaveStorage(next);
          return next;
        });
      });

      // Backward compatible listener for resolution_voted
      socket.on("incident:resolution_voted", (data) => {
        if (!data || !isMounted) return;
        setEvents((prev) => {
          const votes = data.clearanceVotes !== undefined ? data.clearanceVotes : data.resolutionVotes;
          const next = prev.map((e) =>
            e.id === data.id
              ? {
                  ...e,
                  resolutionVotes: votes,
                  clearanceVotes: votes,
                }
              : e
          );
          safeSaveStorage(next);
          return next;
        });
      });

      // Handle authoritative hazard resolution / removal
      socket.on("incident:resolved", ({ id }) => {
        if (!isMounted) return;
        setEvents((prev) => {
          const next = prev.filter((e) => e.id !== id);
          safeSaveStorage(next);
          return next;
        });
      });

      // Handle dynamic TTL decay expiration
      socket.on("incident:expired", ({ id }) => {
        if (!isMounted) return;
        setEvents((prev) => {
          const next = prev.filter((e) => e.id !== id);
          safeSaveStorage(next);
          return next;
        });
      });
    } catch (e) {
      console.warn("WebSocket initialization fallback:", e);
    }

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [syncOfflineQueue]);

  // Synchronize state changes to localStorage
  const persistLocally = useCallback((updatedEvents) => {
    safeSaveStorage(updatedEvents);
  }, []);

  // Report a new civic incident with offline queue resilience
  const addEvent = useCallback(async (newEvent) => {
    const deterministicId = `namma_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const formatted = {
      id: deterministicId,
      type: newEvent.type || "Traffic",
      title: newEvent.title || "Citizen Reported Incident",
      urgency: newEvent.urgency || "Medium",
      description: newEvent.description || "Reported via NammaDrishti Web App",
      ward: newEvent.ward || "Bengaluru Urban",
      timestamp: "Just now",
      verificationCount: 1,
      clusterCount: 1,
      isVerified: false,
      resolutionVotes: 0,
      reportedBy: "You (Citizen)",
      mediaUrl: newEvent.mediaUrl || null,
      _isLocalPending: true,
      ...newEvent,
    };

    // Optimistically insert locally without duplication
    setEvents((prev) => {
      if (prev.some((e) => e.id === formatted.id)) return prev;
      const next = [formatted, ...prev];
      safeSaveStorage(next);
      return next;
    });

    // Record citizen reputation gain
    recordReputationEvent('REPORT_SUBMITTED');

    // Post to server preserving the client ID
    try {
      const res = await fetch(`${API_BASE}/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formatted,
          voterId: getOrCreateDeviceId(),
        }),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const created = await res.json();
        setEvents((prev) => {
          const index = prev.findIndex((e) => e.id === formatted.id);
          if (index !== -1) {
            const copy = [...prev];
            copy[index] = { ...created, _isLocalPending: false };
            safeSaveStorage(copy);
            return copy;
          }
          if (prev.some((e) => e.id === created.id)) return prev;
          const next = [created, ...prev];
          safeSaveStorage(next);
          return next;
        });
        return created;
      } else {
        // Enqueue for background sync
        const queue = getOfflineQueue();
        queue.push(formatted);
        saveOfflineQueue(queue);
        setOfflineQueueCount(queue.length);
      }
    } catch (err) {
      // Backend unavailable; enqueue for background sync
      const queue = getOfflineQueue();
      queue.push(formatted);
      saveOfflineQueue(queue);
      setOfflineQueueCount(queue.length);
    }

    return formatted;
  }, []);

  // Upvote / Verify an incident with proximity weighting & single-vote per device protection
  const verifyEvent = useCallback(
    async (id, voterPosition) => {
      if (hasUserVoted(id, "verify")) {
        return { alreadyVoted: true };
      }

      recordUserVote(id, "verify");
      recordReputationEvent('HAZARD_VERIFIED');

      // Optimistic increment
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

      // Synchronize with server
      try {
        const res = await fetch(`${API_BASE}/incidents/${id}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            voterPosition,
            voterId: getOrCreateDeviceId(),
          }),
          signal: AbortSignal.timeout(3000),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          // Rollback local vote status
          removeUserVote(id, "verify");
          setEvents((prev) => {
            const next = prev.map((evt) => {
              if (evt.id === id) {
                const prevCount = Math.max(1, (evt.verificationCount || 1) - 1);
                return {
                  ...evt,
                  verificationCount: prevCount,
                  isVerified: prevCount >= 3,
                };
              }
              return evt;
            });
            persistLocally(next);
            return next;
          });
          return { error: errData.error || "Verification failed on server." };
        }

        const data = await res.json();
        setEvents((prev) => {
          const next = prev.map((evt) =>
            evt.id === id
              ? {
                  ...evt,
                  verificationCount: data.verificationCount,
                  verificationScore: data.verificationScore,
                  isVerified: data.isVerified,
                }
              : evt
          );
          persistLocally(next);
          return next;
        });
        return { success: true };
      } catch (err) {
        return { success: true, offlineOptimistic: true };
      }
    },
    [persistLocally]
  );

  // Multi-citizen consensus clearance with single-vote per device guard
  const resolveEvent = useCallback(
    async (id) => {
      if (hasUserVoted(id, "clear")) {
        return { alreadyVoted: true };
      }

      recordUserVote(id, "clear");
      recordReputationEvent('HAZARD_CLEARED');

      try {
        const res = await fetch(`${API_BASE}/incidents/${id}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voterId: getOrCreateDeviceId() }),
          signal: AbortSignal.timeout(3000),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          removeUserVote(id, "clear");
          return { error: errData.error || "Clearance rejected by server." };
        }

        const data = await res.json();
        if (data.cleared) {
          setEvents((prev) => {
            const next = prev.filter((e) => e.id !== id);
            persistLocally(next);
            return next;
          });
        } else {
          setEvents((prev) => {
            const next = prev.map((e) =>
              e.id === id
                ? {
                    ...e,
                    resolutionVotes: data.clearanceVotes,
                    clearanceVotes: data.clearanceVotes,
                  }
                : e
            );
            persistLocally(next);
            return next;
          });
        }
        return { success: true };
      } catch (err) {
        // Server offline; apply optimistic clearance
        setEvents((prev) => {
          const target = prev.find((e) => e.id === id);
          if (!target) return prev;

          const currentVotes = (target.resolutionVotes || 0) + 1;
          if (currentVotes >= 2) {
            const next = prev.filter((e) => e.id !== id);
            persistLocally(next);
            return next;
          } else {
            const next = prev.map((e) =>
              e.id === id
                ? { ...e, resolutionVotes: currentVotes, clearanceVotes: currentVotes }
                : e
            );
            persistLocally(next);
            return next;
          }
        });
        return { success: true };
      }
    },
    [persistLocally]
  );

  return {
    events,
    loading,
    isLiveConnected,
    offlineQueueCount,
    syncOfflineQueue,
    addEvent,
    verifyEvent,
    resolveEvent,
    hasUserVoted,
  };
};
