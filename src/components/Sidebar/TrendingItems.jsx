// src/components/Sidebar/TrendingItems.jsx
import React from "react";

// Emoji per hazard type (UI glyph only — never claims its own data source)
const TYPE_GLYPHS = {
  Traffic: "🚗",
  Waterlogging: "🌊",
  Accident: "⚠️",
  Infrastructure: "🔧",
  Event: "🎉",
  Rain: "🌧️",
};

const TrendingItems = ({ events = [] }) => {

  // Live trend derivation: bucket active incidents by ward straight from the
  // live event stream — no hardcoded "trending" rows of any kind.
  const wardBuckets = new Map();
  for (const evt of events) {
    const ward = (evt.ward || "").trim();
    if (!ward) continue;
    if (!wardBuckets.has(ward)) {
      wardBuckets.set(ward, { ward, total: 0, verified: 0, dominantType: evt.type });
    }
    const bucket = wardBuckets.get(ward);
    bucket.total += 1;
    if (evt.isVerified || (evt.verificationCount || 0) >= 3) bucket.verified += 1;
    // Keep the hazard type of the first (most urgent) report for the glyph
    if (!bucket.dominantType) bucket.dominantType = evt.type;
  }

  const liveTrends = Array.from(wardBuckets.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map((bucket, idx) => ({
      id: `trend_${idx}_${bucket.ward}`,
      emoji: TYPE_GLYPHS[bucket.dominantType] || "📍",
      title: bucket.ward,
      description:
        bucket.verified > 0
          ? `${bucket.total} active report${bucket.total > 1 ? "s" : ""} • ${bucket.verified} citizen-verified`
          : `${bucket.total} active report${bucket.total > 1 ? "s" : ""}`,
    }));

  if (liveTrends.length === 0) {
    return (
      <div className="trending-items">
        <p className="trending-empty-state" style={{ fontSize: "0.78rem", color: "#94A3B8", margin: 0 }}>
          📡 No active incidents right now — live trend hotspots will appear here as new citizen hazard reports arrive.
        </p>
      </div>
    );
  }

  return (
    <div className="trending-items">
      {liveTrends.map((item) => (
        <div key={item.id} className="trending-item">
          <div className="trending-icon-wrapper">
            <span className="trending-emoji">{item.emoji}</span>
            <span className="trending-badge">🔥</span>
          </div>
          <div className="trending-details">
            <strong className="trending-title">{item.title}</strong>
            <p className="trending-description">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TrendingItems;
