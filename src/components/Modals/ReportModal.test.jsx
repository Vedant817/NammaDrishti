import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {vi,test,expect} from 'vitest';
vi.mock('../../utils/imageOptimizer',()=>({compressImage:vi.fn()}));
import {compressImage} from '../../utils/imageOptimizer';
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

test('failed durable save retains fields and photo, and retries the same report ID',async()=>{
 const submit=vi.fn().mockResolvedValue({error:'Device storage unavailable'}),close=vi.fn();
 render(<ReportModal isOpen onClose={close} onSubmitReport={submit} initialCoordinates={{lat:12.97,lng:77.59}} initialReport={{title:'Retain me',description:'Retain this note',mediaUrl:'data:image/png;base64,fixture'}}/>);
 fireEvent.submit(document.querySelector('form'));await screen.findByRole('alert');expect(close).not.toHaveBeenCalled();expect(document.querySelector('#report-title')).toHaveValue('Retain me');expect(screen.getByAltText('Photo attached')).toHaveAttribute('src','data:image/png;base64,fixture');
 fireEvent.submit(document.querySelector('form'));await waitFor(()=>expect(submit).toHaveBeenCalledTimes(2));expect(submit.mock.calls[0][0].id).toBe(submit.mock.calls[1][0].id);
 fireEvent.click(screen.getByRole('button',{name:'Remove photo'}));expect(screen.queryByAltText('Photo attached')).not.toBeInTheDocument();
});
test('a failed photo replacement is visible and keeps the original attachment available',async()=>{
 compressImage.mockRejectedValue(new Error('unreadable'));render(<ReportModal isOpen onClose={()=>{}} onSubmitReport={()=>{}} initialReport={{mediaUrl:'data:original'}}/>);
 fireEvent.change(document.querySelector('#report-photo'),{target:{files:[new File(['invalid'],'bad.png',{type:'image/png'})]}});
 expect(await screen.findByRole('alert')).toHaveTextContent('This photo could not be read');expect(screen.getByAltText('Photo attached')).toHaveAttribute('src','data:original');
});
test('newer photo selection wins when compression finishes out of order',async()=>{
 let older,newer;compressImage.mockImplementationOnce(()=>new Promise(resolve=>{older=resolve;})).mockImplementationOnce(()=>new Promise(resolve=>{newer=resolve;}));
 render(<ReportModal isOpen onClose={()=>{}} onSubmitReport={()=>{}}/>);const input=document.querySelector('#report-photo');
 fireEvent.change(input,{target:{files:[new File(['A'],'a.png')]}});fireEvent.change(input,{target:{files:[new File(['B'],'b.png')]}});
 newer({dataUrl:'data:newer'});await waitFor(()=>expect(screen.getByAltText('Photo attached')).toHaveAttribute('src','data:newer'));older({dataUrl:'data:older'});await waitFor(()=>expect(screen.getByAltText('Photo attached')).toHaveAttribute('src','data:newer'));
});
test('over-limit restored fields explain validation without discarding the draft',async()=>{
 const submit=vi.fn();render(<ReportModal isOpen onClose={()=>{}} onSubmitReport={submit} initialReport={{title:'x'.repeat(201),description:'Kept note'}}/>);
 fireEvent.submit(document.querySelector('form'));expect(await screen.findByRole('alert')).toHaveTextContent('200 characters');expect(submit).not.toHaveBeenCalled();expect(document.querySelector('#report-title')).toHaveValue('x'.repeat(201));
});
test('fresh review requires an explicit new observation before resubmitting an aged report',async()=>{
 const submit=vi.fn().mockResolvedValue({success:true});render(<ReportModal isOpen onClose={()=>{}} onSubmitReport={submit} requiresFreshObservation initialCoordinates={{lat:12.97,lng:77.59}} initialReport={{id:'stable',title:'Checked again',description:'Current conditions'}}/>);
 fireEvent.submit(document.querySelector('form'));expect(await screen.findByRole('alert')).toHaveTextContent('Recheck the location');expect(submit).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.submit(document.querySelector('form'));await waitFor(()=>expect(submit).toHaveBeenCalledWith(expect.objectContaining({id:'stable',confirmedFreshObservation:true})));
});
