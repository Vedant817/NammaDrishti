import { API_BASE } from "../../services/api";
import { useLanguage } from '../../context/LanguageContext';
import { useInterfaceCopy } from '../../hooks/useInterfaceCopy';
import { useDialog } from "../../hooks/useDialog";
import { authenticatedFetch as fetch } from "../../services/firebaseService";
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



const ChatbotModal = ({ onClose, events = [], currentEvents = null, weather }) => {
  const copy=useInterfaceCopy();
  const activeEvents = useMemo(() => {
    return Array.isArray(currentEvents) ? currentEvents : (Array.isArray(events) ? events : []);
  }, [currentEvents, events]);

  const { lang, t } = useLanguage();
  const dialogRef = useDialog(onClose);
  const [messages, setMessages] = useState([
    {
      type: "bot",
      text: t.live.assistantIntro,
    },
  ]);
  // Reset the greeting when the UI language changes so the conversation does
  // not keep a stale-language intro.
  useEffect(() => {
    setMessages([{ type: 'bot', text: t.live.assistantIntro }]);
  }, [lang, t]);

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
      utterance.lang = `${lang}-IN`;
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("TTS playback error:", e);
    }
  }, [voiceEnabled, lang]);

  const processQueryLocally = useCallback(() => `${t.live.cachedAnswer} ${activeEvents.length} ${t.live.citizenData}. ${t.live.call112}`, [activeEvents,t]);

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
          language: lang,
        }),
        signal: AbortSignal.timeout(16000),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, { type: "bot", text: data.reply, mode:data.mode }]);
        setIsTyping(false);
        speakText(data.reply);
        return;
      }
    } catch (err) {
      // Backend assistant timed out or offline, proceed with local context responder
    }

    const fallbackResponse = processQueryLocally(text);
    setMessages((prev) => [...prev, { type: "bot", text: fallbackResponse, mode:'cached-summary' }]);
    setIsTyping(false);
    speakText(fallbackResponse);
  }, [input, lang, processQueryLocally, speakText]);

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
      recognition.lang = `${lang}-IN`; // Prioritize Indian English / Bengaluru accents

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
  }, [lang]);

  const [voiceNotice, setVoiceNotice] = useState('');
  const toggleListening = () => {
    if (!recognitionRef.current) {
      setVoiceNotice(t.ui["Voice input is not supported in this browser"] || "Voice input is not supported in this browser. Use Chrome or Edge.");
      return;
    }
    setVoiceNotice('');
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
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="NammaDrishti AI" tabIndex={-1} className="chatbot-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chatbot-modal-header">
          <div className="bot-header-info">
            <span className="bot-avatar">🤖</span>
            <div>
              <h3>{t.ui["City assistant"]}</h3>
              <span className="bot-status">{t.ui["Answers based on current reports"]}</span>
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
            <button type="button" className="close-button" aria-label={t.ui["Close dialog"]} onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="chatbot-modal-body">
          <div className="quick-prompts-bar">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={t.ui[prompt] || prompt}
                type="button"
                className="quick-prompt-chip"
                onClick={() => handleSendMessage(prompt)}
              >
                {t.ui[prompt] || prompt}
              </button>
            ))}
          </div>

          <div className="messages">
            {voiceNotice && <p role="status" className="voice-notice">{voiceNotice}</p>}
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.type}`}>
                <div className="message-content">
                  {message.mode && <small>{message.mode==='gemini-grounded'?'AI answer using current reports':message.mode==='grounded-summary-provider-unavailable'?'Report summary · AI service unavailable':message.mode==='cached-summary'?'Offline summary · cached reports':'Source summary'}</small>}
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
              aria-label={copy.ask}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder={isListening ? t.ui["Listening to your voice..."] : t.ui["Ask about traffic, floods, road hazards..."]}
            />
            <button
              type="button"
              className="send-button"
              onClick={() => handleSendMessage()}
              disabled={!input.trim()}
            >
              {copy.send}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatbotModal;
