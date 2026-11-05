import {render,screen,fireEvent} from '@testing-library/react';
import PublicSourcesPanel from './PublicSourcesPanel';
test('source failure is not reported as zero live warnings or a clear road',()=>{
  render(<PublicSourcesPanel clock={Date.now()} context={{official:{status:'unavailable',alerts:[]},traffic:{status:'access-denied',incidents:[]}}}/>);
  expect(screen.getByText(/Source unavailable or stale/)).toBeInTheDocument();
  expect(screen.getByText(/Provider denied API access/)).toBeInTheDocument();
  expect(screen.queryByText(/No active records returned/)).not.toBeInTheDocument();
});
test('large road incident feeds are paged and searchable without dropping available results',()=>{
  const clock=Date.now(),incidents=Array.from({length:65},(_,n)=>({id:String(n),category:'Road works',title:`Fixture ${n}`,from:n===64?'Last road':'First road',sourceUrl:'https://www.tomtom.com/',delaySeconds:null,fetchedAt:new Date(clock).toISOString()}));
  render(<PublicSourcesPanel clock={clock} context={{official:{status:'available',fetchedAt:new Date(clock).toISOString(),alerts:[]},traffic:{status:'available',fetchedAt:new Date(clock).toISOString(),incidents}}}/>);
  expect(screen.getAllByText('Locate on map')).toHaveLength(30);
  fireEvent.click(screen.getByText('Show 30 more incidents'));expect(screen.getAllByText('Locate on map')).toHaveLength(60);
  fireEvent.change(screen.getByLabelText('Search road incidents'),{target:{value:'Last road'}});
  expect(screen.getAllByText('Locate on map')).toHaveLength(1);expect(screen.getByText('Fixture 64')).toBeInTheDocument();
});
