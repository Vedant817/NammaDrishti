require('dotenv').config();const {spawn}=require('child_process'),assert=require('node:assert/strict'),crypto=require('crypto'),path=require('path');
const sr=require('module').createRequire(path.resolve(__dirname,'../server/package.json'));
const {initializeApp,applicationDefault,deleteApp}=sr('firebase-admin/app'),{getAuth}=sr('firebase-admin/auth'),{getFirestore}=sr('firebase-admin/firestore');
async function main(){const cli=require(path.join(process.env.FIREBASE_CLI_ROOT || path.join(path.dirname(process.execPath),'node_modules/firebase-tools'),'lib/auth')); const account=cli.getGlobalDefaultAccount(); const credential={getAccessToken:async()=>{const value=await cli.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);return {access_token:value.access_token,expires_in:3600};}}; const app=initializeApp({projectId:process.env.FIREBASE_PROJECT_ID,credential},'auth-acceptance'),auth=getAuth(app),storeApp=initializeApp({projectId:process.env.FIREBASE_PROJECT_ID,credential:applicationDefault()},'acceptance-storage'),db=getFirestore(storeApp),uid='acceptance_'+crypto.randomUUID().replaceAll('-',''),id='report_'+uid,password=crypto.randomBytes(20).toString('base64url'),email=uid+'@example.invalid';let child,created=false;const base='http://127.0.0.1:5023/api';try{
 await auth.createUser({uid,email,password,emailVerified:true});created=true;child=spawn(process.execPath,['server/index.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PORT:'5023',NODE_ENV:'production'},stdio:'ignore'});
 for(let n=0;n<40;n++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 const signin=async()=>{const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+process.env.REACT_APP_FIREBASE_API_KEY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});assert.equal(r.status,200);return (await r.json()).idToken;};
 let token=await signin();const request=(url,body,credential=token)=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',...(credential?{Authorization:'Bearer '+credential}:{})},body:JSON.stringify(body)});
 const report={id,title:'Live acceptance fixture',description:'Temporary automated acceptance fixture; removed after validation.',type:'Infrastructure',position:{lat:12.701,lng:77.301},urgency:'Low'};
 assert.equal((await request('/incidents',report,null)).status,401);assert.equal((await request('/incidents',report)).status,201);assert.equal((await db.collection('incidents').doc(id).get()).data().reporters[0],uid);
 assert.equal((await fetch(base+'/moderation',{headers:{Authorization:'Bearer '+token}})).status,403);
 await auth.setCustomUserClaims(uid,{moderator:true});token=await signin();
 assert.equal((await request('/moderation/'+id,{action:'hide',reason:'Acceptance fixture quarantine'})).status,200);
 assert.ok(!(await (await fetch(base+'/incidents')).json()).some(i=>i.id===id));
 assert.equal((await request('/incidents',report)).status,409);
 assert.equal((await request('/moderation/'+id,{action:'restore',reason:'Acceptance fixture restored'})).status,200);
 console.log('LIVE PASS: verified email sign-in, durable authenticated report, role denial, moderator hide/restore and hidden-ID replay rejection.');
 }finally{if(child){child.kill();await new Promise(r=>setTimeout(r,500));}await db.collection('incidents').doc(id).delete();const audit=await db.collection('moderationAudit').where('incidentId','==',id).get();for(const d of audit.docs)await d.ref.delete();if(created)await auth.deleteUser(uid);await deleteApp(app);await deleteApp(storeApp);}}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
