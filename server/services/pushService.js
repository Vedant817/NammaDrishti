const webpush=require('web-push');
const {createHash,randomUUID}=require('crypto');
const PROVIDERS=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','wns2-db5p.notify.windows.com'];
function validSubscription(value) {
  try { const u=new URL(value.endpoint); return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&PROVIDERS.some(h=>u.hostname===h||u.hostname.endsWith('.'+h))&&value.endpoint.length<2048&&/^[A-Za-z0-9_-]{87}$/.test(value.keys.p256dh)&&/^[A-Za-z0-9_-]{22}$/.test(value.keys.auth); }catch{return false;}
}
function createPushService(records) {
  const configured=Boolean(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT);
  if(configured)webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
  let processing=false;const owner=randomUUID();
  return {configured,
    async subscribe(uid,subscription,position) {
      if(!configured)throw new Error('Push is not configured');
      if(!validSubscription(subscription))throw new Error('Unsupported push subscription');
      const id=createHash('sha256').update(subscription.endpoint).digest('hex');
      const existing=await records.get('pushSubscriptions',id);
      if(existing&&existing.uid!==uid)throw new Error('Subscription belongs to another account');
      const subscriptions=await records.list('pushSubscriptions');
      if(subscriptions.filter(s=>s.uid===uid).length>=3&&!existing)throw new Error('Subscription limit reached');
      await records.put('pushSubscriptions',id,{id,uid,subscription,position,updatedAt:Date.now()});return id;
    },
    async enqueue(incident) {
      if(!configured||incident.urgency!=='High')return;
      for(const sub of await records.list('pushSubscriptions')) {
        if(Date.now()-sub.updatedAt>30*86400000){await records.remove('pushSubscriptions',sub.id);continue;}
        const a=sub.position,b=incident.position;
        const km=Math.hypot((a.lat-b.lat)*111,(a.lng-b.lng)*108);
        if(km>2.5)continue;
        const id=createHash('sha256').update(`${incident.id}:${sub.id}`).digest('hex');
        if(!await records.get('pushOutbox',id))await records.put('pushOutbox',id,{id,subscriptionId:sub.id,incidentId:incident.id,status:'queued',attempts:0,leaseUntil:0,createdAt:Date.now()});
      }
    },
    async process(activeIncidents) {
      if(!configured||processing)return;processing=true;
      try {for(const job of await records.list('pushOutbox')) {
        if(Date.now()-job.createdAt>86400000){await records.remove('pushOutbox',job.id);continue;}
        if(job.status!=='queued'||job.nextAt>Date.now())continue;
        const item=activeIncidents.find(i=>i.id===job.incidentId&&!i.moderationHidden);
        if(!item){await records.remove('pushOutbox',job.id);continue;}
        const claim=await records.claim('pushOutbox',job.id,owner,Date.now(),['queued']);if(!claim)continue;
        const sub=await records.get('pushSubscriptions',job.subscriptionId);
        if(!sub){await records.remove('pushOutbox',job.id);continue;}
        try {
          // Lock-screen privacy: no precise location, report text or personal data.
          await webpush.sendNotification(sub.subscription,JSON.stringify({title:'NammaDrishti',body:'A high urgency road hazard was reported near your saved area.',url:`/?incident=${encodeURIComponent(item.id)}`}),{TTL:300,timeout:7000});
          await records.put('pushOutbox',job.id,{...claim,status:'sent',leaseUntil:0});
        }catch(e){
          if(e.statusCode===404||e.statusCode===410)await records.remove('pushSubscriptions',sub.id);
          await records.put('pushOutbox',job.id,{...claim,status:claim.attempts>=4?'failed':'queued',attempts:claim.attempts+1,nextAt:Date.now()+60000,leaseUntil:0});
        }
      }}finally{processing=false;}
    }
  };
}
module.exports={createPushService,validSubscription};
