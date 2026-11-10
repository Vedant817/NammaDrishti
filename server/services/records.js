const fs = require('fs');
const path = require('path');
function createRecords({ db, directory = process.env.STATE_DIR || path.join(__dirname, '../runtime') } = {}) {
  let queue = Promise.resolve();
  const file = path.join(directory,'records.json');
  function read() { try { return JSON.parse(fs.readFileSync(file,'utf8')); } catch(e) { if(e.code==='ENOENT')return {};throw e; } }
  function edit(task) { const result=queue.then(()=>{const data=read();const value=task(data);fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(`${file}.tmp`,JSON.stringify(data),{mode:0o600});fs.renameSync(`${file}.tmp`,file);return value;});queue=result.catch(()=>{});return result; }
  return {
    async put(group,id,value) { if(db)return db.collection(group).doc(id).set(value);return edit(data=>{data[group]||={};data[group][id]=value;}); },
    async get(group,id) { if(db){const doc=await db.collection(group).doc(id).get();return doc.exists?doc.data():null;}await queue;return read()[group]?.[id]||null; },
    async list(group) { if(db){const values=[];let cursor;for(;;){let query=db.collection(group).orderBy('__name__').limit(200);if(cursor)query=query.startAfter(cursor);const snap=await query.get();values.push(...snap.docs.map(d=>d.data()));if(snap.size<200)return values;cursor=snap.docs[snap.docs.length-1];if(values.length>=20000)throw new Error('Record budget exceeded; operator maintenance required');}}await queue;return Object.values(read()[group]||{}); },
    async remove(group,id) { if(db)return db.collection(group).doc(id).delete();return edit(data=>{if(data[group])delete data[group][id];}); },
    async claim(group,id,owner,now=Date.now(),statuses) {
      const change=value=>{if(!value||value.leaseUntil>now||(statuses&&!statuses.includes(value.status)))return null;return {...value,leaseOwner:owner,leaseUntil:now+30000};};
      if(db){const ref=db.collection(group).doc(id);return db.runTransaction(async tx=>{const snap=await tx.get(ref);const next=change(snap.data());if(next)tx.set(ref,next);return next;});}
      return edit(data=>{const next=change(data[group]?.[id]);if(next)data[group][id]=next;return next;});
    },
    async update(group,id,owner,now=Date.now(),updater) {
      if(db){
        const ref=db.collection(group).doc(id);
        return db.runTransaction(async tx=>{
          const snap=await tx.get(ref);
          const current=snap.data();
          if(!current||current.leaseOwner!==owner||current.leaseUntil<=now)return null;
          const next=updater({...current});
          if(!next)return null;
          tx.set(ref,next);
          return next;
        });
      }
      return edit(data=>{
        const current=data[group]?.[id];
        if(!current||current.leaseOwner!==owner||current.leaseUntil<=now)return null;
        const next=updater({...current});
        if(!next)return null;
        data[group][id]=next;
        return next;
      });
    }
  };
}
module.exports={createRecords};
