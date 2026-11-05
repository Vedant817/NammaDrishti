const {randomUUID}=require('crypto');
function createLease(db,{owner=randomUUID(),now=Date.now}={}) {
  const ref=db.collection('_coordination').doc('incident-writer');
  let held=false;
  return {
    async acquire() {
      const acquired=await db.runTransaction(async tx=>{
        const current=(await tx.get(ref)).data();
        if(current?.until>now()&&current.owner!==owner)return false;
        tx.set(ref,{owner,until:now()+45000});return true;
      });
      if(!acquired)throw new Error('Another replica is committing; retry shortly');
      held=true;
      return async()=>{if(!held)return;held=false;await db.runTransaction(async tx=>{const item=(await tx.get(ref)).data();if(item?.owner===owner)tx.delete(ref);});};
    },
    async commit(changes,deleted,collection) {
      if(!held)throw new Error('Write lease required');
      await db.runTransaction(async tx=>{
        const current=(await tx.get(ref)).data();
        if(current?.owner!==owner||current.until<=now())throw new Error('Write lease expired');
        for(const item of changes)tx.set(collection.doc(item.id),item);
        for(const id of deleted)tx.delete(collection.doc(id));
      });
    }
  };
}
module.exports={createLease};
