import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import AccountPanel from './AccountPanel';
import { citizenRole, signInCitizen } from '../../services/firebaseService';
vi.mock('../../services/firebaseService',()=>({subscribeActionIdentity:vi.fn(listener=>{listener({uid:'fixture',sessionKey:1});return()=>{};}),actionIdentitySnapshot:vi.fn(()=>({uid:'fixture',sessionKey:1})),isActionIdentityCurrent:vi.fn(()=>true),citizenRole:vi.fn(),signInCitizen:vi.fn(),signOutCitizen:vi.fn(),resendCitizenVerification:vi.fn(),authenticatedFetch:vi.fn()}));
beforeEach(()=>{citizenRole.mockResolvedValue(null);signInCitizen.mockResolvedValue({});});
test('account creation uses labelled fields, a dedicated mode and verification feedback',async()=>{
  render(<AccountPanel onClose={()=>{}}/>);
  expect(screen.getByRole('dialog',{name:'Citizen account'})).toBeInTheDocument();
  await waitFor(()=>expect(screen.getAllByRole('button',{name:'Sign in'}).at(-1)).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'Create an account'}));
  fireEvent.change(screen.getByLabelText('Email'),{target:{value:'citizen@example.com'}});
  fireEvent.change(screen.getByLabelText('Password'),{target:{value:'fixture-password'}});
  citizenRole.mockResolvedValue({email:'citizen@example.com',verified:false});
  fireEvent.click(screen.getAllByRole('button',{name:'Create an account'}).at(-1));
  await waitFor(()=>expect(signInCitizen).toHaveBeenCalledWith('citizen@example.com','fixture-password',true));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Resend verification email'})).toBeInTheDocument());
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
});
