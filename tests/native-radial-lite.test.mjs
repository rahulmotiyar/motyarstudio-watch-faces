import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {parseBin,assertFlashable} from '../engine/editor/core/format/bin.js';
import {fromLegacy} from '../engine/editor/core/document/doc.js';
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
  const asset=doc.images.get(hand.frames[0]);assert.equal(asset.w,456);assert.equal(asset.h,456);
  for(const [source,count,size] of [[4,12,228],[11,60,360]])assert(main.some(l=>l.kind==='image'&&l.meta.source===source&&l.frames.length===count&&doc.images.get(l.frames[0]).w===size));
  const area=asset.w*asset.h,prior=228**2+360**2+466**2;
  assert(area/prior<.53);assert.equal(lite.nativeRotatingDiscs.continuousRotatingPixels,area);
});
test('Lite has a separate identity and retains both prior radial designs',()=>{
  for(const theme of ['radial-dark','radial-native']){
    assert(variants.some(v=>v.theme===theme));assert.notEqual(faceSeed(lite.theme),faceSeed(theme));
  }
  assert.equal(lite.experimental,true);assert.equal(lite.nativeRotatingDiscs.hardwareVerified,false);
});
