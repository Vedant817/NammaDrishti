const { validInstant, cityDate, CITY_ZONE } = require('./sourceTime');
const { insideCity } = require('./liveData');
const categories = {1:'Accident',2:'Fog',3:'Dangerous conditions',4:'Rain',5:'Ice',6:'Congestion',7:'Lane closed',8:'Road closed',9:'Road works',10:'Wind',11:'Flooding',14:'Broken down vehicle'};
function normalizeIncidents(raw, now=Date.now()) {
  if(!Array.isArray(raw?.incidents))throw new Error('Invalid traffic incidents');
  const incidents=[];
  for(const item of raw.incidents.slice(0,2000)) {
    const p=item.properties,g=item.geometry;
    if(!p || typeof p.id!=='string' || !['Point','LineString'].includes(g?.type) || p.timeValidity!=='present')continue;
    if(p.startTime && (!validInstant(p.startTime)||Date.parse(p.startTime)>now))continue;
    if(p.endTime && (!validInstant(p.endTime)||Date.parse(p.endTime)<=now))continue;
    const coords=g.type==='Point'?[g.coordinates]:g.coordinates;
    if(!Array.isArray(coords) || !coords.length || coords.length>20000 || !coords.every(c=>Array.isArray(c)&&Number.isFinite(c[0])&&Number.isFinite(c[1])))continue;
    const centre=coords.find(c=>insideCity(c[1],c[0]));if(!centre)continue;
    incidents.push({id:'tomtom_'+p.id.slice(0,180),category:categories[p.iconCategory]||'Traffic incident',iconCategory:p.iconCategory,title:String(p.events?.[0]?.description||categories[p.iconCategory]||'Traffic incident').slice(0,300),from:typeof p.from==='string'?p.from.slice(0,200):'',to:typeof p.to==='string'?p.to.slice(0,200):'',position:{lat:centre[1],lng:centre[0]},delaySeconds:Number.isFinite(p.delay)&&p.delay>=0?p.delay:null,lengthMetres:Number.isFinite(p.length)&&p.length>=0?p.length:null,startTime:p.startTime||null,endTime:p.endTime||null,lastReportTime:validInstant(p.lastReportTime)?p.lastReportTime:null,fetchedAt:new Date(now).toISOString(),source:'TomTom',sourceUrl:'https://www.tomtom.com/',timeValidity:'present'});
  }
  const priority={8:0,1:1,11:2,7:3,3:4,6:5,9:6};
  incidents.sort((a,b)=>(priority[a.iconCategory]??7)-(priority[b.iconCategory]??7));
  return {status:'available',source:'TomTom',timezone:CITY_ZONE,date:cityDate(now),fetchedAt:new Date(now).toISOString(),incidents:[...new Map(incidents.map(i=>[i.id,i])).values()],truncated:raw.incidents.length>2000};
}
module.exports={normalizeIncidents};
