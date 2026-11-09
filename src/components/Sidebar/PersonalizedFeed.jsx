import {incidentTime} from '../../utils/incidentTime';
import {useInterfaceCopy} from '../../hooks/useInterfaceCopy';
// src/components/Sidebar/PersonalizedFeed.jsx
import React, { useState } from "react";
import { MapPin } from "lucide-react";
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
  onVerifyEvent,
  onResolveEvent,
  hasUserVoted,
  activeFilter = "All",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedEventId, setCopiedEventId] = useState(null);
  const { t,lang } = useLanguage();
  const ui = useInterfaceCopy();

  // Direct link that re-opens this incident on the map (?incident=<id>)
  const buildIncidentLink = (item) => {
    return `${currentAppOrigin()}?incident=${encodeURIComponent(item.id)}`;
  };

  const [copyNotice, setCopyNotice] = useState('');
  const handleCopyLink = async (e, item) => {
    e.stopPropagation();
    const link = buildIncidentLink(item);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(link);
      setCopiedEventId(item.id);
      setCopyNotice(t.ui?.["Link copied"] || 'Link copied');
      setTimeout(() => { setCopiedEventId((cur) => (cur === item.id ? null : cur)); setCopyNotice(''); }, 2000);
    } catch (err) {
      setCopyNotice(`${link}`);
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
      ? `https://www.openstreetmap.org/?mlat=${item.position.lat}&mlon=${item.position.lng}#map=17/${item.position.lat}/${item.position.lng}`
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
          aria-label={t.ui["Search incidents"]}
        />
        {searchQuery && (
          <button
            type="button"
            className="clear-search-btn"
            aria-label={ui.clearSearch || t.ui["Clear search"] || 'Clear search'}
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
      {copyNotice && <p role="status" className="copy-notice">{copyNotice}</p>}

      <div className="feed-items-list">
        {filteredEvents.length === 0 ? (
          <div className="feed-empty-state">
            <MapPin size={28} strokeWidth={1.4} aria-hidden="true" />
            <h5>{searchQuery ? ui.noMatches : t.sidebar.emptyState}</h5><p>{searchQuery ? ui.tryOther : "Reports from people nearby will appear here. See something on your route? Add it to the map."}</p>
          </div>
        ) : (
          filteredEvents.map((item) => {
            const isSelected = selectedEvent && selectedEvent.id === item.id;

            return (
              <article
                key={item.id}
                className={`feed-item-card ${isSelected ? "selected" : ""}`}
                aria-current={isSelected || undefined}
              >
                <div className="card-top-row">
                  <span className={`urgency-dot ${getUrgencyClass(item.urgency)}`}></span>
                  <span className="card-type">
                    {(t.filters && t.filters[item.type]) || item.type}
                  </span>
                  {item.clusterCount > 1 && (
                    <span className="card-cluster-pill" title={ui.mergedHint}>
                      🔗 {item.clusterCount} {ui.merged}
                    </span>
                  )}
                  {item.groundVerified && (
                    <span className="card-ground-pill" title={ui.groundHint}>
                      📍 {ui.onGround}
                    </span>
                  )}
                  <span className="card-time">{incidentTime(item,lang)}</span>
                </div>

                <h5 className="card-title"><button type="button" className="incident-title-btn" onClick={() => onEventSelect?.(item)}>{item.title}</button></h5>
                <p className="card-desc">{item.description}</p>
                {item.waterDepth && (
                  <div className="card-water-depth-pill" style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', background: 'rgba(6, 182, 212, 0.12)', color: '#06B6D4', padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', marginTop: '6px', marginBottom: '4px' }}>
                    <span>🌊 {ui.depthLabel} <strong>{item.waterDepth}</strong></span>
                    {item.vehiclePassability && <span>• 🚫 {item.vehiclePassability}</span>}
                  </div>
                )}

                <div className="card-bottom-row">
                  <span className="card-ward">{item.ward || "Bengaluru"}</span>
                  <div className="card-actions-right">
                    <button
                      type="button"
                      className="copy-link-btn"
                      onClick={(e) => handleCopyLink(e, item)}
                      title={ui.copyLinkHint}
                    >
                      {copiedEventId === item.id ? ui.copied : ui.copyLink}
                    </button>
                    <button
                      type="button"
                      className="whatsapp-share-btn"
                      onClick={(e) => handleWhatsAppShare(e, item)}
                      title={ui.shareHint}
                    >
                      {ui.shareBtn}
                    </button>
                    <div className="card-verifications">
                      <span>{item.verificationCount || 1} {t.actions.confirmations}</span>
                      {item.isVerified && <span className="verified-glyph">✓</span>}
                    </div>
                    {onVerifyEvent && <button type="button" className="feed-action-btn" disabled={hasUserVoted?.(item.id,'verify')===true} aria-label={`${ui.confirmAction} — ${item.title}`} onClick={() => onVerifyEvent(item.id)}>{ui.confirmAction}</button>}
                    {onResolveEvent && <button type="button" className="feed-action-btn" disabled={hasUserVoted?.(item.id,'clear')===true} aria-label={`${ui.clearAction} — ${item.title}`} onClick={() => onResolveEvent(item.id)}>{ui.clearAction}</button>}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>


    </div>
  );
};

export default PersonalizedFeed;
