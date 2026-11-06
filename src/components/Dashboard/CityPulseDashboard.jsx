import {MAX_ACTION_AGE_MS} from '../../services/actionRunner';
import {useOfflineCopy} from '../../data/offlineCopy';
import {isActionIdentityCurrent} from '../../services/firebaseService';
import { routeContext } from '../../services/routeContext';
import { useReactiveRoute } from '../../hooks/useReactiveRoute';
import { useTrafficData } from '../../hooks/useTrafficData';
import { usePublicContext } from '../../hooks/usePublicContext';
import { Plus, Route, MessageSquare } from "lucide-react";
// src/components/Dashboard/CityPulseDashboard.jsx
import React, { useState, useEffect, useRef } from "react";
import Header from "../Header/Header";
import {useInterfaceCopy} from "../../hooks/useInterfaceCopy";
import MapContainer from "../Map/MapContainer";
import Sidebar from "../Sidebar/Sidebar";
import ReportModal from "../Modals/ReportModal";
import ChatbotModal from "../Chatbot/ChatbotModal";
import SafeRouteModal from "../Navigation/SafeRouteModal";
import { useEventData } from "../../hooks/useEventData";
import { useWeatherTelemetry } from "../../hooks/useWeatherTelemetry";
import { useProximityAlert } from "../../hooks/useProximityAlert";
import "./CityPulseDashboard.css";

// GEV-pattern shareable state: ?incident=<id> re-opens the shared hazard, and
// ?view=lat,lng,z restores the map camera. Parsed once at module load.
const parseDeepLinkParams = () => {
  if (typeof window === "undefined") return { incidentId: null, view: null };
  const params = new URLSearchParams(window.location.search);
  const incidentId = params.get("incident");
  let view = null;
  const rawView = params.get("view");
  if (rawView) {
    const parts = rawView.split(",").map((v) => Number(v.trim()));
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      const zoomNum = Number.isFinite(parts[2]) ? Math.max(4, Math.min(18, Math.round(parts[2]))) : 14;
      view = { lat: Math.max(-90, Math.min(90, parts[0])), lng: Math.max(-180, Math.min(180, parts[1])), zoom: zoomNum };
    }
  }
  return { incidentId: incidentId ? incidentId.trim() : null, view };
};

const DEEP_LINK = parseDeepLinkParams();

const CityPulseDashboard = () => {
  const { events, isLiveConnected, offlineQueueCount, addEvent, verifyEvent, resolveEvent, actionIdentity, savedActions, actionGate, storageError, legacyActions, invalidActionCount, changeAction } = useEventData();
  const { weather } = useWeatherTelemetry();
  const { traffic, clock } = useTrafficData();
  const { context: publicContext, clock: sourceClock } = usePublicContext();
  const copy=useInterfaceCopy();
  const offline=useOfflineCopy();
  const [editingAction,setEditingAction]=useState(null);
  const [reportIdentity,setReportIdentity]=useState(null);

  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showChatbotModal, setShowChatbotModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [sidebarTab, setSidebarTab] = useState("today");
  const [reportPin, setReportPin] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [navigationRoute, setNavigationRoute] = useState(null);
  const routeSources = routeContext(events, publicContext.traffic, sourceClock);
  useReactiveRoute(navigationRoute, setNavigationRoute, routeSources.hazards, isLiveConnected, routeSources.coverage);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(()=>{
    setEditingAction(null);setShowReportModal(false);setReportPin(null);setSelectedEvent(null);setToastMessage(null);
  },[actionIdentity?.uid,actionIdentity?.sessionKey]);

  // Deep-link camera: one-shot fly for ?view=... (only until the user interacts)
  const [initialCamera, setInitialCamera] = useState(
    DEEP_LINK.incidentId || !DEEP_LINK.view
      ? null
      : { center: [DEEP_LINK.view.lat, DEEP_LINK.view.lng], zoom: DEEP_LINK.view.zoom }
  );

  // Auto-detect commuter GPS on mount to power proximity verification
  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          console.warn("[Dashboard] GPS detection deferred:", err.message);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const incidentLinkUsedRef = useRef(false);

  // Restore a ?incident=<id> deep link once the live event stream has loaded
  useEffect(() => {
    if (incidentLinkUsedRef.current || !DEEP_LINK.incidentId || events.length === 0) return undefined;
    const match = events.find((e) => String(e.id) === String(DEEP_LINK.incidentId));
    incidentLinkUsedRef.current = true; // one-shot: stop watching after the first load pass
    if (match) {
      setSelectedEvent(match);
      setInitialCamera(null);
      showToast(`🔗 Opened shared incident: ${match.title}`);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Real-time audio-visual proximity alert listener for severe nearby hazards
  useProximityAlert(userLocation, events, (alert) => {
    if (alert && alert.hazard) {
      showToast(`⚠️ Hazard Alert: ${alert.hazard.title} is ${alert.distanceKm ? alert.distanceKm.toFixed(1) : ''} km away!`);
    } else {
      showToast("⚠️ Proximity Alert: High urgency hazard detected near your location!");
    }
  });

  const handleEventSelect = (event) => {
    // User interaction voids any deep-linked camera restore
    setInitialCamera(null);
    setSelectedEvent(event);
  };

  const handleMapPinSelected = (coords) => {
    setReportPin(coords);
  };

  const handleOpenReportModal = () => {
    setEditingAction(null);setReportIdentity(actionIdentity);setShowReportModal(true);
  };

  const handleSubmitReport = async (newReport) => {
    const identity=reportIdentity;
    if(!isActionIdentityCurrent(identity))return {error:offline['identity-changed']};
    const result=editingAction?await changeAction(editingAction,'retry',newReport):await addEvent(newReport,identity);
    if(!isActionIdentityCurrent(identity))return {error:offline['identity-changed']};
    if(result?.errorCode)return {error:offline[result.errorCode]||offline['storage-unavailable']};
    setEditingAction(null);setReportPin(null);setSidebarTab('feed');showToast(offline.saved);
    return {success:true};
  };
  const handleVerifyEvent = async(id)=>{
    const identity=actionIdentity,res=await verifyEvent(id,userLocation,identity,events.find(e=>e.id===id));
    if(!isActionIdentityCurrent(identity))return;
    showToast(res?.errorCode?offline[res.errorCode]||offline['storage-unavailable']:res?.alreadyVoted?offline.duplicate:offline.saved);
  };
  const handleResolveEvent = async(id)=>{
    const identity=actionIdentity,res=await resolveEvent(id,identity,events.find(e=>e.id===id));
    if(!isActionIdentityCurrent(identity))return;
    showToast(res?.errorCode?offline[res.errorCode]||offline['storage-unavailable']:res?.alreadyVoted?offline.duplicate:offline.saved);
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    if (selectedEvent && filter !== "All" && selectedEvent.type !== filter) {
      setSelectedEvent(null);
    }
  };

  const handleApplyRoute = (routeData) => {
    if (!routeData) {
      setNavigationRoute(null);
      return;
    }
    setNavigationRoute(routeData);
    if (routeData.hasConflicts) {
      showToast("⚠️ Caution: Navigation corridor intersects reported hazards. Check the route.");
    } else {
      showToast(routeSources.coverage === "current" ? copy.routeClear : copy.routeIncomplete);
    }
  };

  const filteredEvents = events.filter((event) => {
    if (activeFilter === "All") return true;
    return event.type === activeFilter;
  });

  const verifiedPercent =
    events.length > 0
      ? Math.round(
          (events.filter((e) => e.isVerified || (e.verificationCount && e.verificationCount >= 3)).length /
            events.length) *
            100
        )
      : 100;

  return (
    <div className="citypulse-app">
      <Header
        activeEventCount={events.length}
        activeAlertsCount={events.length}
        verifiedPercent={verifiedPercent}
        verifiedPercentage={verifiedPercent}
        weather={weather}
        isLiveConnected={isLiveConnected}
        offlineQueueCount={offlineQueueCount}
      />

      {/* Main split viewport: Map (interactive) + Sidebar (Feed/Helplines/Diagnostic) */}
      <div className="main-content">
        <main className="map-section" role="region" aria-label="Interactive Map">
          <MapContainer
            reportPin={reportPin}
            providerIncidents={publicContext.traffic}
            clock={clock}
            events={filteredEvents}
            selectedEvent={selectedEvent}
            onEventSelect={handleEventSelect}
            onVerifyEvent={handleVerifyEvent}
            onResolveEvent={handleResolveEvent}
            onMapClick={handleMapPinSelected}
            onOpenReportModal={handleOpenReportModal}
            navigationRoute={navigationRoute}
            onClearNavigationRoute={() => setNavigationRoute(null)}
            userLocation={userLocation}
            initialCamera={initialCamera}
          />

          {reportPin && !showReportModal && <div className="map-selection-notice" role="status"><span>{copy.selected}</span><button type="button" onClick={handleOpenReportModal}>{copy.reportHere}</button><button type="button" onClick={()=>setReportPin(null)}>{copy.clear}</button></div>}
          <div className="map-floating-actions floating-action-buttons">
            <button
              type="button"
              className="action-fab report-fab report-trigger-btn"
              onClick={handleOpenReportModal}
              title="Report Civic Hazard"
            >
              <Plus size={17} aria-hidden="true" />
              <span>{copy.report}</span>
            </button>
            <button
              type="button"
              className="action-fab route-fab safe-route-trigger-btn"
              onClick={() => setShowRouteModal(true)}
              title="Plan a route around reported hazards"
            >
              <Route size={17} aria-hidden="true" />
              <span>{copy.plan}</span>
            </button>
            <button
              type="button"
              className="action-fab chatbot-fab chatbot-trigger-btn"
              onClick={() => setShowChatbotModal(true)}
              title="Open NammaDrishti AI Assistant"
            >
              <MessageSquare size={17} aria-hidden="true" />
              <span>{copy.ask}</span>
            </button>
          </div>
        </main>

        <Sidebar
          savedActionsProps={{actions:savedActions,gate:actionGate,storageError,legacy:legacyActions,invalidCount:invalidActionCount,onChange:changeAction,onEdit:action=>{setEditingAction(action);setReportIdentity(actionIdentity);setReportPin(null);setShowReportModal(true);}}}
          actionSessionKey={(actionIdentity?.uid||'')+':'+(actionIdentity?.sessionKey||'')}
          weather={weather}
          onPlan={()=>setShowRouteModal(true)}
          onReport={handleOpenReportModal}
          onFilterChange={handleFilterChange}
          publicContext={publicContext}
          sourceClock={sourceClock}
          traffic={traffic}
          clock={clock}
          events={filteredEvents}
          allEvents={events}
          selectedEvent={selectedEvent}
          onEventSelect={handleEventSelect}
          onVerifyEvent={handleVerifyEvent}
          onResolveEvent={handleResolveEvent}
          activeTab={sidebarTab}
          onTabChange={tab=>{setSidebarTab(tab);if(tab!=='feed')setActiveFilter('All');}}
          activeFilter={activeFilter}
          rainIntensity={weather?.precipitation || 0}
          isWeatherOffline={weather?.isOffline || false}
          userLocation={userLocation}
        />
      </div>

      {/* Citizen Report Modal */}
      {showReportModal&&reportIdentity?.uid===actionIdentity?.uid&&reportIdentity?.sessionKey===actionIdentity?.sessionKey&&isActionIdentityCurrent(reportIdentity)&&(
        <ReportModal
          key={reportIdentity.uid+':'+reportIdentity.sessionKey}
          isOpen={showReportModal}
          onClose={() => {
            setShowReportModal(false);setEditingAction(null);
            setReportPin(null);
          }}
          onSubmitReport={handleSubmitReport}
          requiresFreshObservation={!!editingAction&&(editingAction.reason==='stale'||Date.now()-(editingAction.observedAt??editingAction.createdAt)>MAX_ACTION_AGE_MS)}
          initialReport={editingAction?.payload}
          initialCoordinates={editingAction?.payload.position||reportPin}
        />
      )}

      {/* NammaDrishti Context-Aware AI Chatbot */}
      {showChatbotModal && (
        <ChatbotModal
          isOpen={showChatbotModal}
          onClose={() => setShowChatbotModal(false)}
          events={events}
          currentEvents={events}
          weather={weather}
        />
      )}

      {/* Safe Route Hazard Avoidance Modal */}
      {showRouteModal && (
        <SafeRouteModal
          activeRoute={navigationRoute}
          isOpen={showRouteModal}
          onClose={() => setShowRouteModal(false)}
          hazards={routeSources.hazards}
          coverage={routeSources.coverage}
          activeHazards={routeSources.hazards}
          userLocation={userLocation}
          onApplyRouteToMap={handleApplyRoute}
        />
      )}

      {/* Transient Notification Toast */}
      {toastMessage && (
        <div className="dashboard-toast-notification" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default CityPulseDashboard;
