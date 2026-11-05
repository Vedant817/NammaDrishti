const fs=require('fs'),path=require('path');
const {groups,digest,validate,restoreLocal,snapshot,envelope:makeEnvelope}=require('../server/services/backupArchive');
async function backup({db,dataFile,stateDir,output,mediaDir}){
 let payload;
 if(db)payload=process.env.BLOB_READ_WRITE_TOKEN?null:await snapshot(db);
 else {payload={};payload.incidents=fs.existsSync(dataFile)?JSON.parse(fs.readFileSync(dataFile,'utf8')):[];const f=path.join(stateDir,'records.json'),records=fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):{};for(const g of groups.slice(1))payload[g]=Object.values(records[g]||{});}
 let envelope;
 if(db){
  const urls=payload?require('../server/services/backupArchive').mediaUrls(payload):[];
  if(urls.some(url=>url.includes('.public.blob.vercel-storage.com/'))&&!process.env.BLOB_READ_WRITE_TOKEN)throw new Error('Media token required to back up uploaded photos');
  envelope=process.env.BLOB_READ_WRITE_TOKEN?await require('../server/services/backupService').createBackupService({db}).capture():makeEnvelope(payload);
 }else{
  const media=[];for(const url of require('../server/services/backupArchive').mediaUrls(payload)){
   const match=/^\/api\/media\/objects\/([a-f0-9]{64})\.webp$/.exec(url);if(!match)continue;
   const bytes=fs.readFileSync(path.join(mediaDir||path.join(stateDir,'media'),match[1]+'.webp'));
   media.push({url,base64:bytes.toString('base64'),hash:digest(bytes),byteSize:bytes.length});
  }envelope=makeEnvelope(payload,media);
 }validate(envelope);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(envelope),{flag:'wx',mode:0o600});return envelope;
}
async function main(){require('dotenv').config();const args=process.argv.slice(2),value=name=>args[args.indexOf(name)+1];if(args[0]==='restore'){const source=value('--from');if(!source)throw new Error('--from required');if(fs.statSync(source).size>100*1024*1024)throw new Error('Archive too large');const bytes=fs.readFileSync(source);const env=JSON.parse((source.endsWith('.gz')?require('zlib').gunzipSync(bytes,{maxOutputLength:100*1024*1024}):bytes).toString('utf8'));validate(env);if(!args.includes('--apply')){console.log('Backup verified. Dry run: no data changed. Use --apply --to NEW_DIRECTORY to rehearse recovery.');return;}const target=value('--to');if(!target)throw new Error('--to required');restoreLocal(env,path.resolve(target));console.log('Recovered into new local directory. Production was not overwritten.');return;}
 const output=args.includes('--output')?value('--output'):null;if(!output)throw new Error('--output required (private path outside repository)');let db;if(process.env.FIREBASE_PROJECT_ID)db=require('../server/services/firebaseStore').createFirebaseStore(process.env.FIREBASE_PROJECT_ID).db;await backup({db,dataFile:process.env.DATA_FILE||path.join(__dirname,'../server/incidents.json'),stateDir:process.env.STATE_DIR||path.join(__dirname,'../server/runtime'),output:path.resolve(output),mediaDir:process.env.MEDIA_DIR});console.log('Backup saved with uploaded photos and checksums verified. External image links remain external.');}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={backup,validate,restoreLocal,digest};
