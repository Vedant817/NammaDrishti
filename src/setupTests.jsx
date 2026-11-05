import { vi } from 'vitest';
// jest-dom adds custom jest matchers for asserting on DOM nodes.
import '@testing-library/jest-dom/vitest';

// Mock Leaflet and React-Leaflet for Jest jsdom environment
vi.mock('leaflet', () => ({ default: { Icon: { Default: { prototype: {}, mergeOptions: vi.fn() } }, divIcon: vi.fn(() => ({})) } }));

vi.mock('react-leaflet', () => {
  return {
    MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
    TileLayer: () => <div data-testid="tile-layer" />,
    Marker: ({ children }) => <div data-testid="marker">{children}</div>,
    Popup: ({ children }) => <div data-testid="popup">{children}</div>,
    Polyline: ({ children }) => <div data-testid="polyline">{children}</div>,
    CircleMarker: ({ children }) => <div data-testid="circle-marker">{children}</div>,
    useMap: () => ({
      setView: vi.fn(),
    }),
    useMapEvents: vi.fn(),
  };
});

window.fetch = vi.fn(async () => ({ok:true,json:async()=>({results:[],segments:[],status:"unconfigured",observations:[]})}));
