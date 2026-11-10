import extras from './uiExtras.json';
import {simpleCopy} from './simpleCopy';
test('simpleCopy keeps key parity across en/kn/hi',()=>{
 for(const lang of ['kn','hi']){
  expect(Object.keys(simpleCopy[lang]).sort()).toEqual(Object.keys(simpleCopy.en).sort());
  for(const value of Object.values(simpleCopy[lang]))expect(typeof value).toBe('string');
 }
});
test('simpleCopy values are non-empty and template placeholders match across locales',()=>{
 const placeholders=value=>[...value.matchAll(/\{[a-zA-Z]+\}/g)].map(match=>match[0]).sort();
 for(const [key,value] of Object.entries(simpleCopy.en)){
  expect(typeof value).toBe('string');
  expect(value.trim().length).toBeGreaterThan(0);
  for(const lang of ['kn','hi']){
   const translated=simpleCopy[lang][key];
   expect(typeof translated).toBe('string');
   expect(translated.trim().length).toBeGreaterThan(0);
   expect(placeholders(translated)).toEqual(placeholders(value));
  }
 }
});
test('cached free-provider labels cover both requested scripts without empty fallbacks',()=>{
 for(const lang of ['kn','hi']){
  expect(Object.keys(extras[lang]).sort()).toEqual(Object.keys(extras.en).sort());
  const script=lang==='kn'?/[\u0c80-\u0cff]/:/[\u0900-\u097f]/;
  for(const value of Object.values(extras[lang]))expect(script.test(value)).toBe(true);
 }
});
