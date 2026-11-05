import {vi} from 'vitest';
test('routing uses the documented fallback and coalesces repeated requests',async()=>{
  vi.resetModules();vi.useFakeTimers();
  const previous=globalThis.fetch;
  const fetcher=vi.fn().mockResolvedValueOnce({status:503}).mockResolvedValue({status:200,json:async()=>({code:'Ok',routes:[{distance:1000,duration:300,geometry:{coordinates:[[77.59,12.97],[77.62,12.91]]},legs:[{summary:'Fixture road'}]}]})});
  globalThis.fetch=fetcher;
  try{
    const {fetchDrivingRoute}=await import('./routingService');
    const start={lat:12.97,lng:77.59},end={lat:12.91,lng:77.62};
    const requests=Promise.all([fetchDrivingRoute(start,end),fetchDrivingRoute(start,end)]);
    await vi.advanceTimersByTimeAsync(1200);
    const values=await requests;
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toMatch(/^https:\/\/routing\.openstreetmap\.de\/routed-car\/route\//);
    expect(values[0].coordinates[0]).toEqual([12.97,77.59]);
    await fetchDrivingRoute(start,end);expect(fetcher).toHaveBeenCalledTimes(2);
  }finally{globalThis.fetch=previous;vi.useRealTimers();}
});
