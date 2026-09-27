// src/components/Sidebar/PersonalizedFeed.jsx
import React, { useState } from "react";
import TrendingItems from "./TrendingItems";
import { useLanguage } from "../../context/LanguageContext";

const calculateTrustScore = (item) => {
  const reporter = (item.reportedBy || "").toLowerCase();
  if (
    reporter.includes("police") ||
    reporter.includes("patrol") ||
    reporter.includes("btp") ||
    reporter.includes("monitor")
  ) {
    return 96;
  }
  const votes = Number(item.verificationCount) || 1;
  return Math.min(98, Math.max(65, 62 + votes * 6));
};

const PersonalizedFeed = ({
  events = [],
  selectedEvent,
  onEventSelect,
  activeFilter = "All",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useLanguage();

  const filteredEvents = events.filter((event) => {
    const matchesFilter =
      activeFilter === "All" || event.type === activeFilter;
    const matchesSearch =
      searchQuery.trim() === "" ||
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (event.ward && event.ward.toLowerCase().includes(searchQuery.toLowerCase())) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getUrgencyClass = (urgency) => {
    switch (urgency?.toLowerCase()) {
      case "high":
        return "urgency-high";
      case "medium":
        return "urgency-med";
      case "low":
        return "urgency-low";
      default:
        return "urgency-med";
    }
  };

  const translatedFilterName =
    activeFilter === "All"
      ? t.sidebar.liveIncidents
      : `${(t.filters && t.filters[activeFilter]) || activeFilter}`;

  const handleWhatsAppShare = (e, item) => {
    e.stopPropagation();
    const mapLink = item.position
      ? `https://maps.google.com/?q=${item.position.lat},${item.position.lng}`
      : "https://nammapulse.app";
    const text = `🚨 *NammaPulse Civic Alert - Bengaluru*\n*Hazard:* ${item.title} (${item.type})\n*Ward:* ${item.ward || "Bengaluru"}\n*Details:* ${item.description}\n*Location:* ${mapLink}\n_Stay safe & take alternate routes._`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="feed-content">
      {/* Search Input */}
      <div className="feed-search-box">
        <input
          type="text"
          placeholder={t.sidebar.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search incidents"
        />
        {searchQuery && (
          <button
            type="button"
            className="clear-search-btn"
            onClick={() => setSearchQuery("")}
          >
            ✕
          </button>
        )}
      </div>

      <div className="feed-section-header">
        <h4>
          {translatedFilterName}
          <span className="feed-count-badge">{filteredEvents.length}</span>
        </h4>
      </div>

      <div className="feed-items-list">
        {filteredEvents.length === 0 ? (
          <div className="feed-empty-state">
            <span className="empty-icon">✓</span>
            <p>{t.sidebar.emptyState}</p>
          </div>
        ) : (
          filteredEvents.map((item) => {
            const isSelected = selectedEvent && selectedEvent.id === item.id;
            const trustScore = calculateTrustScore(item);

            return (
              <div
                key={item.id}
                className={`feed-item-card ${isSelected ? "selected" : ""}`}
                onClick={() => onEventSelect && onEventSelect(item)}
              >
                <div className="card-top-row">
                  <span className={`urgency-dot ${getUrgencyClass(item.urgency)}`}></span>
                  <span className="card-type">
                    {(t.filters && t.filters[item.type]) || item.type}
                  </span>
                  <span className="card-trust-pill" title="Citizen & sensor consensus score">
                    🛡️ {trustScore}% Trust
                  </span>
                  {item.clusterCount > 1 && (
                    <span className="card-cluster-pill" title="Multiple citizen reports merged within 200m">
                      🔗 {item.clusterCount} merged
                    </span>
                  )}
                  {item.groundVerified && (
                    <span className="card-ground-pill" title="Verified within 1.5km of incident location">
                      📍 On-Ground
                    </span>
                  )}
                  <span className="card-time">{item.timestamp}</span>
                </div>

                <h5 className="card-title">{item.title}</h5>
                <p className="card-desc">{item.description}</p>

                <div className="card-bottom-row">
                  <span className="card-ward">📍 {item.ward || "Bengaluru"}</span>
                  <div className="card-actions-right">
                    <button
                      type="button"
                      className="whatsapp-share-btn"
                      onClick={(e) => handleWhatsAppShare(e, item)}
                      title="Share emergency hazard alert via WhatsApp"
                    >
                      💬 SOS Share
                    </button>
                    <div className="card-verifications">
                      <span>👥 {item.verificationCount || 1} {t.actions.confirmations}</span>
                      {item.isVerified && <span className="verified-glyph">✓</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="trending-divider">
        <h4>{t.sidebar.trendingHeader}</h4>
      </div>
      <TrendingItems />
    </div>
  );
};

export default PersonalizedFeed;
