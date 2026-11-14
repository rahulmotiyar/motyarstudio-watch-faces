import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {parseBin,assertFlashable} from '../engine/editor/core/format/bin.js';
import {fromLegacy} from '../engine/editor/core/document/doc.js';
import {decodePixels} from '../engine/editor/core/format/pixels-codec.js';
import {faceSeed} from '../face-slots.js';
const root=new URL('../',import.meta.url);
const variants=JSON.parse(fs.readFileSync(new URL('variants.json',root)));
const lite=variants.find(v=>v.theme==='radial-lite');
const bytes=fs.readFileSync(new URL(lite.filename,root));
const {doc}=fromLegacy(parseBin(bytes));
const main=doc.screens.find(s=>s.kind==='main').layers;

test('Lite uses one cropped native seconds rotor and stepped hour/minute image pickers',()=>{
  assertFlashable(bytes);
  const hands=main.filter(l=>l.kind==='hand');assert.equal(hands.length,1);
  const hand=hands[0];assert.equal(hand.meta.source,0x12);assert.equal(hand.meta.max,60);
  assert.equal(hand.meta.w,0);assert.equal(hand.meta.h,0);
  assert.equal(hand.x+hand.pivotX,233);assert.equal(hand.y+hand.pivotY,233);
  const asset=doc.images.get(hand.frames[0]);assert.equal(asset.w,lite.nativeRotatingDiscs.seconds.size);assert.equal(asset.h,asset.w);
  for(const [source,count,size] of [[4,12,lite.nativeRotatingDiscs.hours.size],[11,60,lite.nativeRotatingDiscs.minutes.size]])assert(main.some(l=>l.kind==='image'&&l.meta.source===source&&l.frames.length===count&&doc.images.get(l.frames[0]).w===size));
  const area=asset.w*asset.h,prior=228**2+360**2+466**2;
  assert(area/prior<.55);assert.equal(lite.nativeRotatingDiscs.continuousRotatingPixels,area);
});
test('the compiled seconds rotor contains a numeral at every second position',()=>{
  const spec=lite.nativeRotatingDiscs.seconds;
  assert.deepEqual(spec.labels,Array.from({length:60},(_,i)=>i));
  const hand=main.find(l=>l.kind==='hand'&&l.meta.source===0x12);
  const asset=doc.images.get(hand.frames[0]),pixels=decodePixels(asset);
  for(let n=0;n<60;n++){
    const angle=-n*Math.PI/30,cx=hand.pivotX+Math.cos(angle)*spec.numeralRadius,cy=hand.pivotY+Math.sin(angle)*spec.numeralRadius;
    let ink=0;
    for(let y=Math.round(cy)-6;y<=Math.round(cy)+6;y++)for(let x=Math.round(cx)-6;x<=Math.round(cx)+6;x++){
      if(x<0||y<0||x>=asset.w||y>=asset.h)continue;
      const p=(y*asset.w+x)*4;if(pixels[p+3]>128)ink++;
    }
    assert(ink>3,`second ${n} has no printed numeral`);
  }
});
test('Lite has a separate identity and retains both prior radial designs',()=>{
  for(const theme of ['radial-dark','radial-native']){
    assert(variants.some(v=>v.theme===theme));assert.notEqual(faceSeed(lite.theme),faceSeed(theme));
  }
  assert.equal(lite.experimental,true);assert.equal(lite.nativeRotatingDiscs.hardwareVerified,false);
});
test('the seconds window is transparent over the rotor and has no independent seconds counter',()=>{
  assert.equal(lite.readingLens.readsSecondsFromRotor,true);
  assert.equal(lite.readingLens.magnification,1);
  assert(!main.some(l=>l.kind!=='hand'&&[15,18,114].includes(l.meta?.source)));
  const glass=main.find(l=>l.kind==='image'&&l.meta.source===0&&doc.images.get(l.frames[0]).w===180);
  assert(glass);
  const asset=doc.images.get(glass.frames[0]),pixels=decodePixels(asset);
  assert(pixels[(32*asset.w+148)*4+3]<64,'seconds field must reveal moving ring pixels');
  assert(pixels[(32*asset.w+37)*4+3]>240,'hour field keeps its legible fixed readout');
});
