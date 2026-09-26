// jest-dom adds custom jest matchers for asserting on DOM nodes.
import '@testing-library/jest-dom';

// Mock Leaflet and React-Leaflet for Jest jsdom environment
jest.mock('leaflet', () => {
  return {
    Icon: {
      Default: {
        prototype: {},
        mergeOptions: jest.fn(),
      },
    },
    divIcon: jest.fn(() => ({})),
  };
});

jest.mock('react-leaflet', () => {
  return {
    MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
    TileLayer: () => <div data-testid="tile-layer" />,
    Marker: ({ children }) => <div data-testid="marker">{children}</div>,
    Popup: ({ children }) => <div data-testid="popup">{children}</div>,
    Polyline: ({ children }) => <div data-testid="polyline">{children}</div>,
    CircleMarker: ({ children }) => <div data-testid="circle-marker">{children}</div>,
    useMap: () => ({
      setView: jest.fn(),
    }),
    useMapEvents: jest.fn(),
  };
});
