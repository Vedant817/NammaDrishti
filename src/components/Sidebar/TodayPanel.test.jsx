import {render,screen,fireEvent} from '@testing-library/react';
import {vi} from 'vitest';
import TodayPanel from './TodayPanel';
import {simpleCopy} from '../../data/simpleCopy';
test('the everyday view distinguishes unavailable weather from no rain and links to detailed conditions',()=>{
  const clock=Date.now(),onNavigate=vi.fn(),onPlan=vi.fn();
  render(<TodayPanel clock={clock} traffic={{status:'available'}} weather={{observedAt:new Date(clock).toISOString(),precipitationAmountMm:null}} context={{official:{status:'unavailable',alerts:[]}}} events={[]} onNavigate={onNavigate} onPlan={onPlan}/>);
  expect(screen.getByText('Before you head out')).toBeInTheDocument();
  expect(screen.queryByText('No rain in the latest estimate')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:/Plan a trip/}));expect(onPlan).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button',{name:/Official warnings/}));expect(onNavigate).toHaveBeenCalledWith('sources');
});
test('the simple navigation and guidance are translated in all supported languages',()=>{
  for(const lang of ['kn','hi'])expect(Object.keys(simpleCopy[lang]).sort()).toEqual(Object.keys(simpleCopy.en).sort());
});
