const CITY_ZONE = 'Asia/Kolkata';
function cityDate(now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone:CITY_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
function validInstant(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}
module.exports = { CITY_ZONE, cityDate, validInstant };
