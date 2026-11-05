import { vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProximityAlert } from './useProximityAlert';
import { calculateDistance } from '../services/routingService';
vi.mock('../services/routingService', () => ({ calculateDistance: vi.fn() }));

test('approaching the inner geofence speaks once after an earlier outer notification', () => {
  const speak = vi.fn();
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak, cancel: vi.fn() } });
  window.SpeechSynthesisUtterance = function(text) { this.text = text; };
  const hazard = { id: 'flood', type: 'Waterlogging', title: 'Flood', urgency: 'High', position: { lat: 13, lng: 77 } };
  calculateDistance.mockReturnValueOnce(2).mockReturnValueOnce(1).mockReturnValueOnce(0.8);
  const alert = vi.fn();
  const { rerender } = renderHook(({ lat }) => useProximityAlert({ lat, lng: 77 }, [hazard], alert), { initialProps: { lat: 12.9 } });
  expect(alert).toHaveBeenCalledTimes(1);
  expect(speak).not.toHaveBeenCalled();
  rerender({ lat: 12.99 });
  expect(speak).toHaveBeenCalledTimes(1);
  rerender({ lat: 12.999 });
  expect(speak).toHaveBeenCalledTimes(1);
  expect(window.speechSynthesis.cancel).not.toHaveBeenCalled();
});
