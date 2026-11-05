const {snapshot,envelope,validate,mediaUrls,LIMIT}=require('./backupArchive');
const {gzipSync,gunzipSync}=require('zlib');
const {createHash,randomUUID}=require('crypto');
const PREFIX='backups/v2/';
function createBackupService({db,blob=require('@vercel/blob'),token=process.env.BACKUP_READ_WRITE_TOKEN,mediaToken=process.env.BLOB_READ_WRITE_TOKEN,mediaHost=process.env.MEDIA_BLOB_HOST,clock=Date.now,prefix=PREFIX}={}) {
 const configured=Boolean(db&&token&&mediaToken&&mediaHost);
 async function capture(){
  if(!mediaHost || !/^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/.test(mediaHost))throw new Error('Managed media host required');
  const payload=await snapshot(db),wanted=new Set(mediaUrls(payload)),media=[];let total=0,cursor;
  do{const page=await blob.list({token:mediaToken,prefix:'hazards/',limit:1000,cursor});for(const item of page.blobs){if(!wanted.has(item.url))continue;const response=await fetch(item.url,{signal:AbortSignal.timeout(10000),redirect:'error'});const result={statusCode:response.status,stream:response.body};if(result.statusCode!==200)throw new Error('Referenced photo unavailable');const chunks=[];let size=0;for await(const chunk of result.stream){size+=chunk.length;total+=chunk.length;if(size>2*1024*1024||total>LIMIT)throw new Error('Backup media budget exceeded');chunks.push(Buffer.from(chunk));}const bytes=Buffer.concat(chunks);media.push({url:item.url,base64:bytes.toString('base64'),hash:createHash('sha256').update(bytes).digest('hex'),byteSize:size});wanted.delete(item.url);}cursor=page.hasMore?page.cursor:undefined;}while(cursor);
  // Other origins are external links, never fetch arbitrary URLs from report text.
  const managedMissing=[...wanted].filter(u=>{try{return new URL(u).hostname===mediaHost;}catch{return false;}});
  if(managedMissing.length)throw new Error('Referenced managed photo missing from media store');
  const archive=envelope(payload,media);archive.externalMediaLinks=wanted.size;return archive;
 }
 async function run({force=false}={}){
  if(!configured)return {status:'unconfigured'};
  const owner=randomUUID(),now=clock(),ref=db.collection('_coordination').doc('dailyBackup');
  const claimed=await db.runTransaction(async tx=>{const state=(await tx.get(ref)).data()||{};if(state.leaseUntil>now||(!force&&state.completedAt&&now-state.completedAt<20*3600000))return false;tx.set(ref,{...state,owner,leaseUntil:now+300000,status:'running'});return true;});
  if(!claimed)return {status:'skipped'};
  try{
   const archive=await capture(),bytes=gzipSync(Buffer.from(JSON.stringify(archive)));
   if(bytes.length>LIMIT*1.5)throw new Error('Backup budget exceeded');
   const object=await blob.put(prefix+new Date(now).toISOString().replace(/[:.]/g,'-')+'.json.gz',bytes,{access:'private',token,addRandomSuffix:true,allowOverwrite:false,contentType:'application/gzip'});
   // Re-read the private object before recording success.
   const read=await blob.get(object.url,{access:'private',token,useCache:false}).catch(error=>{throw new Error('Archive readback: '+error.message);});if(!read||read.statusCode!==200)throw new Error('Backup verification failed');
   const verified=JSON.parse(gunzipSync(Buffer.from(await new Response(read.stream).arrayBuffer()),{maxOutputLength:LIMIT*3}).toString('utf8'));validate(verified);
   if(verified.digest!==archive.digest||verified.mediaDigest!==archive.mediaDigest)throw new Error('Backup verification mismatch');
   const state={owner,leaseUntil:0,status:'complete',completedAt:clock(),url:object.url,records:Object.values(archive.payload).reduce((n,g)=>n+g.length,0),media:archive.media.length,bytes:bytes.length,externalMediaLinks:archive.externalMediaLinks};
   await db.runTransaction(async tx=>{const current=(await tx.get(ref)).data();if(current?.owner!==owner)throw new Error('Backup lease lost');tx.set(ref,state);});
   let cursor;do{const page=await blob.list({token,prefix,limit:1000,cursor});const expired=page.blobs.filter(i=>i.url!==object.url&&Date.parse(i.uploadedAt)<now-7*86400000);if(expired.length)await blob.del(expired.map(i=>i.url),{token});cursor=page.hasMore?page.cursor:undefined;}while(cursor);
   return {status:'complete',records:state.records,media:state.media};
  }catch(error){await db.runTransaction(async tx=>{const current=(await tx.get(ref)).data();if(current?.owner===owner)tx.set(ref,{...current,leaseUntil:0,status:'failed',failedAt:clock()});});throw error;}
 }
 return {configured,capture,run,async status(){if(!configured)return {configured:false};const state=(await db.collection('_coordination').doc('dailyBackup').get()).data()||{};return {configured:true,status:state.status||'pending',completedAt:state.completedAt||null,records:state.records??null,media:state.media??null};}};
}
module.exports={createBackupService};
