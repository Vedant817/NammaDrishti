import { Plus, Route, MessageSquare } from "lucide-react";
// src/components/Dashboard/CityPulseDashboard.jsx
import React, { useState, useEffect, useRef } from "react";
import Header from "../Header/Header";
import FilterPanel from "../Filters/FilterPanel";
import MapContainer from "../Map/MapContainer";
import Sidebar from "../Sidebar/Sidebar";
import ReportModal from "../Modals/ReportModal";
import ChatbotModal from "../Chatbot/ChatbotModal";
import SafeRouteModal from "../Navigation/SafeRouteModal";
import { useEventData } from "../../hooks/useEventData";
import { useWeatherTelemetry } from "../../hooks/useWeatherTelemetry";
import { useLanguage } from "../../context/LanguageContext";
import { useProximityAlert } from "../../hooks/useProximityAlert";
import "./CityPulseDashboard.css";

// GEV-pattern shareable state: ?incident=<id> re-opens the shared hazard, and
// ?view=lat,lng,z restores the map camera. Parsed once at module load.
const parseDeepLinkParams = () => {
  if (typeof window === "undefined") return { incidentId: null, view: null };
  const params = new URLSearchParams(window.location.search);
  const incidentId = params.get("incident");
  let view = null;
  const rawView = params.get("view");
  if (rawView) {
    const parts = rawView.split(",").map((v) => Number(v.trim()));
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      const zoomNum = Number.isFinite(parts[2]) ? Math.max(4, Math.min(18, Math.round(parts[2]))) : 14;
      view = { lat: Math.max(-90, Math.min(90, parts[0])), lng: Math.max(-180, Math.min(180, parts[1])), zoom: zoomNum };
    }
  }
  return { incidentId: incidentId ? incidentId.trim() : null, view };
};

const DEEP_LINK = parseDeepLinkParams();

const CityPulseDashboard = () => {
  const { events, isLiveConnected, offlineQueueCount, addEvent, verifyEvent, resolveEvent } = useEventData();
  const { weather } = useWeatherTelemetry();
  const { t } = useLanguage();

  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showChatbotModal, setShowChatbotModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [sidebarTab, setSidebarTab] = useState("feed");
  const [reportPin, setReportPin] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [navigationRoute, setNavigationRoute] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  // Deep-link camera: one-shot fly for ?view=... (only until the user interacts)
  const [initialCamera, setInitialCamera] = useState(
    DEEP_LINK.incidentId || !DEEP_LINK.view
      ? null
      : { center: [DEEP_LINK.view.lat, DEEP_LINK.view.lng], zoom: DEEP_LINK.view.zoom }
  );

  // Auto-detect commuter GPS on mount to power proximity verification
  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          console.warn("[Dashboard] GPS detection deferred:", err.message);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const incidentLinkUsedRef = useRef(false);

  // Restore a ?incident=<id> deep link once the live event stream has loaded
  useEffect(() => {
    if (incidentLinkUsedRef.current || !DEEP_LINK.incidentId || events.length === 0) return undefined;
    const match = events.find((e) => String(e.id) === String(DEEP_LINK.incidentId));
    incidentLinkUsedRef.current = true; // one-shot: stop watching after the first load pass
    if (match) {
      setSelectedEvent(match);
      setInitialCamera(null);
      showToast(`🔗 Opened shared incident: ${match.title}`);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Real-time audio-visual proximity alert listener for severe nearby hazards
  useProximityAlert(userLocation, events, (alert) => {
    if (alert && alert.hazard) {
      showToast(`⚠️ Hazard Alert: ${alert.hazard.title} is ${alert.distanceKm ? alert.distanceKm.toFixed(1) : ''} km away!`);
    } else {
      showToast("⚠️ Proximity Alert: High urgency hazard detected near your location!");
    }
  });

  const handleEventSelect = (event) => {
    // User interaction voids any deep-linked camera restore
    setInitialCamera(null);
    setSelectedEvent(event);
  };

  const handleMapPinSelected = (coords) => {
    setReportPin(coords);
    setShowReportModal(true);
  };

  const handleOpenReportModal = () => {
    setShowReportModal(true);
  };

  const handleSubmitReport = async (newReport) => {
    const created = await addEvent(newReport);
    if (created && created.error) {
      return { error: created.error };
    }
    setSelectedEvent(created);
    setReportPin(null);
    showToast("Report added to the map.");
    return { success: true };
  };

  const handleVerifyEvent = async (id) => {
    const res = await verifyEvent(id, userLocation);
    if (res?.alreadyVoted) {
      showToast("⚠️ You have already verified this incident.");
    } else if (res?.success) {
      showToast("✓ Confirmation recorded (+1 consensus)!");
    } else if (res?.error) {
      showToast(`⚠️ ${res.error}`);
    }
  };

  const handleResolveEvent = async (id) => {
    const res = await resolveEvent(id);
    if (res?.alreadyVoted) {
      showToast("⚠️ You have already voted to clear this hazard.");
    } else if (res?.success) {
      showToast("✓ Resolution vote cast! (2 citizen consensus required to clear)");
    } else if (res?.error) {
      showToast(`⚠️ ${res.error}`);
    }
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    if (selectedEvent && filter !== "All" && selectedEvent.type !== filter) {
      setSelectedEvent(null);
    }
  };

  const handleApplyRoute = (routeData) => {
    if (!routeData) {
      setNavigationRoute(null);
      return;
    }
    setNavigationRoute(routeData);
    if (routeData.hasConflicts) {
      showToast("⚠️ Caution: Navigation corridor intersects active civic hazards. Rerouted.");
    } else {
      showToast("Route added. No reported hazards nearby.");
    }
  };

  const filteredEvents = events.filter((event) => {
    if (activeFilter === "All") return true;
    return event.type === activeFilter;
  });

  const verifiedPercent =
    events.length > 0
      ? Math.round(
          (events.filter((e) => e.isVerified || (e.verificationCount && e.verificationCount >= 3)).length /
            events.length) *
            100
        )
      : 100;

  return (
    <div className="citypulse-app">
      <Header
        activeEventCount={events.length}
        activeAlertsCount={events.length}
        verifiedPercent={verifiedPercent}
        verifiedPercentage={verifiedPercent}
        weather={weather}
        isLiveConnected={isLiveConnected}
        offlineQueueCount={offlineQueueCount}
      />

      <FilterPanel
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        events={events}
        incidentCounts={{
          All: events.length,
          Traffic: events.filter((e) => e.type === "Traffic").length,
          Waterlogging: events.filter((e) => e.type === "Waterlogging").length,
          Accident: events.filter((e) => e.type === "Accident").length,
          Infrastructure: events.filter((e) => e.type === "Infrastructure").length,
        }}
      />

      {/* Main split viewport: Map (interactive) + Sidebar (Feed/Helplines/Diagnostic) */}
      <div className="main-content">
        <main className="map-section" role="region" aria-label="Interactive Map">
          <MapContainer
            events={filteredEvents}
            selectedEvent={selectedEvent}
            onEventSelect={handleEventSelect}
            onVerifyEvent={handleVerifyEvent}
            onResolveEvent={handleResolveEvent}
            onMapClick={handleMapPinSelected}
            onOpenReportModal={handleOpenReportModal}
            navigationRoute={navigationRoute}
            onClearNavigationRoute={() => setNavigationRoute(null)}
            userLocation={userLocation}
            initialCamera={initialCamera}
          />

          <div className="map-floating-actions floating-action-buttons">
            <button
              type="button"
              className="action-fab report-fab report-trigger-btn"
              onClick={handleOpenReportModal}
              title="Report Civic Hazard"
            >
              <Plus size={17} aria-hidden="true" />
              <span>{t.actions?.reportHazard || "Report Hazard"}</span>
            </button>
            <button
              type="button"
              className="action-fab route-fab safe-route-trigger-btn"
              onClick={() => setShowRouteModal(true)}
              title="Plan a route around reported hazards"
            >
              <Route size={17} aria-hidden="true" />
              <span>{t.actions?.safeRoute || "Safe Route"}</span>
            </button>
            <button
              type="button"
              className="action-fab chatbot-fab chatbot-trigger-btn"
              onClick={() => setShowChatbotModal(true)}
              title="Open NammaDrishti AI Assistant"
            >
              <MessageSquare size={17} aria-hidden="true" />
              <span>{t.actions?.aiAssistant || "NammaDrishti AI"}</span>
            </button>
          </div>
        </main>

        <Sidebar
          events={filteredEvents}
          allEvents={events}
          selectedEvent={selectedEvent}
          onEventSelect={handleEventSelect}
          onVerifyEvent={handleVerifyEvent}
          onResolveEvent={handleResolveEvent}
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
          activeFilter={activeFilter}
          rainIntensity={weather?.precipitation || 0}
          isWeatherOffline={weather?.isOffline || false}
          userLocation={userLocation}
        />
      </div>

      {/* Citizen Report Modal */}
      {showReportModal && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            setReportPin(null);
          }}
          onSubmitReport={handleSubmitReport}
          initialCoordinates={reportPin}
        />
      )}

      {/* NammaDrishti Context-Aware AI Chatbot */}
      {showChatbotModal && (
        <ChatbotModal
          isOpen={showChatbotModal}
          onClose={() => setShowChatbotModal(false)}
          events={events}
          currentEvents={events}
          weather={weather}
        />
      )}

      {/* Safe Route Hazard Avoidance Modal */}
      {showRouteModal && (
        <SafeRouteModal
          isOpen={showRouteModal}
          onClose={() => setShowRouteModal(false)}
          hazards={events}
          activeHazards={events}
          userLocation={userLocation}
          onApplyRouteToMap={handleApplyRoute}
        />
      )}

      {/* Transient Notification Toast */}
      {toastMessage && (
        <div className="dashboard-toast-notification" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default CityPulseDashboard;
