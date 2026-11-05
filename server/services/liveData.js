const POINTS = [{id:'silk',name:'Silk Board',lat:12.9171,lng:77.6238},{id:'orr',name:'ORR Bellandur',lat:12.935,lng:77.685},{id:'tin',name:'Tin Factory',lat:12.9972,lng:77.6672},{id:'hebbal',name:'Hebbal',lat:13.0358,lng:77.597}];
const insideCity = (lat,lng) => Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=12.7&&lat<=13.28&&lng>=77.3&&lng<=77.88;
async function jsonFetch(url, options={}) {
  const res=await fetch(url,{...options,signal:AbortSignal.timeout(7000)});
  if(!res.ok) throw new Error(`Provider HTTP ${res.status}`);
  const body=await res.text();
  if(body.length>2000000) throw new Error('Provider response too large');
  return JSON.parse(body);
}
function normalizeWeather(data,now=Date.now()) {
  const c=data.current, time=c&&Date.parse(`${c.time}Z`);
  if(!c||!Number.isFinite(time)||!Number.isFinite(c.interval)||c.interval<=0||!Number.isFinite(c.precipitation)||c.precipitation<0) throw new Error('Invalid weather observation');
  const stale=now-time>1800000||time>now+300000;
  return {source:'Open-Meteo model',sourceUrl:'https://open-meteo.com/',observedAt:new Date(time).toISOString(),fetchedAt:new Date(now).toISOString(),intervalSeconds:c.interval,precipitationAmountMm:c.precipitation,precipitation:c.precipitation*3600/c.interval,precipitationRateMmPerHour:c.precipitation*3600/c.interval,temp:Number.isFinite(c.temperature_2m)?c.temperature_2m:null,humidity:c.relative_humidity_2m,windSpeed:c.wind_speed_10m,windSpeedUnit:data.current_units?.wind_speed_10m||'km/h',temperatureUnit:'°C',weatherCode:c.weather_code,stale,isOffline:stale,loading:false,lastUpdated:new Date(time).toISOString(),description:'Model estimate',floodRisk:'Not assessed'};
}
function createLiveData({fetchJson=jsonFetch,now=Date.now,reserveGeocode=null,pause=ms=>new Promise(r=>setTimeout(r,ms))}={}) {
  const cache=new Map(),pending=new Map(),metrics={requests:0,failures:0,lastFailureAt:null};
  async function cached(key,ttl,task) {
    const hit=cache.get(key); if(hit&&now()-hit.at<ttl) return hit.value;
    if(pending.has(key)) return pending.get(key);
    const request=Promise.resolve().then(task).then(value=>{if(cache.size>=500)cache.delete(cache.keys().next().value);cache.set(key,{at:now(),value});return value;}).catch(e=>{metrics.failures++;metrics.lastFailureAt=new Date(now()).toISOString();throw e;}).finally(()=>pending.delete(key));
    metrics.requests++;pending.set(key,request);return request;
  }
  let queue=Promise.resolve(),nextAt=0,queued=0;
  return {metrics,
    weather(lat=12.9716,lng=77.5946) {
      if(!insideCity(lat,lng)) return Promise.reject(new Error('Coordinates outside Bengaluru'));
      return cached(`weather:${lat.toFixed(2)},${lng.toFixed(2)}`,120000,async()=>normalizeWeather(await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=GMT`),now()));
    },
    geocode(query) {
      if(typeof query!=='string'||query.trim().length<2||query.length>150) return Promise.reject(new Error('Search must be 2–150 characters'));
      const q=query.trim();
      return cached(`place:${q.toLowerCase()}`,86400000,async()=>{
        if(queued>=8)throw new Error('Search queue busy; retry later');queued++;
        const request=queue.then(async()=>{
          let release;
          if(reserveGeocode)release=await reserveGeocode();
          else {await pause(Math.max(0,nextAt-now()));nextAt=now()+1100;}
          const url=new URL(process.env.GEOCODING_URL||'https://nominatim.openstreetmap.org/search');
          url.search=new URLSearchParams({q,format:'jsonv2',countrycodes:'in',viewbox:'77.30,13.28,77.88,12.70',bounded:'1',limit:'5'});
          let raw;
          try {raw=await fetchJson(url.toString(),{headers:{'User-Agent':process.env.GEOCODING_USER_AGENT||'NammaDrishti/1.0 (Bengaluru civic reports)',Accept:'application/json'}}); } finally { if(release)await release(); }
          if(!Array.isArray(raw))throw new Error('Invalid geocoder response');
          return raw.map(p=>({lat:Number(p.lat),lng:Number(p.lon),label:String(p.display_name||'').slice(0,500),type:p.type||'place'})).filter(p=>insideCity(p.lat,p.lng));
        });
        queue=request.catch(()=>{}).finally(()=>queued--);return request;
      });
    },
    traffic() {
      if(!process.env.TOMTOM_API_KEY)return Promise.resolve({status:'unconfigured',source:'TomTom',segments:[]});
      return cached('traffic',120000,async()=>{
        const segments=await Promise.all(POINTS.map(async p=>{
          try {
            const raw=await fetchJson(`https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${p.lat},${p.lng}&unit=KMPH&key=${encodeURIComponent(process.env.TOMTOM_API_KEY)}`),f=raw.flowSegmentData;
            if(!f||!Number.isFinite(f.currentSpeed)||!Number.isFinite(f.freeFlowSpeed)||!Number.isFinite(f.confidence))throw new Error('Invalid traffic');
            const positions=f.coordinates?.coordinate?.map(c=>[c.latitude,c.longitude]).filter(([lat,lng])=>insideCity(lat,lng));
            if(!positions?.length)throw new Error('No traffic coverage');
            return {...p,positions,currentSpeed:f.currentSpeed,freeFlowSpeed:f.freeFlowSpeed,confidence:f.confidence,roadClosure:f.roadClosure===true,fetchedAt:new Date(now()).toISOString()};
          }catch{return {...p,unavailable:true};}
        }));
        return {status:segments.some(s=>!s.unavailable)?'available':'unavailable',source:'TomTom',sourceUrl:'https://www.tomtom.com/',segments};
      });
    },
    floodContext() {
      return cached('river-model',3600000,async()=>{
        const raw=await fetchJson('https://flood-api.open-meteo.com/v1/flood?latitude=12.9716&longitude=77.5946&daily=river_discharge&forecast_days=3');
        if(!insideCity(raw.latitude,raw.longitude)||raw.daily_units?.river_discharge!=='m³/s'||!Array.isArray(raw.daily?.time)||!Array.isArray(raw.daily?.river_discharge)||raw.daily.time.length!==raw.daily.river_discharge.length)throw new Error('Invalid river model data');
        const forecast=raw.daily.time.map((date,i)=>({date,discharge:raw.daily.river_discharge[i]})).filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&Number.isFinite(p.discharge)&&p.discharge>=0);
        if(!forecast.length)throw new Error('River model unavailable');
        return {status:'available',source:'Open-Meteo / Copernicus GloFAS',sourceUrl:'https://open-meteo.com/en/docs/flood-api',kind:'regional-river-model',resolutionKm:5,unit:'m³/s',latitude:raw.latitude,longitude:raw.longitude,fetchedAt:new Date(now()).toISOString(),forecast};
      });
    },
    observations() {
      if(!process.env.FLOOD_OBSERVATIONS_URL)return Promise.resolve({status:'unconfigured',observations:[]});
      return cached('flood',60000,async()=>{
        const raw=await fetchJson(process.env.FLOOD_OBSERVATIONS_URL);
        if(!Array.isArray(raw.observations))throw new Error('Invalid observation feed');
        const observations=raw.observations.slice(0,200).filter(p=>insideCity(p.lat,p.lng)&&Number.isFinite(p.depthCm)&&p.depthCm>=0&&typeof p.sourceUrl==='string'&&/^https:\/\//.test(p.sourceUrl)&&typeof p.source==='string'&&Number.isFinite(Date.parse(p.observedAt))&&now()-Date.parse(p.observedAt)<900000&&Date.parse(p.observedAt)<=now());
        return {status:observations.length?'available':'unavailable',observations};
      });
    }
  };
}
module.exports={createLiveData,normalizeWeather,insideCity,jsonFetch};
