const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { validInstant, cityDate, CITY_ZONE } = require('./sourceTime');
const BASE = 'https://sachet.ndma.gov.in/cap_public_website/';
const cityMention = /\b(?:Bengaluru|Bangalore)\b|ಬೆಂಗಳೂರು|बेंगलुर[ुू]|बंगलौर|बेंगलोर/i;
const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
const text = (value, max = 2000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const parser = new XMLParser({removeNSPrefix:true,ignoreAttributes:false,parseTagValue:false,processEntities:false});
const namespaceParser = new XMLParser({ignoreAttributes:false,parseTagValue:false,processEntities:false});

function capDocument(xml) {
  if (typeof xml !== 'string' || Buffer.byteLength(xml) > 262144 || /<!\s*(?:DOCTYPE|ENTITY)/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Invalid CAP document');
  const root = Object.entries(namespaceParser.parse(xml)).find(([key])=>key === 'alert' || /^[\w-]+:alert$/.test(key));
  const namespace = root && root[1][root[0].includes(':') ? '@_xmlns:' + root[0].split(':')[0] : '@_xmlns'];
  if (namespace !== 'urn:oasis:names:tc:emergency:cap:1.2') throw new Error('Invalid CAP namespace');
  return parser.parse(xml).alert;
}
function parseCap(xml, now = Date.now()) {
  const alert = capDocument(xml);
  if (alert.status !== 'Actual' || alert.scope !== 'Public' || !['Alert','Update'].includes(alert.msgType)) return null;
  if (!validInstant(alert.sent) || Date.parse(alert.sent) > now + 300000) return null;
  const variants = list(alert.info).filter(info => {
    const areas = list(info.area).map(area => text(area.areaDesc)).join(' ');
    return cityMention.test(`${areas} ${text(info.headline)} ${text(info.description)}`) && validInstant(info.effective) && validInstant(info.expires) && Date.parse(info.effective) <= now && Date.parse(info.expires) > now && Date.parse(info.expires) > Date.parse(info.effective);
  });
  if (!variants.length) return null;
  const info = variants.find(i => /^en/i.test(i.language)) || variants[0];
  return {id:text(alert.identifier,150),event:text(info.event,150),headline:text(info.headline),description:text(info.description),instruction:text(info.instruction),area:list(info.area).map(a=>text(a.areaDesc,300)).join('; ').slice(0,600),severity:text(info.severity,50),certainty:text(info.certainty,50),sender:text(alert.sender,150),issuedAt:alert.sent,effectiveAt:info.effective,expiresAt:info.expires,languages:Object.fromEntries(variants.map(i=>[text(i.language,20).toLowerCase().split('-')[0],{headline:text(i.headline),description:text(i.description),instruction:text(i.instruction)}]))};
}

function createOfficialAlerts({fetchJson, fetchText, now = Date.now}) {
  let cached, pending;
  return async () => {
    if (cached && now() - cached.at < 60000) return {...cached.value,date:cityDate(now()), alerts:cached.value.alerts.filter(a=>Date.parse(a.expiresAt)>now())};
    if (pending) return pending;
    pending = (async () => {
      const rows = await fetchJson(BASE + 'FetchAllAlertDetails');
      if (!Array.isArray(rows) || rows.length > 5000) throw new Error('Invalid official alert feed');
      // Use the summary only to find candidates. Status, text, relevance and
      // validity are checked again against the authoritative CAP document.
      const candidates = [...new Map(rows.filter(row=>(cityMention.test(`${text(row.area_description)} ${text(row.warning_message)}`)||/Karnataka|Bengaluru|Bangalore/i.test(text(row.alert_source))) && /^\d{10,20}$/.test(String(row.identifier))).map(row=>[String(row.identifier),row])).values()];
      const results = [];
      for (let i = 0; i < Math.min(candidates.length, 12); i += 3) {
        results.push(...await Promise.allSettled(candidates.slice(i, i + 3).map(async row => {
          const sourceUrl = BASE + 'FetchXMLFile?identifier=' + encodeURIComponent(String(row.identifier));
          const xml=await fetchText(sourceUrl),parsed=parseCap(xml,now()),document=capDocument(xml);
          // An update replaces its referenced warnings even when its new area
          // excludes Bengaluru and therefore has no displayable replacement.
          const control=document.status==='Actual'&&document.scope==='Public'&&validInstant(document.sent)&&Date.parse(document.sent)<=now()&&['Cancel','Update'].includes(document.msgType);
          const retired=control?text(document.references,10000).split(/\s+/).map(ref=>ref.split(',')[1]).filter(Boolean):[];
          return {alert:parsed&&{...parsed,source:'NDMA SACHET',sourceUrl},retired};
        })));
      }
      const records=results.filter(r=>r.status==='fulfilled').map(r=>r.value),retired=new Set(records.flatMap(r=>r.retired));
      const alerts = [...new Map(records.filter(r=>r.alert&&!retired.has(r.alert.id)).map(r=>[r.alert.id,r.alert])).values()];
      const value = {status:results.some(r=>r.status==='rejected') || candidates.length>12 ? 'partial' : 'available',source:'NDMA SACHET',sourceUrl:'https://sachet.ndma.gov.in/',timezone:CITY_ZONE,date:cityDate(now()),fetchedAt:new Date(now()).toISOString(),alerts};
      cached = {at:now(),value}; return value;
    })().finally(()=>{pending = null;});
    return pending;
  };
}
module.exports = { parseCap, createOfficialAlerts };
