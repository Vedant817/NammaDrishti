import extras from './uiExtras.json';
test('cached free-provider labels cover both requested scripts without empty fallbacks',()=>{
 for(const lang of ['kn','hi']){
  expect(Object.keys(extras[lang]).sort()).toEqual(Object.keys(extras.en).sort());
  const script=lang==='kn'?/[\u0c80-\u0cff]/:/[\u0900-\u097f]/;
  for(const value of Object.values(extras[lang]))expect(script.test(value)).toBe(true);
 }
});
