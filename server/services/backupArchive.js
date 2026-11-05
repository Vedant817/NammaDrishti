const fs=require('fs'),path=require('path'),crypto=require('crypto');
const groups=['incidents','moderationAudit','emergencyOutbox','pushSubscriptions','pushOutbox'];
const digest=value=>crypto.createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const LIMIT=32*1024*1024;
function validate(envelope){
 if(![1,2].includes(envelope?.version)||!envelope.payload||envelope.digest!==digest(envelope.payload)||!groups.every(g=>Array.isArray(envelope.payload[g])))throw new Error('Invalid or damaged backup');
 for(const g of groups){const ids=new Set();for(const item of envelope.payload[g]){if(typeof item.id!=='string'||!/^[A-Za-z0-9_-]{1,200}$/.test(item.id)||ids.has(item.id))throw new Error('Invalid or duplicate record ID');ids.add(item.id);}}
 if(envelope.version===2){if(!Array.isArray(envelope.media)||envelope.mediaDigest!==digest(envelope.media))throw new Error('Invalid media manifest');const urls=new Set();let total=0;for(const item of envelope.media){const bytes=Buffer.from(item.base64,'base64');total+=bytes.length;if(total>LIMIT||typeof item.url!=='string'||urls.has(item.url)||!/^[a-f0-9]{64}$/.test(item.hash)||digest(bytes)!==item.hash||bytes.length!==item.byteSize)throw new Error('Damaged backup media');urls.add(item.url);}}
 return envelope.payload;
}
async function snapshot(db){return db.runTransaction(async tx=>{const result={};for(const g of groups){const snap=await tx.get(db.collection(g).limit(5001));if(snap.size>5000)throw new Error('Backup record budget exceeded');result[g]=snap.docs.map(d=>{const data=d.data();if(data.id!==d.id)throw new Error('Record ID mismatch');return data;});}return result;},{readOnly:true});}
function envelope(payload,media=[]){if(Buffer.byteLength(JSON.stringify(payload))>LIMIT)throw new Error('Backup record budget exceeded');const result={version:2,createdAt:new Date().toISOString(),project:process.env.FIREBASE_PROJECT_ID||'local',payload,digest:digest(payload),media,mediaDigest:digest(media)};validate(result);return result;}
function mediaUrls(payload){return [...new Set(payload.incidents.flatMap(i=>[i.mediaUrl,...(i.updates||[]).map(u=>u.mediaUrl)]).filter(u=>typeof u==='string'&&u))];}
function restoreLocal(archive,target){
 const source=validate(archive);if(fs.existsSync(target))throw new Error('Restore target must be a new directory');
 const payload=JSON.parse(JSON.stringify(source)),replacements=new Map();
 fs.mkdirSync(target,{recursive:true,mode:0o700});
 if(archive.media?.length){const mediaDir=path.join(target,'media');fs.mkdirSync(mediaDir,{mode:0o700});for(const item of archive.media){fs.writeFileSync(path.join(mediaDir,item.hash+'.webp'),Buffer.from(item.base64,'base64'),{mode:0o600});replacements.set(item.url,'/api/media/objects/'+item.hash+'.webp');}}
 for(const i of payload.incidents){if(replacements.has(i.mediaUrl))i.mediaUrl=replacements.get(i.mediaUrl);for(const u of i.updates||[])if(replacements.has(u.mediaUrl))u.mediaUrl=replacements.get(u.mediaUrl);}
 fs.writeFileSync(path.join(target,'incidents.json'),JSON.stringify(payload.incidents),{mode:0o600});
 const records=Object.fromEntries(groups.slice(1).map(g=>[g,Object.fromEntries(payload[g].map(i=>[i.id,i]))]));
 fs.writeFileSync(path.join(target,'records.json'),JSON.stringify(records),{mode:0o600});
 return {records:groups.reduce((n,g)=>n+payload[g].length,0),media:archive.media?.length||0};
}
module.exports={groups,digest,validate,snapshot,envelope,restoreLocal,mediaUrls,LIMIT};
