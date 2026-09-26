// src/hooks/useProximityAlert.js
import { useEffect, useRef } from "react";
import { calculateDistance } from "../services/routingService";

/**
 * Monitors user proximity to high-urgency hazards and triggers notifications.
 * Geofence radius: 2.5 km.
 */
export const useProximityAlert = (userLocation, events = [], onAlertTriggered) => {
  const alertedIdsRef = useRef(new Set());

  useEffect(() => {
    if (!userLocation || !events || events.length === 0) return;

    // Filter for high-urgency waterlogging or accidents
    const criticalHazards = events.filter(
      (e) =>
        e.position &&
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
          Notification.requestPermission();
        }
      }
    });
  }, [userLocation, events, onAlertTriggered]);
};
