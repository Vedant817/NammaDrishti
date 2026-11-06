import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {vi,test,expect} from 'vitest';
import SavedActions from './SavedActions';
import {offlineCopy} from '../../data/offlineCopy';
const report={id:'draft',owner:'A',kind:'report',state:'failed',reason:'rejected',revision:1,nextAt:0,leaseUntil:0,payload:{title:'Fixture road',description:'Retained text'}};
test('failed report has explicit recovery; failed storage mutation keeps its row and shows an error',async()=>{
 const change=vi.fn(async()=>({errorCode:'action-changed'})),edit=vi.fn();render(<SavedActions actions={[report]} onChange={change} onEdit={edit}/>);
 fireEvent.click(screen.getByRole('button',{name:'Edit report'}));expect(edit).toHaveBeenCalledWith(report);
 fireEvent.click(screen.getByRole('button',{name:'Discard'}));expect(await screen.findByRole('alert')).toHaveTextContent('another tab');expect(screen.getByText('Fixture road')).toBeInTheDocument();
});
test('uncertain delivery stays immutable and an active send disables retry/discard',async()=>{
 const view=render(<SavedActions actions={[{...report,state:'pending',uncertain:true}]} onChange={()=>{}} onEdit={()=>{}}/>);
 expect(screen.queryByRole('button',{name:'Edit report'})).not.toBeInTheDocument();expect(screen.getByText(/Delivery is uncertain/)).toBeInTheDocument();
 view.rerender(<SavedActions actions={[{...report,leaseUntil:Date.now()+45000}]} onChange={()=>{}} onEdit={()=>{}}/>);expect(screen.getByRole('button',{name:'Discard'})).toBeDisabled();expect(screen.getByRole('button',{name:'Retry'})).toBeDisabled();
});
test('offline recovery copy has complete language key parity',()=>{
 expect(Object.keys(offlineCopy.kn).sort()).toEqual(Object.keys(offlineCopy.en).sort());expect(Object.keys(offlineCopy.hi).sort()).toEqual(Object.keys(offlineCopy.en).sort());
});
