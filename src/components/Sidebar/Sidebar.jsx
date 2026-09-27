// src/components/Sidebar/Sidebar.jsx
import React from "react";
import PersonalizedFeed from "./PersonalizedFeed";
import CityRecap from "./CityRecap";
import { EMERGENCY_CONTACTS } from "../../data/constants";
import { useLanguage } from "../../context/LanguageContext";
import "./Sidebar.css";

const Sidebar = ({
  activeTab = "feed",
  onTabChange,
  events = [],
  allEvents = null,
  selectedEvent,
  onEventSelect,
  onVerifyEvent,
  onResolveEvent,
  activeFilter = "All",
  rainIntensity = 0,
  isWeatherOffline = false,
}) => {
  const { t } = useLanguage();

  return (
    <aside className="sidebar-container">
      <div className="sidebar-tab-nav">
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === "feed" ? "active" : ""}`}
          onClick={() => onTabChange("feed")}
        >
          {t.tabs.feed}
        </button>
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === "recap" ? "active" : ""}`}
          onClick={() => onTabChange("recap")}
        >
          {t.tabs.recap}
        </button>
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === "helpline" ? "active" : ""}`}
          onClick={() => onTabChange("helpline")}
        >
          {t.tabs.helpline}
        </button>
      </div>

      <div className="sidebar-scrollable-body">
        {activeTab === "feed" && (
          <PersonalizedFeed
            events={events}
            selectedEvent={selectedEvent}
            onEventSelect={onEventSelect}
            onVerifyEvent={onVerifyEvent}
            onResolveEvent={onResolveEvent}
            activeFilter={activeFilter}
          />
        )}

        {activeTab === "recap" && (
          <CityRecap
            events={allEvents || events}
            rainIntensity={rainIntensity}
            isWeatherOffline={isWeatherOffline}
          />
        )}

        {activeTab === "helpline" && (
          <div className="helpline-tab-content">
            <div className="helpline-header">
              <h4>{t.sidebar.helplineTitle}</h4>
              <p>{t.sidebar.helplineSub}</p>
            </div>
            <div className="helpline-list">
              {EMERGENCY_CONTACTS.map((c) => (
                <div key={c.name} className="helpline-card">
                  <div className="helpline-card-info">
                    <h6>{c.name}</h6>
                    <p>{c.desc}</p>
                  </div>
                  <a href={`tel:${c.number.split(" ")[0]}`} className="helpline-call-btn">
                    📞 {c.number}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
