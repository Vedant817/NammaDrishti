// src/components/Sidebar/Sidebar.jsx
import React from "react";
import PersonalizedFeed from "./PersonalizedFeed";
import CityRecap from "./CityRecap";
import { EMERGENCY_CONTACTS } from "../../data/constants";
import "./Sidebar.css";

const Sidebar = ({
  activeTab = "feed",
  onTabChange,
  events = [],
  selectedEvent,
  onEventSelect,
  activeFilter = "All",
}) => {
  return (
    <aside className="sidebar-container">
      <div className="sidebar-tabs">
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === "feed" ? "active" : ""}`}
          onClick={() => onTabChange("feed")}
        >
          🚨 Live Feed
        </button>
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === "recap" ? "active" : ""}`}
          onClick={() => onTabChange("recap")}
        >
          📊 Diagnostic
        </button>
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === "helpline" ? "active" : ""}`}
          onClick={() => onTabChange("helpline")}
        >
          ☎️ Helplines
        </button>
      </div>

      <div className="sidebar-scrollable-body">
        {activeTab === "feed" && (
          <PersonalizedFeed
            events={events}
            selectedEvent={selectedEvent}
            onEventSelect={onEventSelect}
            activeFilter={activeFilter}
          />
        )}

        {activeTab === "recap" && <CityRecap events={events} />}

        {activeTab === "helpline" && (
          <div className="helpline-tab-content">
            <div className="helpline-header">
              <h4>Bengaluru Emergency Helplines</h4>
              <p>Direct official control rooms for civic, traffic & utility emergencies.</p>
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
