import { useEffect, useState } from 'react';
import { API_BASE } from '../services/api';
export function usePublicContext() {
  const [context,setContext]=useState({official:{status:'loading',alerts:[]},traffic:{status:'loading',incidents:[]}});
  const [clock,setClock]=useState(Date.now());
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    async function read(path,key) {
      try {
        const response=await fetch(`${API_BASE}/${path}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(14000)])});
        if(!response.ok)throw new Error();
        const data=await response.json();
        if(!Array.isArray(data[key==='official'?'alerts':'incidents']))throw new Error();
        if(active)setContext(prev=>({...prev,[key]:data}));
      }catch{if(active)setContext(prev=>({...prev,[key]:{status:'unavailable',alerts:[],incidents:[]}}));}
    }
    function refresh(){read('official-alerts','official');read('traffic-incidents','traffic');}
    const resume=()=>{if(document.visibilityState==='visible'){setClock(Date.now());refresh();}};
    document.addEventListener('visibilitychange',resume);
    refresh();const timer=setInterval(refresh,60000),age=setInterval(()=>setClock(Date.now()),15000);
    return()=>{document.removeEventListener('visibilitychange',resume);active=false;controller.abort();clearInterval(timer);clearInterval(age);};
  },[]);
  return {context,clock};
}
