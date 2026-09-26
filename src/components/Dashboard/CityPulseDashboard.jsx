// src/components/Dashboard/CityPulseDashboard.jsx
import React, { useState } from "react";
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
  const { location: userLocation } = useGeolocation();
  const { t } = useLanguage();

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

  const handleVerifyEvent = (id) => {
    verifyEvent(id);
    showToast("✓ Confirmation recorded (+1 consensus)!");
  };

  const handleResolveEvent = (id) => {
    resolveEvent(id);
    showToast("✓ Incident marked as cleared by citizen consensus.");
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

      {/* Modern Filter Chip Bar */}
      <FilterPanel
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        events={events}
      />

      {/* Main Workspace */}
      <div className="main-content">
        <Sidebar
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
          events={events}
          selectedEvent={selectedEvent}
          onEventSelect={setSelectedEvent}
          activeFilter={activeFilter}
        />

        <div className="map-section">
          <MapContainer
            events={filteredEvents}
            selectedEvent={selectedEvent}
            onEventSelect={setSelectedEvent}
            onVerifyEvent={handleVerifyEvent}
            onResolveEvent={handleResolveEvent}
            onMapClick={handleMapClick}
            reportPin={reportPin}
            navigationRoute={navigationRoute}
            onClearNavigationRoute={() => setNavigationRoute(null)}
          />

          {/* Clean Floating Action Buttons */}
          <div className="map-floating-actions">
            <button
              type="button"
              className="action-fab route-fab"
              onClick={() => setShowRouteModal(true)}
              title="Calculate Safe Transit Route avoiding flooded underpasses"
            >
              🧭 Safe Route
            </button>
            <button
              type="button"
              className="action-fab chatbot-fab"
              onClick={() => setShowChatbotModal(true)}
              title="Open NammaPulse AI Assistant"
            >
              {t.actions.aiAssistant}
            </button>
            <button
              type="button"
              className="action-fab report-fab"
              onClick={handleOpenReportModal}
              title="Report a civic or traffic hazard"
            >
              {t.actions.reportHazard}
            </button>
          </div>
        </div>
      </div>

      {/* Live Toast Notifications */}
      {toastMessage && (
        <div className="dashboard-toast-notification">
          <span>{toastMessage}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setToastMessage(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Modals */}
      {showReportModal && (
        <ReportModal
          onClose={() => setShowReportModal(false)}
          onSubmitReport={handleSubmitReport}
          initialCoordinates={reportPin}
        />
      )}

      {showChatbotModal && (
        <ChatbotModal
          onClose={() => setShowChatbotModal(false)}
          events={events}
          weather={weather}
        />
      )}

      {showRouteModal && (
        <SafeRouteModal
          onClose={() => setShowRouteModal(false)}
          activeHazards={events}
          onApplyRouteToMap={handleApplyRouteToMap}
          userLocation={userLocation}
        />
      )}
    </div>
  );
}

export default CityPulseDashboard;
