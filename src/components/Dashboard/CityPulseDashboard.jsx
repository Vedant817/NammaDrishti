// src/components/Dashboard/CityPulseDashboard.jsx
import React, { useState, useEffect } from "react";
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

  // Auto-detect commuter GPS on mount to power proximity verification
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          console.warn("[Dashboard] GPS detection deferred:", err.message);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Real-time audio-visual proximity alert listener for severe nearby hazards
  useProximityAlert(userLocation, events, (alert) => {
    if (alert && alert.hazard) {
      showToast(`⚠️ Hazard Alert: ${alert.hazard.title} is ${alert.distanceKm ? alert.distanceKm.toFixed(1) : ''} km away!`);
    } else {
      showToast("⚠️ Proximity Alert: High urgency hazard detected near your location!");
    }
  });

  const handleMapPinSelected = (coords) => {
    setReportPin(coords);
    setShowReportModal(true);
  };

  const handleOpenReportModal = () => {
    setShowReportModal(true);
  };

  const handleSubmitReport = async (newReport) => {
    const created = await addEvent(newReport);
    setSelectedEvent(created);
    setReportPin(null);
    showToast("✓ Hazard incident broadcast to NammaDrishti live stream!");
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
    setNavigationRoute(routeData.coordinates || null);
    if (routeData.hasConflicts) {
      showToast("⚠️ Caution: Navigation corridor intersects active civic hazards. Rerouted.");
    } else {
      showToast("✓ Safe Hazard-Free Navigation Corridor active.");
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
      : 0;

  return (
    <div className="dashboard-container">
      {/* Platform Header with Live Sync Status & Monsoon Offline Indicator */}
      <Header
        activeEventCount={events.length}
        verifiedPercent={verifiedPercent}
        weather={weather}
        isLiveConnected={isLiveConnected}
        offlineQueueCount={offlineQueueCount}
      />

      {/* Global Interactive Filter Panel */}
      <FilterPanel
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        counts={{
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
            onEventSelect={setSelectedEvent}
            onMapClick={handleMapPinSelected}
            onOpenReportModal={handleOpenReportModal}
            navigationRoute={navigationRoute}
            userLocation={userLocation}
          />

          <div className="map-floating-actions floating-action-buttons">
            <button
              type="button"
              className="action-fab report-fab report-trigger-btn"
              onClick={handleOpenReportModal}
              title="Report Civic Hazard"
            >
              <span>🚨</span>
              <span>{t.actions?.reportHazard || "Report Hazard"}</span>
            </button>
            <button
              type="button"
              className="action-fab route-fab safe-route-trigger-btn"
              onClick={() => setShowRouteModal(true)}
              title="Calculate Safe Hazard-Avoidance Corridor"
            >
              <span>🧭</span>
              <span>{t.actions?.safeRoute || "Safe Route"}</span>
            </button>
            <button
              type="button"
              className="action-fab chatbot-fab chatbot-trigger-btn"
              onClick={() => setShowChatbotModal(true)}
              title="Open NammaDrishti AI Assistant"
            >
              <span>🤖</span>
              <span>{t.actions?.aiAssistant || "NammaDrishti AI"}</span>
            </button>
          </div>
        </main>

        <Sidebar
          events={filteredEvents}
          allEvents={events}
          selectedEvent={selectedEvent}
          onEventSelect={setSelectedEvent}
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
