// src/components/Dashboard/CityPulseDashboard.jsx
import React, { useState } from "react";
import Header from "../Header/Header";
import MapContainer from "../Map/MapContainer";
import Sidebar from "../Sidebar/Sidebar";
import FilterPanel from "../Filters/FilterPanel";
import ReportModal from "../Modals/ReportModal";
import ChatbotModal from "../Chatbot/ChatbotModal";
import { useEventData } from "../../hooks/useEventData";
import { useWeather } from "../../hooks/useWeather";
import "./CityPulseDashboard.css";

function CityPulseDashboard() {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeFilter, setActiveFilter] = useState("All");
  const [showReportModal, setShowReportModal] = useState(false);
  const [showChatbotModal, setShowChatbotModal] = useState(false);
  const [sidebarTab, setSidebarTab] = useState("feed");
  const [reportPin, setReportPin] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const { events, addEvent, verifyEvent, resolveEvent } = useEventData();
  const weather = useWeather();

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Filter events based on active category
  const filteredEvents =
    activeFilter === "All"
      ? events
      : events.filter((e) => e.type === activeFilter);

  // Handle map click to pin report coordinates
  const handleMapClick = (coords) => {
    setReportPin(coords);
    showToast(`📍 Selected map coordinate (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}). Click 'Report Hazard' to file report.`);
  };

  const handleOpenReportModal = () => {
    setShowReportModal(true);
  };

  const handleSubmitReport = (newReport) => {
    const created = addEvent(newReport);
    setSelectedEvent(created);
    setReportPin(null);
    showToast("✓ Hazard incident filed and broadcast to NammaPulse live stream!");
  };

  const handleVerifyEvent = (id) => {
    verifyEvent(id);
    showToast("✓ Confirmation recorded (+1 consensus)!");
  };

  const handleResolveEvent = (id) => {
    resolveEvent(id);
    showToast("✓ Incident marked as cleared by citizen consensus.");
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
          />

          {/* Clean Floating Action Buttons */}
          <div className="map-floating-actions">
            <button
              type="button"
              className="action-fab chatbot-fab"
              onClick={() => setShowChatbotModal(true)}
              title="Open NammaPulse AI Assistant"
            >
              🤖 NammaPulse AI
            </button>
            <button
              type="button"
              className="action-fab report-fab"
              onClick={handleOpenReportModal}
              title="Report a civic or traffic hazard"
            >
              🚨 Report Hazard
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
    </div>
  );
}

export default CityPulseDashboard;
