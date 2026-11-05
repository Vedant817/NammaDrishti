import {render,screen} from '@testing-library/react';
import SafeRouteModal from './SafeRouteModal';
test('an unavailable route check never renders the no-hazards banner',async()=>{
  render(<SafeRouteModal activeRoute={{status:'unavailable',conflicts:[],distanceKm:2,durationMin:3}} onClose={()=>{}}/>);
  expect(await screen.findByRole('status')).toHaveTextContent('Route unavailable.');
  expect(screen.queryByText('No matching reports or provider incidents near this route.')).not.toBeInTheDocument();
});
