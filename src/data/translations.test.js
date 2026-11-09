import extras from './uiExtras.json';
import {simpleCopy} from './simpleCopy';
test('simpleCopy keeps key parity across en/kn/hi',()=>{
 for(const lang of ['kn','hi']){
  expect(Object.keys(simpleCopy[lang]).sort()).toEqual(Object.keys(simpleCopy.en).sort());
  for(const value of Object.values(simpleCopy[lang]))expect(typeof value).toBe('string');
 }
});
test('cached free-provider labels cover both requested scripts without empty fallbacks',()=>{
 for(const lang of ['kn','hi']){
  expect(Object.keys(extras[lang]).sort()).toEqual(Object.keys(extras.en).sort());
  const script=lang==='kn'?/[\u0c80-\u0cff]/:/[\u0900-\u097f]/;
  for(const value of Object.values(extras[lang]))expect(script.test(value)).toBe(true);
 }
});
