require('dotenv').config();const {spawn}=require('child_process'),assert=require('node:assert/strict'),crypto=require('crypto'),path=require('path');
const sr=require('module').createRequire(path.resolve(__dirname,'../server/package.json'));
const {initializeApp,applicationDefault,deleteApp}=sr('firebase-admin/app'),{getAuth}=sr('firebase-admin/auth'),{getFirestore}=sr('firebase-admin/firestore');
async function main(){const cli=require(path.join(process.env.FIREBASE_CLI_ROOT || path.join(path.dirname(process.execPath),'node_modules/firebase-tools'),'lib/auth')); const account=cli.getGlobalDefaultAccount(); const credential={getAccessToken:async()=>{const value=await cli.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);return {access_token:value.access_token,expires_in:3600};}}; const app=initializeApp({projectId:process.env.FIREBASE_PROJECT_ID,credential},'auth-acceptance'),auth=getAuth(app),storeApp=initializeApp({projectId:process.env.FIREBASE_PROJECT_ID,credential:applicationDefault()},'acceptance-storage'),db=getFirestore(storeApp),uid='acceptance_'+crypto.randomUUID().replaceAll('-',''),id='report_'+uid,password=crypto.randomBytes(20).toString('base64url'),email=uid+'@example.invalid';let child,created=false,photoUrl;const base=process.env.ACCEPTANCE_API_URL||'http://127.0.0.1:5023/api';try{
 await auth.createUser({uid,email,password,emailVerified:false});created=true;if(!process.env.ACCEPTANCE_API_URL)child=spawn(process.execPath,['server/index.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PORT:'5023',NODE_ENV:'production'},stdio:'ignore'});
 for(let n=0;n<40;n++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 const signin=async()=>{const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+process.env.REACT_APP_FIREBASE_API_KEY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});assert.equal(r.status,200);return (await r.json()).idToken;};
 let token=await signin();const request=(url,body,credential=token)=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',...(credential?{Authorization:'Bearer '+credential}:{})},body:JSON.stringify(body)});
 const report={id,title:'Live acceptance fixture',description:'Temporary automated acceptance fixture; removed after validation.',type:'Infrastructure',position:{lat:12.701,lng:77.301},urgency:'Low'};
 assert.equal((await request('/incidents',report)).status,403);await auth.updateUser(uid,{emailVerified:true});token=await signin();
 assert.equal((await request('/incidents',report,null)).status,401);assert.equal((await request('/incidents',report)).status,201);assert.equal((await db.collection('incidents').doc(id).get()).data().reporters[0],uid);
 assert.equal((await fetch(base+'/moderation',{headers:{Authorization:'Bearer '+token}})).status,403);
 await auth.setCustomUserClaims(uid,{moderator:true});token=await signin();
 assert.equal((await request('/moderation/'+id,{action:'hide',reason:'Acceptance fixture quarantine'})).status,200);
 assert.ok(!(await (await fetch(base+'/incidents')).json()).some(i=>i.id===id));
 assert.equal((await request('/incidents',report)).status,409);
 assert.equal((await request('/moderation/'+id,{action:'restore',reason:'Acceptance fixture restored'})).status,200);
 const opsResponse=await fetch(base+'/operations',{headers:{Authorization:'Bearer '+token}});assert.equal(opsResponse.status,200);const ops=await opsResponse.json();assert.equal(ops.storageReady,true);
 for(const language of ['en','kn','hi']){const response=await request('/assistant/chat',{message:'What is the weather now?',language});assert.equal(response.status,200);const data=await response.json();assert.equal(typeof data.reply,'string');if(language==='kn')assert.match(data.reply,/[\u0c80-\u0cff]/);if(language==='hi')assert.match(data.reply,/[\u0900-\u097f]/);}
 const modelResponse=await request('/assistant/chat',{message:'How do I report a pothole?',language:'en'});assert.equal(modelResponse.status,200);const model=await modelResponse.json();
 let media='not requested';
 if(process.env.TEST_MEDIA==='1'){
   assert.ok(process.env.BLOB_READ_WRITE_TOKEN&&!process.env.BLOB_READ_WRITE_TOKEN.includes('[SENSITIVE]'),'Cleanup credential required before media test');
   const upload=await request('/media/upload',{imageBase64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',mimeType:'image/png'});assert.equal(upload.status,201);photoUrl=(await upload.json()).mediaUrl;
   const object=await fetch(photoUrl,{signal:AbortSignal.timeout(15000)});assert.equal(object.status,200,'Uploaded WebP retrieval');assert.match(object.headers.get('content-type'),/image\/webp/);media='Blob WebP upload and retrieval verified';
 }
 if(ops.sources.sos==='location-only'){
   const response=await request('/sos/dispatch',{lat:12.701,lng:77.301});assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.status,'LOCATION_RECORDED');
   assert.equal((await fetch(base+'/sos/status/'+saved.dispatchId,{headers:{Authorization:'Bearer '+token}})).status,200,'Private SOS status');assert.equal((await fetch(base+'/sos/status/'+saved.dispatchId)).status,404);
 }
 console.log('LIVE PASS: unverified-email rejection; verified report persistence and contributor binding; non-moderator denial; moderator hide/restore, replay denial and operations; three-language weather assistant; model mode='+model.mode+' ('+model.providerStatus+'); '+media+'; SOS privacy when location-only.');
 }finally{
   if(child)child.kill();
   const tasks=[db.collection('incidents').doc(id).delete(),db.collection('publicIncidents').doc(id).delete()];
   tasks.push(...['moderationAudit','emergencyOutbox'].map(async group=>{const snap=await db.collection(group).where(group==='moderationAudit'?'incidentId':'uid','==',group==='moderationAudit'?id:uid).get();await Promise.all(snap.docs.map(doc=>doc.ref.delete()));}));
   if(created)tasks.push(auth.deleteUser(uid));
   if(photoUrl)tasks.push(sr('@vercel/blob').del(photoUrl,{token:process.env.BLOB_READ_WRITE_TOKEN}));
   const cleaned=await Promise.allSettled(tasks);await Promise.all([deleteApp(app),deleteApp(storeApp)]);
   if(cleaned.some(result=>result.status==='rejected'))throw new Error('Isolated acceptance fixture cleanup failed');
 }}

main().catch(e=>{console.error(e.stack.split('\n').slice(0,5).join('\n'));process.exitCode=1;});
