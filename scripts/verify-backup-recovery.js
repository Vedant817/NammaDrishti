// Live isolated Firestore + public-photo + private-backup drill. Never replays jobs.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict');
const serverRequire=require('module').createRequire(path.join(__dirname,'../server/package.json'));
const {randomUUID}=require('crypto'),{gunzipSync}=require('zlib');
const {initializeApp,applicationDefault,deleteApp}=serverRequire('firebase-admin/app');
const {getFirestore}=serverRequire('firebase-admin/firestore');
const blob=serverRequire('@vercel/blob');
const {createBackupService}=require('../server/services/backupService');
const {groups,restoreLocal,validate,digest}=require('../server/services/backupArchive');
const {publicIncident}=require('../server/services/publicIncident');
async function main(){
 if(!process.env.FIREBASE_PROJECT_ID||!process.env.BACKUP_READ_WRITE_TOKEN||!process.env.BLOB_READ_WRITE_TOKEN||!process.env.MEDIA_BLOB_HOST)throw new Error('Project, private backup token, media token and managed media host required');
 const app=initializeApp({projectId:process.env.FIREBASE_PROJECT_ID,credential:applicationDefault()},'recovery-drill-'+randomUUID());
 const db=getFirestore(app),prefix='recovery_'+randomUUID().replace(/-/g,'')+'_',directory=fs.mkdtempSync(path.join(os.tmpdir(),'nd-hosted-recovery-'));
 const scoped={collection:name=>db.collection(prefix+name),runTransaction:db.runTransaction.bind(db)};
 let photo,restoredPhoto,backupUrl;
 try{
  const bytes=await serverRequire('sharp')({create:{width:1,height:1,channels:3,background:'#176582'}}).webp().toBuffer();
  photo=await blob.put('hazards/recovery-drill.webp',bytes,{access:'public',token:process.env.BLOB_READ_WRITE_TOKEN,addRandomSuffix:true});
  await scoped.collection('incidents').doc('fixture_1').set({id:'fixture_1',type:'Infrastructure',title:'Isolated recovery fixture',position:{lat:12.97,lng:77.59},createdAt:new Date().toISOString(),mediaUrl:photo.url});
  await scoped.collection('emergencyOutbox').doc('fixture_sos').set({id:'fixture_sos',uid:'fixture',status:'QUEUED'});
  const service=createBackupService({db:scoped,prefix:'drills/'+prefix+'/'});
  assert.equal((await service.run()).status,'complete');
  backupUrl=(await scoped.collection('_coordination').doc('dailyBackup').get()).data().url;
  const anonymous=await fetch(backupUrl,{signal:AbortSignal.timeout(10000)});assert.ok([401,403,404].includes(anonymous.status));await anonymous.body?.cancel();
  const stored=await blob.get(backupUrl,{access:'private',token:process.env.BACKUP_READ_WRITE_TOKEN,useCache:false});
  const archive=JSON.parse(gunzipSync(Buffer.from(await new Response(stored.stream).arrayBuffer())).toString());validate(archive);
  assert.equal(archive.media.length,1);assert.equal(archive.media[0].hash,digest(bytes));
  const restored=restoreLocal(archive,path.join(directory,'restored'));assert.deepEqual(restored,{records:2,media:1});
  assert.deepEqual(fs.readFileSync(path.join(directory,'restored/media',digest(bytes)+'.webp')),bytes);
  // Restore photo bytes into a new immutable Blob, then rebind recovered records.
  restoredPhoto=await blob.put('hazards/recovery-restored.webp',Buffer.from(archive.media[0].base64,'base64'),{access:'public',token:process.env.BLOB_READ_WRITE_TOKEN,addRandomSuffix:true});
  const recoveredPhoto=await fetch(restoredPhoto.url,{signal:AbortSignal.timeout(10000)});assert.equal(recoveredPhoto.status,200);assert.equal(digest(Buffer.from(await recoveredPhoto.arrayBuffer())),digest(bytes));
  archive.payload.incidents[0].mediaUrl=restoredPhoto.url;
  // Restore to separate collections, including the same public projection. No server points at them.
  for(const group of groups){const batch=db.batch();for(const record of archive.payload[group]){batch.set(db.collection(prefix+'restored_'+group).doc(record.id),record);if(group==='incidents')batch.set(db.collection(prefix+'restored_publicIncidents').doc(record.id),publicIncident(record));}await batch.commit();}
  assert.equal((await db.collection(prefix+'restored_incidents').doc('fixture_1').get()).data().mediaUrl,restoredPhoto.url);
  assert.equal((await db.collection(prefix+'restored_publicIncidents').doc('fixture_1').get()).data().title,'Isolated recovery fixture');
  console.log('PASS: isolated Firestore and photo recovery, private archive rejects anonymous reads, byte hashes match, public projection restored; queues never replayed.');
 } finally {
  const targets=[...groups,'_coordination',...groups.map(g=>'restored_'+g),'restored_publicIncidents'];
  const cleanup=await Promise.allSettled([...targets.map(async group=>{const snap=await db.collection(prefix+group).get();const batch=db.batch();for(const doc of snap.docs)batch.delete(doc.ref);await batch.commit();}),...[photo,restoredPhoto].filter(Boolean).map(item=>blob.del(item.url,{token:process.env.BLOB_READ_WRITE_TOKEN})),...(backupUrl?[blob.del(backupUrl,{token:process.env.BACKUP_READ_WRITE_TOKEN})]:[])]);
  fs.rmSync(directory,{recursive:true,force:true});await deleteApp(app);
  if(cleanup.some(r=>r.status==='rejected'))throw new Error('Recovery fixture cleanup failed');
 }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
