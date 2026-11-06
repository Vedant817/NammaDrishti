import {API_BASE} from '../services/api';
import {authenticatedFetch as fetch,subscribePublicIncidents} from '../services/firebaseService';
import {useState,useEffect,useRef} from 'react';
import {io} from 'socket.io-client';
import {useOfflineActions} from './useOfflineActions';

// v2 could contain device-global drafts and optimistic vote counts. It is
// deliberately excluded from the new, authoritative-public-only cache.
const STORAGE_KEY='nammadrishti_public_events_v3';
const publicSnapshot=rows=>rows.filter(item=>item&&typeof item.id==='string'&&!item._isLocalPending);
const safeSaveStorage=rows=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(publicSnapshot(rows)));}catch{}};
const SOCKET_URL=process.env.REACT_APP_SOCKET_URL||((window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1')&&window.location.port==='3000'?'http://localhost:5001':window.location.origin);

export const useEventData=()=>{
  const [events,setEvents]=useState([]),[loading,setLoading]=useState(true),[isLiveConnected,setIsLiveConnected]=useState(false);
  const socketRef=useRef(null),streamVersion=useRef(0);
  // Realtime snapshots own public counts and lifecycle. An older POST reply
  // must not recreate an incident already resolved or expired by the stream.
  const actions=useOfflineActions();
  const {syncOfflineQueue}=actions;
  // Initialize from backend API or localStorage fallback
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      const started=streamVersion.current;
      try {
        const res = await fetch(`${API_BASE}/incidents`, {
          signal: AbortSignal.timeout(2500),
        });
        if (res.ok) {
          const remoteEvents = await res.json();
          if (isMounted && streamVersion.current===started && Array.isArray(remoteEvents)) {
            setEvents((prev) => {
              const synced = publicSnapshot(remoteEvents);
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

      if(!isMounted||streamVersion.current!==started)return;
      // Last confirmed public snapshot only.
      // Deliberate behavior when nothing is stored: the map starts with an
      // honest empty state — zero fabricated incidents are ever seeded locally.
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved !== null) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            if (isMounted) setEvents(publicSnapshot(parsed));
            return;
          }
        }
      } catch (e) {
        // Ignore parse error — stay empty and let the socket snapshot fill in
      }
    };

    if (process.env.REACT_APP_REALTIME_TRANSPORT !== 'firestore') {
      loadInitialData().finally(() => { if (isMounted) setLoading(false); });
    } else {
      // The public listener owns hosted snapshots. A slower initial REST read
      // must not overwrite a newer realtime update.
      try { const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); if (Array.isArray(cached)) setEvents(publicSnapshot(cached)); } catch {}
      setLoading(false);
    }

    // Hosted Vercel clients use the atomic sanitized Firestore projection.
    if (process.env.REACT_APP_REALTIME_TRANSPORT === 'firestore') {
      const stop=subscribePublicIncidents((remote,online)=>{
        if(!isMounted)return;
        setIsLiveConnected(online);
        setEvents(previous=>{const next=publicSnapshot(remote);safeSaveStorage(next);return next;});
        if(online)syncOfflineQueue();
      },()=>{if(isMounted)setIsLiveConnected(false);});
      return ()=>{isMounted=false;stop();};
    }
    // Establish WebSocket Connection with automatic reconnection
    try {
      const socket = io(SOCKET_URL, {
        path: process.env.REACT_APP_SOCKET_PATH || '/socket.io',
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        transports: ["websocket"],
      });
      socketRef.current = socket;
      const listen=(event,handler)=>socket.on(event,data=>{streamVersion.current++;handler(data);});

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
      listen("initial:data", (serverIncidents) => {
        if (isMounted && Array.isArray(serverIncidents)) {
          setEvents((prev) => {
            const synced = publicSnapshot(serverIncidents);
            safeSaveStorage(synced);
            return synced;
          });
        }
      });

      // Handle live incoming incidents (support both incident:created and incident:new)
      const handleNewIncident = (newIncident) => {
        if (!newIncident || !isMounted) return;
        setEvents((prev) => {
          if (prev.some((e) => e.id === newIncident.id)) return prev;
          const next = [newIncident, ...prev];
          safeSaveStorage(next);
          return next;
        });
      };
      listen("incident:created", handleNewIncident);
      listen("incident:new", handleNewIncident);

      // Handle spatial cluster merge updates
      listen("incident:clustered", (data) => {
        if (!data || !isMounted) return;
        setEvents((prev) => {
          const next = prev.map((e) =>
            e.id === (data.id || data.clusterId)
              ? {
                  ...e,
                  verificationCount: data.verificationCount,
                  verificationScore: data.verificationScore,
                  clusterCount: data.clusterCount,
                  urgency: data.urgency ?? e.urgency,
                  waterDepth: data.waterDepth ?? e.waterDepth,
                  vehiclePassability: data.vehiclePassability ?? e.vehiclePassability,
                  isVerified: data.isVerified,
                  updates: data.latestUpdate ? [data.latestUpdate, ...(e.updates || [])] : (data.updates || e.updates),
                }
              : e
          );
          safeSaveStorage(next);
          return next;
        });
      });

      // Handle proximity-weighted verification score updates
      listen("incident:verified", (data) => {
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
      listen("incident:clearance_vote", (data) => {
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
      listen("incident:resolution_voted", (data) => {
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
      listen("incident:resolved", ({ id }) => {
        if (!isMounted) return;
        setEvents((prev) => {
          const next = prev.filter((e) => e.id !== id);
          safeSaveStorage(next);
          return next;
        });
      });

      // Handle dynamic TTL decay expiration
      listen("incident:expired", ({ id }) => {
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

  return {events,loading,isLiveConnected,...actions};
};
