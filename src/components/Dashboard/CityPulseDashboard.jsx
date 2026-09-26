// src/components/Dashboard/CityPulseDashboard.jsx
import React, { useState, useEffect } from "react";
import Header from "../Header/Header";
import MapContainer from "../Map/MapContainer";
import Sidebar from "../Sidebar/Sidebar";
import FilterPanel from "../Filters/FilterPanel";
import ReportModal from "../Modals/ReportModal";
import ChatbotModal from "../Chatbot/ChatbotModal";
import SafeRouteModal from "../Navigation/SafeRouteModal";
import { useEventData } from "../../hooks/useEventData";
import { useWeather } from "../../hooks/useWeather";
import { useGeolocation } from "../../hooks/useGeolocation";
import { useProximityAlert } from "../../hooks/useProximityAlert";
import { useLanguage } from "../../context/LanguageContext";
import "./CityPulseDashboard.css";

function CityPulseDashboard() {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeFilter, setActiveFilter] = useState("All");
  const [showReportModal, setShowReportModal] = useState(false);
  const [showChatbotModal, setShowChatbotModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [navigationRoute, setNavigationRoute] = useState(null);
  const [sidebarTab, setSidebarTab] = useState("feed");
  const [reportPin, setReportPin] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const { events, addEvent, verifyEvent, resolveEvent, isLiveConnected } = useEventData();
  const weather = useWeather();
  const { location: userLocation, getCurrentLocation } = useGeolocation();
  const { t } = useLanguage();

  // Request location on mount to activate real-time proximity geofencing
  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Monitor geofence proximity to active hazards
  useProximityAlert(userLocation, events, (alert) => {
    showToast(`${alert.title}: ${alert.body}`);
  });

  // Filter events based on active category
  const filteredEvents =
    activeFilter === "All"
      ? events
      : events.filter((e) => e.type === activeFilter);

  // Handle map click to pin report coordinates
  const handleMapClick = (coords) => {
    setReportPin(coords);
    showToast(`📍 Selected coordinate (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}). Open 'Report Hazard' to file report.`);
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
    const res = await verifyEvent(id);
    if (res?.alreadyVoted) {
      showToast("⚠️ You have already verified this incident.");
    } else {
      showToast("✓ Confirmation recorded (+1 consensus)!");
    }
  };

  const handleResolveEvent = async (id) => {
    const res = await resolveEvent(id);
    if (res?.alreadyVoted) {
      showToast("⚠️ You have already voted to clear this incident.");
    } else {
      showToast("✓ Clearance vote recorded (2 confirmations needed to permanently clear).");
    }
  };

  const handleApplyRouteToMap = (route) => {
    setNavigationRoute(route);
    showToast("🧭 Safe navigation corridor calculated and projected onto map!");
  };

  const verifiedPercent = Math.round(
    (events.filter((e) => e.isVerified).length / (events.length || 1)) * 100
  );

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
            onMapClick={handleMapClick}
            onVerifyEvent={handleVerifyEvent}
            onResolveEvent={handleResolveEvent}
            reportPin={reportPin}
            navigationRoute={navigationRoute}
            onClearNavigationRoute={() => setNavigationRoute(null)}
          />

          {/* Floating Action Buttons */}
          <div className="map-floating-actions">
            <button
              type="button"
              className="action-fab fab-route"
              onClick={() => setShowRouteModal(true)}
              title="Compute Safe Navigation Corridor (OSRM)"
            >
              <span>🧭</span>
              <span>Safe Route</span>
            </button>

            <button
              type="button"
              className="action-fab fab-report"
              onClick={handleOpenReportModal}
              title="Report an active hazard or flooded underpass"
            >
              <span>🚨</span>
              <span>{t.actions.reportHazard}</span>
            </button>

            <button
              type="button"
              className="action-fab fab-ai"
              onClick={() => setShowChatbotModal(true)}
              title="Open NammaPulse AI Assistant"
            >
              <span>🤖</span>
              <span>{t.actions.aiAssistant}</span>
            </button>
          </div>
        </main>

        <Sidebar
          events={filteredEvents}
          selectedEvent={selectedEvent}
          onEventSelect={setSelectedEvent}
          onVerifyEvent={handleVerifyEvent}
          onResolveEvent={handleResolveEvent}
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
          rainIntensity={weather?.precipitation || 0}
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
}

export default CityPulseDashboard;
