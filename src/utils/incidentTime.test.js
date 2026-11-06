import {test,expect} from 'vitest';
import {incidentTime} from './incidentTime';
test('incident observation times show the actual Bengaluru date across UTC midnight',()=>{
 const item={createdAt:'2026-11-05T20:00:00.000Z',timestamp:'Just now'};
 expect(incidentTime(item,'en')).toMatch(/06 Nov.*01:30.*IST/);expect(incidentTime(item,'kn')).toContain('IST');expect(incidentTime(item,'hi')).toContain('IST');
});
