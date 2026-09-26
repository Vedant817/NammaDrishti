// src/hooks/useProximityAlert.js
import { useEffect, useRef } from "react";
import { calculateDistance } from "../services/routingService";

/**
 * Plays a gentle, pleasant Web Audio notification chime when a hazard geofence is triggered.
 */
const playProximityChime = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    // AudioContext policy gracefully handled if user hasn't interacted yet
  }
};

/**
 * Monitors user proximity to high-urgency hazards and triggers notifications.
 * Geofence radius: 2.5 km.
 */
export const useProximityAlert = (userLocation, events = [], onAlertTriggered) => {
  const alertedIdsRef = useRef(new Set());

  useEffect(() => {
    if (!userLocation || !events || events.length === 0) return;
    if (!Number.isFinite(userLocation.lat) || !Number.isFinite(userLocation.lng)) return;

    // Filter for high-urgency waterlogging or accidents
    const criticalHazards = events.filter(
      (e) =>
        e.position &&
        Number.isFinite(e.position.lat) &&
        Number.isFinite(e.position.lng) &&
        (e.urgency === "High" || e.type === "Waterlogging" || e.type === "Accident")
    );

    criticalHazards.forEach((hazard) => {
      if (alertedIdsRef.current.has(hazard.id)) return;

      const distKm = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        hazard.position.lat,
        hazard.position.lng
      );

      // Within 2.5 km radius
      if (distKm <= 2.5) {
        alertedIdsRef.current.add(hazard.id);
        playProximityChime();

        const alertPayload = {
          title: `⚠️ Hazard Near You (${distKm.toFixed(1)} km)`,
          body: `${hazard.title} reported in ${hazard.ward}. Divert if traveling through this corridor.`,
          hazard,
          distanceKm: distKm,
        };

        // Trigger callback for in-app alert banner
        if (onAlertTriggered) {
          onAlertTriggered(alertPayload);
        }

        // Trigger native desktop / mobile notification if permitted
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(alertPayload.title, {
              body: alertPayload.body,
              icon: "/favicon.ico",
            });
          } catch (e) {
            // Notifications may be restricted in some contexts
          }
        } else if ("Notification" in window && Notification.permission !== "denied") {
          try {
            Notification.requestPermission();
          } catch (e) {}
        }
      }
    });
  }, [userLocation, events, onAlertTriggered]);
};
