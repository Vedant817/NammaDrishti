const {snapshot,envelope,validate,mediaUrls,LIMIT}=require('./backupArchive');
const {backupDue,backupHealth,readBounded}=require('./backupPolicy');
const {gzipSync,gunzipSync}=require('zlib');
const {createHash,randomUUID}=require('crypto');
const PREFIX='backups/v2/';
function createBackupService({db,blob=require('@vercel/blob'),token=process.env.BACKUP_READ_WRITE_TOKEN,mediaToken=process.env.BLOB_READ_WRITE_TOKEN,mediaHost=process.env.MEDIA_BLOB_HOST,clock=Date.now,prefix=PREFIX}={}) {
  const configured=Boolean(db&&token&&mediaToken&&mediaHost);
  async function capture() {
    if(!mediaHost || !/^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/.test(mediaHost)) throw new Error('Managed media host required');
    const payload=await snapshot(db),wanted=new Set(mediaUrls(payload)),media=[];
    let total=0,cursor;
    do {
      const page=await blob.list({token:mediaToken,prefix:'hazards/',limit:1000,cursor});
      for(const item of page.blobs) {
        if(!wanted.has(item.url)) continue;
        if(new URL(item.url).hostname!==mediaHost) throw new Error('Managed media host mismatch');
        const response=await fetch(item.url,{signal:AbortSignal.timeout(10000),redirect:'error'});
        if(!response.ok) { await response.body?.cancel(); throw new Error('Referenced photo unavailable'); }
        const bytes=await readBounded(response.body,Math.min(2*1024*1024,LIMIT-total));
        total+=bytes.length;
        media.push({url:item.url,base64:bytes.toString('base64'),hash:createHash('sha256').update(bytes).digest('hex'),byteSize:bytes.length});
        wanted.delete(item.url);
      }
      cursor=page.hasMore?page.cursor:undefined;
    } while(cursor);
    const managedMissing=[...wanted].filter(u=>{try{return new URL(u).hostname===mediaHost;}catch{return false;}});
    if(managedMissing.length) throw new Error('Referenced managed photo missing from media store');
    const archive=envelope(payload,media);archive.externalMediaLinks=wanted.size;return archive;
  }
  async function prune(latestUrl, now) {
    let cursor;
    do {
      const page=await blob.list({token,prefix,limit:1000,cursor});
      const expired=page.blobs.filter(i=>i.url!==latestUrl&&Date.parse(i.uploadedAt)<now-7*86400000);
      if(expired.length) await blob.del(expired.map(i=>i.url),{token});
      cursor=page.hasMore?page.cursor:undefined;
    } while(cursor);
  }
  async function run({force=false,trigger='manual'}={}) {
    if(!configured) return {status:'unconfigured'};
    if(!['manual','maintenance','opportunistic'].includes(trigger)) throw new Error('Invalid backup trigger');
    const owner=randomUUID(),now=clock(),ref=db.collection('_coordination').doc('dailyBackup');
    const claim=await db.runTransaction(async tx=>{
      const state=(await tx.get(ref)).data()||{};
      const maintenance=trigger==='maintenance'?{lastMaintenanceAt:now}:{};
      if(state.leaseUntil>now) {
        if(trigger==='maintenance') tx.set(ref,{...state,...maintenance,lastMaintenanceOutcome:'busy'});
        return {status:'busy'};
      }
      if(!force&&state.nextAttemptAt>now) {
        if(trigger==='maintenance')tx.set(ref,{...state,...maintenance,lastMaintenanceOutcome:'backoff'});
        return {status:'backoff'};
      }
      if(!force&&!backupDue(state,now)) {
        const needsRetention=!(state.retentionLeaseUntil>now)&&!(state.nextRetentionAt>now);
        if(needsRetention||trigger==='maintenance')tx.set(ref,{...state,...maintenance,...(trigger==='maintenance'?{lastMaintenanceOutcome:'fresh'}:{}),...(needsRetention?{retentionOwner:owner,retentionLeaseUntil:now+300000,nextRetentionAt:now+900000}:{})});
        return {status:'fresh',latestUrl:state.url,needsRetention};
      }
      tx.set(ref,{...state,...maintenance,owner,leaseUntil:now+300000,status:'running',lastAttemptAt:now,lastAttemptTrigger:trigger});
      return {status:'claimed'};
    });
    if(claim.status==='backoff') return {status:'skipped',reason:'retry-delayed'};
    if(claim.status==='busy') return {status:'skipped',reason:'busy'};
    if(claim.status==='fresh') {
      if(claim.needsRetention) {
        let retentionStatus='complete';
        try { await prune(claim.latestUrl,now); } catch { retentionStatus='failed'; }
        await db.runTransaction(async tx=>{
          const current=(await tx.get(ref)).data();
          if(current?.url===claim.latestUrl&&current.retentionOwner===owner)tx.set(ref,{...current,retentionStatus,retentionLeaseUntil:0,lastRetentionAt:clock(),nextRetentionAt:clock()+(retentionStatus==='complete'?20*3600000:900000)});
        });
      }
      return {status:'skipped',reason:'fresh'};
    }
    let object,archivePath,committed=false,publicationAttempted=false;
    async function clearPending(pathname) {
      const current=(await ref.get()).data()||{};
      const page=await blob.list({token,prefix:pathname,limit:1000});
      const urls=page.blobs.filter(item=>item.pathname===pathname&&item.url!==current.url).map(item=>item.url);
      if(urls.length)await blob.del(urls,{token});
      await db.runTransaction(async tx=>{const state=(await tx.get(ref)).data()||{};tx.set(ref,{...state,pendingUploads:(state.pendingUploads||[]).filter(item=>item.path!==pathname)});});
    }
    try {
      // Reconcile abandoned uploads only after twice the maximum request/lease duration.
      const previous=(await ref.get()).data()||{};
      for(const entry of previous.pendingUploads||[])if(entry.at<clock()-600000)await clearPending(entry.path);
      const archive=await capture(),bytes=gzipSync(Buffer.from(JSON.stringify(archive)));
      if(bytes.length>LIMIT*1.5) throw new Error('Backup budget exceeded');
      archivePath=prefix+new Date(now).toISOString().replace(/[:.]/g,'-')+'-'+owner+'.json.gz';
      await db.runTransaction(async tx=>{
        const state=(await tx.get(ref)).data();
        if(state?.owner!==owner||state.leaseUntil<=clock())throw new Error('Backup lease lost');
        if((state.pendingUploads||[]).length>=100)throw new Error('Pending backup cleanup required');
        tx.set(ref,{...state,pendingUploads:[...(state.pendingUploads||[]),{path:archivePath,at:clock()}]});
      });
      object=await blob.put(archivePath,bytes,{access:'private',token,addRandomSuffix:false,allowOverwrite:false,contentType:'application/gzip'});
      const read=await blob.get(object.url,{access:'private',token,useCache:false});
      if(!read||read.statusCode!==200) throw new Error('Backup verification failed');
      const verified=JSON.parse(gunzipSync(await readBounded(read.stream,LIMIT*1.5),{maxOutputLength:LIMIT*3}).toString('utf8'));
      validate(verified);
      if(verified.digest!==archive.digest||verified.mediaDigest!==archive.mediaDigest) throw new Error('Backup verification mismatch');
      publicationAttempted=true;
      await db.runTransaction(async tx=>{
        const current=(await tx.get(ref)).data();
        if(current?.owner!==owner || current.leaseUntil<=clock()) throw new Error('Backup lease lost');
        tx.set(ref,{...current,leaseUntil:0,status:'complete',completedAt:clock(),lastCompletedTrigger:trigger,cleanupStatus:'complete',nextAttemptAt:0,pendingUploads:(current.pendingUploads||[]).filter(item=>item.path!==archivePath),url:object.url,records:Object.values(archive.payload).reduce((n,g)=>n+g.length,0),media:archive.media.length,bytes:bytes.length,externalMediaLinks:archive.externalMediaLinks,retentionStatus:'pending',retentionOwner:owner,retentionLeaseUntil:clock()+300000,nextRetentionAt:clock()+900000,...(trigger==='maintenance'?{lastMaintenanceOutcome:'complete'}:{})});
      });
      committed=true;
      let retentionStatus='complete';
      try { await prune(object.url,now); } catch { retentionStatus='failed'; }
      await db.runTransaction(async tx=>{const current=(await tx.get(ref)).data();if(current?.url===object.url&&current.retentionOwner===owner)tx.set(ref,{...current,retentionStatus,retentionLeaseUntil:0,lastRetentionAt:clock(),nextRetentionAt:clock()+(retentionStatus==='complete'?20*3600000:900000)});});
      return {status:'complete',records:Object.values(archive.payload).reduce((n,g)=>n+g.length,0),media:archive.media.length,retentionStatus};
    } catch(error) {
      if(publicationAttempted&&!committed) {
        // A failed RPC does not establish that the commit failed. Keep all bytes
        // until authoritative state or delayed reconciliation establishes ownership.
        let current;
        try { current=(await ref.get()).data(); } catch { throw error; }
        if(current?.url===object?.url&&current.status==='complete')return {status:'complete',records:current.records,media:current.media,retentionStatus:current.retentionStatus};
        throw error;
      }
      let cleanupStatus='complete';
      if(archivePath&&!committed) { try { if(object)await blob.del(object.url,{token});await clearPending(archivePath); } catch {cleanupStatus='failed';} }
      if(!committed) await db.runTransaction(async tx=>{
        const current=(await tx.get(ref)).data();
        if(current?.owner===owner) tx.set(ref,{...current,leaseUntil:0,status:'failed',failedAt:clock(),nextAttemptAt:clock()+900000,cleanupStatus,...(trigger==='maintenance'?{lastMaintenanceOutcome:'failed'}:{})});
      });
      throw error;
    }
  }
  return {configured,capture,run,async status(){
    if(!configured) return {configured:false,health:'unconfigured'};
    const state=(await db.collection('_coordination').doc('dailyBackup').get()).data()||{};
    return {configured:true,status:state.status||'pending',health:backupHealth(state,clock()),completedAt:state.completedAt||null,lastAttemptAt:state.lastAttemptAt||null,lastAttemptTrigger:state.lastAttemptTrigger||null,lastCompletedTrigger:state.lastCompletedTrigger||null,lastMaintenanceAt:state.lastMaintenanceAt||null,lastMaintenanceOutcome:state.lastMaintenanceOutcome||null,retentionStatus:state.retentionStatus||'unknown',cleanupStatus:state.cleanupStatus||'unknown',pendingUploads:(state.pendingUploads||[]).length,nextAttemptAt:state.nextAttemptAt||null,records:state.records??null,media:state.media??null};
  }};
}
module.exports={createBackupService};
