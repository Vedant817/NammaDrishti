const {randomUUID}=require('crypto');
function createEmergencyOutbox(records,{fetcher=fetch,now=Date.now,webhook=process.env.EMERGENCY_DISPATCH_WEBHOOK_URL}={}) {
  const owner=randomUUID();let running=false;
  return {
    async enqueue(lat,lng,uid) {
      const event={id:`sos_${randomUUID()}`,lat,lng,uid:uid||null,timestamp:new Date(now()).toISOString(),status:webhook?'QUEUED':'LOCATION_RECORDED',attempts:0,nextAttemptAt:now(),leaseUntil:0};
      await records.put('emergencyOutbox',event.id,event);return event;
    },
    async process() {
      if(running)return;running=true;
      try {
        for(const item of await records.list('emergencyOutbox')) {
          if(now()-Date.parse(item.timestamp)>86400000){await records.remove('emergencyOutbox',item.id);continue;}
          if(!webhook||!['QUEUED','RETRYING'].includes(item.status)||item.nextAttemptAt>now())continue;
          const claim=await records.claim('emergencyOutbox',item.id,owner,now(),['QUEUED','RETRYING']);if(!claim)continue;
          const next={...claim,attempts:claim.attempts+1};
          try {
            const response=await fetcher(webhook,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':item.id,...(process.env.EMERGENCY_WEBHOOK_TOKEN?{Authorization:`Bearer ${process.env.EMERGENCY_WEBHOOK_TOKEN}`}:{})},body:JSON.stringify({id:item.id,lat:item.lat,lng:item.lng,timestamp:item.timestamp}),signal:AbortSignal.timeout(7000)});
            if(!response.ok)throw new Error('Recipient unavailable');
            const ack=await response.json();
            if(ack.acknowledged!==true||ack.dispatchId!==item.id)throw new Error('Recipient did not acknowledge dispatch ID');
            next.status='ACKNOWLEDGED_BY_OPERATOR';next.acknowledgedAt=new Date(now()).toISOString();
          }catch {next.status=next.attempts>=5?'FAILED':'RETRYING';next.nextAttemptAt=now()+Math.min(300000,10000*2**next.attempts);}
          next.leaseUntil=0;await records.put('emergencyOutbox',item.id,next);
        }
      } finally {running=false;}
    }
  };
}
module.exports={createEmergencyOutbox};
