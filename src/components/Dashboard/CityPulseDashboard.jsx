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
import "./CityPulseDashboard.css";

const CityPulseDashboard = () => {
  const { events, isLiveConnected, addEvent, verifyEvent, resolveEvent } = useEventData();
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
    showToast("✓ Hazard incident broadcast to NammaPulse live stream!");
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
      showToast("⚠️ You have already voted to clear this incident.");
    } else if (res?.success) {
      showToast("✓ Clearance vote recorded (2 confirmations needed to permanently clear).");
    } else if (res?.error) {
      showToast(`⚠️ ${res.error}`);
    }
  };

  const handleApplyRouteToMap = (route) => {
    setNavigationRoute(route);
    if (route) {
      showToast("🧭 Safe navigation corridor calculated and projected onto map!");
    } else {
      showToast("Route cleared from map.");
    }
  };

  const verifiedPercent = Math.round(
    (events.filter((e) => e.isVerified).length / (events.length || 1)) * 100
  );

  const filteredEvents = activeFilter === "All"
    ? events
    : events.filter((e) => e.type === activeFilter);

  return (
    <div className="dashboard-container">
      {/* Header with live weather & consensus metrics */}
      <Header
        activeEventCount={events.length}
        verifiedPercent={verifiedPercent}
        weather={weather}
        isLiveConnected={isLiveConnected}
      />

      {/* Real-time Category Filter Panel */}
      <FilterPanel
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        events={events}
        eventCounts={events.reduce((acc, evt) => {
          acc[evt.type] = (acc[evt.type] || 0) + 1;
          return acc;
        }, {})}
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

          <div className="floating-action-buttons">
            <button
              type="button"
              className="report-trigger-btn"
              onClick={handleOpenReportModal}
              title="Report Civic Hazard"
            >
              <span>🚨</span>
              <span>{t.actions?.reportHazard || "Report Hazard"}</span>
            </button>
            <button
              type="button"
              className="safe-route-trigger-btn"
              onClick={() => setShowRouteModal(true)}
              title="Calculate Safe Hazard-Avoidance Corridor"
            >
              <span>🧭</span>
              <span>{t.actions?.safeRoute || "Safe Route"}</span>
            </button>
            <button
              type="button"
              className="chatbot-trigger-btn"
              onClick={() => setShowChatbotModal(true)}
              title="Open NammaPulse AI Assistant"
            >
              <span>🤖</span>
              <span>{t.actions?.aiAssistant}</span>
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
          rainIntensity={weather?.precipitation || 0}
          isWeatherOffline={weather?.isOffline || false}
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

      {/* NammaPulse Context-Aware AI Chatbot */}
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
          onClose={() => setShowRouteModal(false)}
          activeHazards={events}
          onApplyRouteToMap={handleApplyRouteToMap}
          userLocation={userLocation}
        />
      )}

      {/* Real-time Notification Toast */}
      {toastMessage && (
        <div className="toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default CityPulseDashboard;
