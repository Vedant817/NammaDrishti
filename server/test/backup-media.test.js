const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {envelope,restoreLocal,validate,digest}=require('../services/backupArchive');
test('photo bytes and report URLs are recovered together; media corruption cannot be restored',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nd-media-recovery-'));
 try{
 const photo=Buffer.from('fixture image bytes'),url='https://fixture.public.blob.vercel-storage.com/hazards/image.webp';
 const payload={incidents:[{id:'report_1',mediaUrl:url,updates:[{mediaUrl:url}]}],moderationAudit:[],emergencyOutbox:[],pushSubscriptions:[],pushOutbox:[]};
 const archive=envelope(payload,[{url,base64:photo.toString('base64'),hash:digest(photo),byteSize:photo.length}]);
 const target=path.join(dir,'restore');assert.deepEqual(restoreLocal(archive,target),{records:1,media:1});
 assert.deepEqual(fs.readFileSync(path.join(target,'media',digest(photo)+'.webp')),photo);
 assert.equal(JSON.parse(fs.readFileSync(path.join(target,'incidents.json')))[0].mediaUrl,'/api/media/objects/'+digest(photo)+'.webp');
 archive.media[0].base64=Buffer.from('corrupt').toString('base64');assert.throws(()=>validate(archive),/manifest/);
 archive.mediaDigest=digest(archive.media);assert.throws(()=>validate(archive),/Damaged/);
 assert.equal(fs.existsSync(path.join(dir,'invalid')),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('external image links do not impersonate missing managed photos or trigger arbitrary fetches',async()=>{
 const {createBackupService}=require('../services/backupService');
 const db={collection:name=>({limit:()=>({name})}),runTransaction:async callback=>callback({get:async query=>({size:query.name==='incidents'?1:0,docs:query.name==='incidents'?[{id:'fixture',data:()=>({id:'fixture',mediaUrl:'https://other.public.blob.vercel-storage.com/photo.webp'})}]:[]})})};
 const blob={list:async()=>({blobs:[],hasMore:false})};
 const archive=await createBackupService({db,blob,mediaHost:'owned.public.blob.vercel-storage.com'}).capture();
 assert.equal(archive.externalMediaLinks,1);assert.equal(archive.media.length,0);
 db.runTransaction=async callback=>callback({get:async query=>({size:query.name==='incidents'?1:0,docs:query.name==='incidents'?[{id:'fixture',data:()=>({id:'fixture',mediaUrl:'https://owned.public.blob.vercel-storage.com/hazards/missing.webp'})}]:[]})});
 await assert.rejects(createBackupService({db,blob,mediaHost:'owned.public.blob.vercel-storage.com'}).capture(),/managed photo missing/);
});
