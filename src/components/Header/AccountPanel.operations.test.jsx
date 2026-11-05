import {render,screen,waitFor,fireEvent} from '@testing-library/react';
import {vi,test,expect} from 'vitest';
vi.mock('../../services/firebaseService',()=>({citizenRole:vi.fn(),authenticatedFetch:vi.fn(),signInCitizen:vi.fn(),signOutCitizen:vi.fn(),resendCitizenVerification:vi.fn()}));
import {citizenRole,authenticatedFetch} from '../../services/firebaseService';
import AccountPanel from './AccountPanel';
test('a failed operations refresh removes the previously healthy backup card and shows an error',async()=>{
 citizenRole.mockResolvedValue({email:'fixture@example.invalid',verified:true,moderator:true});
 let unavailable=false;
 authenticatedFetch.mockImplementation(async url=>String(url).endsWith('/moderation')?{ok:true,json:async()=>({incidents:[],audit:[]})}:unavailable?{ok:false,status:503}:{ok:true,json:async()=>({sources:{},backup:{configured:true,health:'healthy',completedAt:Date.now()}})});
 render(<AccountPanel onClose={()=>{}}/>);
 expect(await screen.findByText('Current verified snapshot')).toBeInTheDocument();
 unavailable=true;fireEvent.click(screen.getByRole('button',{name:/Refresh/i}));
 await waitFor(()=>expect(screen.queryByText('Current verified snapshot')).not.toBeInTheDocument());
 expect(await screen.findByRole('alert')).toBeInTheDocument();
});
