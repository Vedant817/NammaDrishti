import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {vi,test,expect} from 'vitest';
import ReportModal from './ReportModal';
test('waterlogging reports do not invent water depth or passability by default',async()=>{
 const submit=vi.fn().mockResolvedValue({success:true});
 render(<ReportModal isOpen={true} onClose={()=>{}} onSubmitReport={submit} initialCoordinates={{lat:12.97,lng:77.59}}/>);
 fireEvent.click(screen.getByRole('button',{name:'Waterlogging'}));
 expect(screen.getByLabelText('Observed water depth (optional)')).toHaveValue('');
 expect(screen.getByLabelText('What vehicles could pass? (optional)')).toHaveValue('');
 fireEvent.change(document.querySelector('#report-title'),{target:{value:'Water on the road'}});
 fireEvent.change(document.querySelector('#report-desc'),{target:{value:'Water seen; depth could not be measured safely.'}});
 fireEvent.submit(document.querySelector('form'));
 await waitFor(()=>expect(submit).toHaveBeenCalled());
 expect(submit.mock.calls[0][0]).toMatchObject({waterDepth:null,vehiclePassability:null});
});
