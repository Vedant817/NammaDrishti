const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
process.env.NODE_ENV='test';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nd-offline-observation-'));
process.env.DATA_FILE=path.join(directory,'incidents.json');process.env.STATE_DIR=directory;
const {server,io}=require('../index');
test('delayed reports preserve observation time, reject old claims, and replay existing IDs unchanged',async t=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>io.close(resolve));assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));fs.rmSync(directory,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`,post=body=>fetch(base+'/api/incidents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const report={id:'observed_time',title:'Synthetic observation',description:'Test fixture only',type:'Traffic',position:{lat:12.97,lng:77.59},observedAt:Date.now()-10*60000};
 const response=await post(report);assert.equal(response.status,201);const saved=await response.json();assert.equal(Date.parse(saved.createdAt),report.observedAt);assert.equal(saved.timestamp,saved.createdAt);
 for(const observedAt of [Date.now()-86400000,Date.now()+3600000,'yesterday']){const rejected=await post({...report,id:'bad_time',observedAt});assert.equal(rejected.status,422);}
 const duplicate=await post({...report,observedAt:Date.now()-86400000});assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).createdAt,saved.createdAt);
});
