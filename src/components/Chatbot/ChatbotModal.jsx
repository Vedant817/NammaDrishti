// src/components/Chatbot/ChatbotModal.jsx
import React, { useState } from "react";
import "./ChatbotModal.css";

const QUICK_PROMPTS = [
  "Is Silk Board jammed?",
  "Any flooded underpasses?",
  "Rain radar status?",
  "How to report a pothole?",
  "Emergency helplines",
];

const getApiBase = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    return `${window.location.origin}/api`;
  }
  return "http://localhost:5001/api";
};

const API_BASE = getApiBase();

const ChatbotModal = ({ onClose, events = [], currentEvents = null, weather }) => {
  const activeEvents = Array.isArray(currentEvents) ? currentEvents : (Array.isArray(events) ? events : []);

  const [messages, setMessages] = useState([
    {
      type: "bot",
      text: "Namaskara! I am NammaPulse AI, your live Bengaluru civic & traffic intelligence assistant. How can I assist your transit today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Dynamic context-aware query responder fallback
  const processQueryLocally = (userQuery) => {
    const q = userQuery.toLowerCase();

    // Check Traffic & Silk Board / BTM
    if (q.includes("silk board") || q.includes("btm")) {
      const matchEvt = activeEvents.find((e) =>
        (e.title && (e.title.toLowerCase().includes("silk board") || e.title.toLowerCase().includes("btm"))) ||
        (e.ward && (e.ward.toLowerCase().includes("silk board") || e.ward.toLowerCase().includes("btm"))) ||
        (e.description && (e.description.toLowerCase().includes("silk board") || e.description.toLowerCase().includes("btm")))
      );
      if (matchEvt) {
        return `🚨 ${matchEvt.title} (${matchEvt.ward || 'BTM / Silk Board'}): ${matchEvt.description} Delays are approx +28 minutes. BTP recommends taking Hosur Road elevated tollway if heading to Electronic City.`;
      }
      return "Silk Board and BTM Layout corridors are currently moving at moderate speeds with standard signal delays.";
    }

    // Check Doppler Weather Radar specifically
    if (q.includes("radar")) {
      const rainStatus = weather?.precipitation > 0
        ? `RainViewer Doppler radar indicates active rain bands (${weather.precipitation} mm/hr) over municipal wards. Toggle the 'Doppler Rain Radar' button on the map to inspect live 5-minute reflectivity frames.`
        : `RainViewer Doppler radar shows clear skies over Bengaluru currently with zero significant precipitation echoes detected. Toggle the radar layer on the map to view live reflectivity scans.`;
      return `📡 Doppler Weather Radar: ${rainStatus}`;
    }

    // Check Waterlogging / Flooding / Underpass
    if (q.includes("flood") || q.includes("waterlog") || q.includes("underpass") || q.includes("panathur")) {
      const floodEvts = activeEvents.filter((e) => e.type === "Waterlogging");
      if (floodEvts.length > 0) {
        const details = floodEvts.map((f) => `• ${f.title}: ${f.description}`).join("\n");
        return `⚠️ Active Waterlogging Alert in Bengaluru:\n${details}\n\nCurrent Precipitation: ${weather ? weather.precipitation + " mm" : "Active monitoring"}. Divert from low-lying railway underpasses.`;
      }
      return "Good news! No major underpasses or arterial roads are reporting severe inundation right now.";
    }

    // Check Weather / Rain
    if (q.includes("rain") || q.includes("weather")) {
      if (weather) {
        return `🌧️ Bengaluru Weather: ${weather.temp}°C, ${weather.description}. Relative humidity is ${weather.humidity}% with ${weather.precipitation}mm precipitation. Flood Risk is currently assessed as ${weather.floodRisk}.`;
      }
      return "Current weather in Bengaluru is partly cloudy with isolated shower chances in East & South zones.";
    }

    // Check Hebbal / Airport road
    if (q.includes("hebbal") || q.includes("airport")) {
      const hebbalEvt = activeEvents.find((e) =>
        (e.title && e.title.toLowerCase().includes("hebbal")) ||
        (e.ward && e.ward.toLowerCase().includes("hebbal")) ||
        (e.description && e.description.toLowerCase().includes("airport"))
      );
      if (hebbalEvt) {
        return `✈️ Hebbal Flyover Update: ${hebbalEvt.title}. ${hebbalEvt.description} Allow an extra 20–25 minutes if traveling to KIA.`;
      }
      return "Airport Expressway via Hebbal is moving smoothly with usual airport traffic.";
    }

    // Check Pothole / Reporting
    if (q.includes("pothole") || q.includes("report") || q.includes("how to report")) {
      return "To report a hazard directly in NammaPulse:\n1. Click the 'Report Incident' button at the bottom-right of the map.\n2. Choose 'Pothole / Infra' or 'Traffic'.\n3. Click 'Auto-Detect GPS' or tap on the map to pin the exact coordinates.\n4. Submit! It will immediately be added to the live consensus stream.";
    }

    // Emergency Contacts
    if (q.includes("emergency") || q.includes("helpline") || q.includes("police") || q.includes("bbmp")) {
      return "📞 Bengaluru Emergency Helplines:\n• BTP Traffic Police: 1095 / 080-22943030\n• BBMP Control Room: 1533\n• BESCOM Power Breakdown: 1912\n• BWSSB Water Supply: 1916\n• National Emergency: 112";
    }

    // General fallback
    return `Currently tracking ${activeEvents.length} live incidents across Bengaluru. You can ask me about Silk Board, BTM, Hebbal, waterlogging, weather radar, or emergency helplines!`;
  };

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim()) return;

    const userMessage = { type: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch(`${API_BASE}/assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context: { weather, rainIntensity: weather?.precipitation, incidents: activeEvents },
        }),
        signal: AbortSignal.timeout(2500),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, { type: "bot", text: data.reply }]);
        setIsTyping(false);
        return;
      }
    } catch (err) {
      // Backend assistant timed out or offline, proceed with local context responder
    }

    const fallbackResponse = processQueryLocally(text);
    setMessages((prev) => [...prev, { type: "bot", text: fallbackResponse }]);
    setIsTyping(false);
  };

  return (
    <div className="chatbot-modal-overlay" onClick={onClose}>
      <div className="chatbot-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chatbot-modal-header">
          <div className="bot-header-info">
            <span className="bot-avatar">🤖</span>
            <div>
              <h3>NammaPulse AI</h3>
              <span className="bot-status">● Live City Context</span>
            </div>
          </div>
          <button type="button" className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="chatbot-modal-body">
          <div className="quick-prompts-bar">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="quick-prompt-chip"
                onClick={() => handleSendMessage(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="messages">
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.type}`}>
                <div className="message-content">
                  {message.text.split("\n").map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="message bot typing">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            )}
          </div>

          <div className="input-area">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Ask about traffic, floods, road hazards..."
            />
            <button
              type="button"
              className="send-button"
              onClick={() => handleSendMessage()}
              disabled={!input.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatbotModal;
