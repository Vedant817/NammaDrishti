// Explicit public projection: never publish identities, votes, moderation or SOS.
const FIELDS = ['id','type','title','description','ward','position','urgency','mediaUrl','waterDepth','vehiclePassability','createdAt','timestamp','verificationCount','verificationScore','isVerified','clusterCount','resolutionVotes','clearanceVotes','reportedBy','hexIndex'];
function publicIncident(item) {
  if (item.moderationHidden) return null;
  const result = Object.fromEntries(FIELDS.filter(key => item[key] !== undefined).map(key => [key,item[key]]));
  const updateFields = ['timestamp','description','reportedBy','mediaUrl','urgency','waterDepth','vehiclePassability'];
  const updates = (Array.isArray(item.updates) ? item.updates : []).slice(0,50).filter(update => typeof update.description === 'string').map(update => Object.fromEntries(updateFields.filter(key => update[key] !== undefined).map(key => [key,update[key]])));
  if (updates.length) result.updates = updates;
  return JSON.parse(JSON.stringify(result));
}
module.exports = { publicIncident };
