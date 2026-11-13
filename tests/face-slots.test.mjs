import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dialId} from '../engine/device/lib/ble-protocol.js';
import {readRegistry,rememberInstallation,receiptFaces,faceChoices,REGISTRY_KEY,faceSeed} from '../face-slots.js';
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
test('five collection faces have distinct seeds and preserve the original Braun identities',()=>{
  const themes=['white','black','casio','braun-subdials','skagen'];
  assert.equal(new Set(themes.map(faceSeed)).size,5);
  assert.equal(faceSeed('white'),'braun-round-pro2-v1');assert.equal(faceSeed('black'),'braun-black-pro2-v2');
  assert.throws(()=>faceSeed('unknown'));
});
test('every published variant has a distinct native identity matching its manifest',()=>{
  const variants=JSON.parse(fs.readFileSync(new URL('../variants.json',import.meta.url)));
  for(const v of variants)assert.equal(faceSeed(v.theme),v.seed);
  assert.equal(new Set(variants.map(v=>dialId(faceSeed(v.theme)))).size,variants.length);
});

test('late watch list is merged with previously installed custom faces without duplicates',()=>{
  const registry={faces:[{id:12345,name:'Braun Round'}],retired:[]};
  assert.deepEqual(faceChoices({registry}).map(f=>f.id),[12345]);
  const later=faceChoices({reported:[280,12345],installed:[280,12345],registry,label:()=> 'Factory face'});
  assert.deepEqual(later.map(f=>f.id),[280,12345]);assert.equal(later[1].name,'Braun Round');assert.equal(later[1].confirmed,true);
});
test('last successful transfer restores a missing face even after a later connection-only record',()=>{
  const reports=[{theme:'white',name:'Braun Round',hardware:{model:'Watch-A',uploaded:false},
    previousRevisionHardware:{model:'Watch-A',uploaded:true}}];
  assert.deepEqual(receiptFaces(reports,'Watch-A',()=>12345),[{id:12345,name:'Braun Round'}]);
});
test('transfer receipts from another watch or unsuccessful transfer are never offered',()=>{
  const reports=[{theme:'white',name:'Other',hardware:{model:'Watch-B',uploaded:true}},
    {theme:'black',name:'Failed',hardware:{model:'Watch-A',uploaded:false}}];
  assert.deepEqual(receiptFaces(reports,'Watch-A',()=>12345),[]);
  assert.deepEqual(receiptFaces(reports,null,()=>12345),[]);
});
test('accepted face history is scoped to the browser device identifier',()=>{
  const s=memory();rememberInstallation(s,'device-A',{id:12345,name:'White'});
  assert.equal(readRegistry(s,'device-A').faces.length,1);assert.equal(readRegistry(s,'device-B').faces.length,0);
});
test('replacing a face retires its older history and does not offer it again from receipts',()=>{
  const s=memory();rememberInstallation(s,'A',{id:12345,name:'White'});
  rememberInstallation(s,'A',{id:23456,name:'Black'},12345);
  const choices=faceChoices({registry:readRegistry(s,'A'),receipts:[{id:12345,name:'White'}]});
  assert.deepEqual(choices.map(f=>f.id),[23456]);
});
test('a fresh authoritative watch notification can restore a retired face',()=>{
  const choices=faceChoices({reported:[12345],registry:{faces:[],retired:[12345]},label:()=> 'Restored'});
  assert.deepEqual(choices,[{id:12345,name:'Restored',confirmed:true}]);
});
test('updating a face in place preserves the other known face',()=>{
  const s=memory();rememberInstallation(s,'A',{id:12345,name:'White'});rememberInstallation(s,'A',{id:23456,name:'Black'});
  rememberInstallation(s,'A',{id:12345,name:'White updated'},12345);
  assert.equal(readRegistry(s,'A').faces.length,2);assert.equal(readRegistry(s,'A').retired.length,0);
});
test('malformed local history and invalid protocol sentinel ids do not break the list',()=>{
  const s=memory();s.setItem(REGISTRY_KEY,'broken');assert.deepEqual(readRegistry(s,'A'),{faces:[],retired:[]});
  assert.deepEqual(faceChoices({reported:[0,-1,0xffffffff,NaN,280],label:()=> 'Factory'}).map(f=>f.id),[280]);
});
