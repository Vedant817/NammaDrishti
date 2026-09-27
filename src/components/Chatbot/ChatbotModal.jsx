// src/components/Chatbot/ChatbotModal.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  const activeEvents = useMemo(() => {
    return Array.isArray(currentEvents) ? currentEvents : (Array.isArray(events) ? events : []);
  }, [currentEvents, events]);

  const [messages, setMessages] = useState([
    {
      type: "bot",
      text: "Namaskara! I am NammaDrishti AI, your live Bengaluru civic & transit radar assistant. How can I assist your commute today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const recognitionRef = useRef(null);
  const sendHandlerRef = useRef(null);

  const speakText = useCallback((text) => {
    if (!voiceEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      // Strip markdown and emojis for clean speech
      const clean = text.replace(/[\u{1F300}-\u{1F9FF}]/gu, "").replace(/[*_#`]/g, "");
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("TTS playback error:", e);
    }
  }, [voiceEnabled]);

  // Dynamic context-aware query responder fallback
  const processQueryLocally = useCallback((userQuery) => {
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
      return "To report a hazard directly in NammaDrishti:\n1. Click the 'Report Hazard' button at the bottom-right of the map.\n2. Choose 'Potholes / Infra' or 'Traffic'.\n3. Click 'Auto-Detect GPS' or tap on the map to pin the exact coordinates.\n4. Submit! It will immediately be added to the live consensus stream.";
    }

    // Emergency Contacts
    if (q.includes("emergency") || q.includes("helpline") || q.includes("police") || q.includes("bbmp") || q.includes("sos")) {
      return "📞 Bengaluru Emergency Helplines:\n• BTP Traffic Police: 1095 / 080-22943030\n• BBMP Control Room: 1533\n• BESCOM Power Breakdown: 1912\n• BWSSB Water Supply: 1916\n• National Emergency: 112\n\nTip: You can also use the 'Emergency SOS' button in the Helplines sidebar for instant GPS dispatch!";
    }

    // General fallback
    return `Currently tracking ${activeEvents.length} live incidents across Bengaluru. You can ask me about Silk Board, BTM, Hebbal, waterlogging, weather radar, or emergency helplines!`;
  }, [activeEvents, weather]);

  const handleSendMessage = useCallback(async (textToSend) => {
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
        speakText(data.reply);
        return;
      }
    } catch (err) {
      // Backend assistant timed out or offline, proceed with local context responder
    }

    const fallbackResponse = processQueryLocally(text);
    setMessages((prev) => [...prev, { type: "bot", text: fallbackResponse }]);
    setIsTyping(false);
    speakText(fallbackResponse);
  }, [input, activeEvents, weather, processQueryLocally, speakText]);

  // Keep ref up to date for speech recognition callback
  useEffect(() => {
    sendHandlerRef.current = handleSendMessage;
  }, [handleSendMessage]);

  // Initialize SpeechRecognition once
  useEffect(() => {
    const SpeechRecognition = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN"; // Prioritize Indian English / Bengaluru accents

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
          if (sendHandlerRef.current) {
            sendHandlerRef.current(transcript);
          }
        }
      };
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Voice recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn("Speech recognition start failed:", err);
      }
    }
  };

  return (
    <div className="chatbot-modal-overlay" onClick={onClose}>
      <div className="chatbot-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chatbot-modal-header">
          <div className="bot-header-info">
            <span className="bot-avatar">🤖</span>
            <div>
              <h3>NammaDrishti AI</h3>
              <span className="bot-status">● Live City Radar Context</span>
            </div>
          </div>
          <div className="header-actions-group">
            <button
              type="button"
              className={`tts-toggle-btn ${voiceEnabled ? "active" : ""}`}
              onClick={() => setVoiceEnabled((prev) => !prev)}
              title={voiceEnabled ? "Mute Voice Speech" : "Enable Hands-Free Speech"}
            >
              {voiceEnabled ? "🔊" : "🔇"}
            </button>
            <button type="button" className="close-button" onClick={onClose}>
              ✕
            </button>
          </div>
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
            <button
              type="button"
              className={`voice-mic-btn ${isListening ? "listening" : ""}`}
              onClick={toggleListening}
              title={isListening ? "Listening... click to stop" : "Speak your query (Speech to Text)"}
            >
              {isListening ? "🎙️..." : "🎤"}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder={isListening ? "Listening to your voice..." : "Ask about traffic, floods, road hazards..."}
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
