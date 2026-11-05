import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import TrafficPanel from './TrafficPanel';
test('speed samples remain separate from report counts and stale readings are not shown as current', () => {
  const onSelectLocation = vi.fn(), onOverview = vi.fn(), clock = Date.now();
  render(<TrafficPanel clock={clock} onSelectLocation={onSelectLocation} onOverview={onOverview} traffic={{ status: 'available', segments: [
    {id:'silk',name:'Silk Board',lat:12.9171,lng:77.6238,currentSpeed:17,freeFlowSpeed:40,confidence:.9,fetchedAt:new Date(clock).toISOString()},
    {id:'old',name:'Old reading',lat:13,lng:77.6,currentSpeed:99,fetchedAt:new Date(clock-180001).toISOString()}
  ]}}/>);
  expect(screen.getByText('17 km/h')).toBeInTheDocument();
  expect(screen.queryByText('99 km/h')).not.toBeInTheDocument();
  expect(screen.getByText('Update unavailable')).toBeInTheDocument();
  fireEvent.click(screen.getAllByText('Locate on map')[0]);
  expect(onSelectLocation).toHaveBeenCalledWith(expect.objectContaining({id:'traffic_silk',position:{lat:12.9171,lng:77.6238}}));
  fireEvent.click(screen.getByText('Open weather overview')); expect(onOverview).toHaveBeenCalledOnce();
});
