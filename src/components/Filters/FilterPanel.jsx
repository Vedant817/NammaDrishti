// src/components/Filters/FilterPanel.jsx
import React from "react";
import { filters } from "../../data/constants";
import { useLanguage } from "../../context/LanguageContext";
import "./FilterPanel.css";

const FilterPanel = ({ activeFilter, onFilterChange, events = [] }) => {
  const { t } = useLanguage();

  const getCountForFilter = (filterId) => {
    if (filterId === "All") return events.length;
    return events.filter((e) => e.type === filterId).length;
  };

  return (
    <div className="filter-panel-bar">
      <div className="filter-chips-list">
        <span className="filter-source-label">{t.live.citizenData}</span>
        {filters.filter(filter => !["Event", "Rain"].includes(filter.id)).map((filter) => {
          const count = getCountForFilter(filter.id);
          const isActive = activeFilter === filter.id;
          const translatedName = (t.filters && t.filters[filter.id]) || filter.name;

          return (
            <button
              key={filter.id}
              type="button"
              className={`filter-chip ${isActive ? "active" : ""}`}
              aria-pressed={isActive}
              onClick={() => onFilterChange(filter.id)}
            >
              <span className={`filter-chip-dot category-${filter.id.toLowerCase()}`} aria-hidden="true" />
              <span className="filter-chip-name">{translatedName}</span>
              <span className="filter-chip-count">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FilterPanel;
