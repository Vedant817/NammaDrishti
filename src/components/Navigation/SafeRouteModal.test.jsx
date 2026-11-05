import {render,screen} from '@testing-library/react';
import SafeRouteModal from './SafeRouteModal';
test('an unavailable route check never renders the no-hazards banner',async()=>{
  render(<SafeRouteModal activeRoute={{status:'unavailable',conflicts:[],distanceKm:2,durationMin:3}} onClose={()=>{}}/>);
  expect(await screen.findByRole('status')).toHaveTextContent('Previous results may be outdated');
  expect(screen.queryByText('No reported hazards nearby')).not.toBeInTheDocument();
});
