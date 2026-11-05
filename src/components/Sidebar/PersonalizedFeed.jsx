// src/components/Sidebar/PersonalizedFeed.jsx
import React, { useState } from "react";
import TrendingItems from "./TrendingItems";
import { useLanguage } from "../../context/LanguageContext";

const currentAppOrigin = () => {
  if (typeof window === "undefined") return "/";
  return `${window.location.origin}${window.location.pathname}`;
};

const PersonalizedFeed = ({
  events = [],
  allEvents = null,
  selectedEvent,
  onEventSelect,
  activeFilter = "All",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedEventId, setCopiedEventId] = useState(null);
  const { t } = useLanguage();

  // Direct link that re-opens this incident on the map (?incident=<id>)
  const buildIncidentLink = (item) => {
    return `${currentAppOrigin()}?incident=${encodeURIComponent(item.id)}`;
  };

  const handleCopyLink = async (e, item) => {
    e.stopPropagation();
    const link = buildIncidentLink(item);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        window.prompt("Copy this incident link:", link);
      }
      setCopiedEventId(item.id);
      setTimeout(() => setCopiedEventId((cur) => (cur === item.id ? null : cur)), 2000);
    } catch (err) {
      window.prompt("Copy this incident link:", link);
    }
  };

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
      : currentAppOrigin();
    const appLink = buildIncidentLink(item);
    const text = `🚨 *NammaDrishti Civic Alert - Bengaluru*\n*Hazard:* ${item.title} (${item.type})\n*Ward:* ${item.ward || "Bengaluru"}\n*Details:* ${item.description}\n*Location:* ${mapLink}\n*Open live on map:* ${appLink}\n_Stay safe & take alternate routes._`;
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
                {item.waterDepth && (
                  <div className="card-water-depth-pill" style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', background: 'rgba(6, 182, 212, 0.12)', color: '#06B6D4', padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', marginTop: '6px', marginBottom: '4px' }}>
                    <span>🌊 Depth: <strong>{item.waterDepth}</strong></span>
                    {item.vehiclePassability && <span>• 🚫 {item.vehiclePassability}</span>}
                  </div>
                )}

                <div className="card-bottom-row">
                  <span className="card-ward">📍 {item.ward || "Bengaluru"}</span>
                  <div className="card-actions-right">
                    <button
                      type="button"
                      className="copy-link-btn"
                      onClick={(e) => handleCopyLink(e, item)}
                      title="Copy a direct link that opens this incident on the map"
                    >
                      {copiedEventId === item.id ? "✓ Copied" : "🔗 Copy Link"}
                    </button>
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
      <TrendingItems events={allEvents || events} />
    </div>
  );
};

export default PersonalizedFeed;
