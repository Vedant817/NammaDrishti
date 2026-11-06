import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
import {useDialog} from './useDialog';
function Fixture({close,label,children}){const ref=useDialog(close);return <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}><button>{label} first</button><button>{label} last</button>{children}</div>;}
test('Escape and Tab still work after asynchronous controls lose keyboard focus',()=>{
 const close=vi.fn();render(<Fixture close={close} label="Fixture"/>);
 fireEvent.keyDown(document.body,{key:'Tab'});expect(screen.getByRole('button',{name:'Fixture first'})).toHaveFocus();
 fireEvent.keyDown(document.body,{key:'Escape'});expect(close).toHaveBeenCalledOnce();
});
test('only the top dialog handles document-level keyboard events',()=>{
 const outer=vi.fn(),inner=vi.fn();render(<Fixture close={outer} label="Outer"><Fixture close={inner} label="Inner"/></Fixture>);
 fireEvent.keyDown(document.body,{key:'Escape'});expect(inner).toHaveBeenCalledOnce();expect(outer).not.toHaveBeenCalled();
});
