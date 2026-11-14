import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {parseBin,assertFlashable} from '../engine/editor/core/format/bin.js';
import {fromLegacy} from '../engine/editor/core/document/doc.js';
import {faceSeed} from '../face-slots.js';
const root=new URL('../',import.meta.url);
const variants=JSON.parse(fs.readFileSync(new URL('variants.json',root)));
const trial=variants.find(v=>v.theme==='radial-native');
const bytes=fs.readFileSync(new URL(trial.filename,root));
const {doc}=fromLegacy(parseBin(bytes));
const hands=doc.screens.find(s=>s.kind==='main').layers.filter(l=>l.kind==='hand');

test('native radial trial keeps a distinct install identity beside the original',()=>{
  assertFlashable(bytes);
  assert(variants.some(v=>v.theme==='radial-dark'));
  assert.notEqual(faceSeed('radial-native'),faceSeed('radial-dark'));
  assert.equal(trial.experimental,true);
  assert.equal(trial.nativeRotatingDiscs.direction,'clockwise');
  assert.equal(trial.nativeRotatingDiscs.hardwareVerified,false);
});
test('three rings compile as rotating images using stock clock-hand sources',()=>{
  assert.deepEqual(hands.map(l=>l.meta.source),[0x0a,0x0e,0x12]);
  for(const hand of hands){
    assert.equal(hand.frames.length,1);
    assert.equal(hand.meta.max,60);
    assert.equal(hand.meta.w,0);
    assert.equal(hand.meta.h,0);
    assert.equal(hand.x+hand.pivotX,233);
    assert.equal(hand.y+hand.pivotY,233);
  }
  const outer=doc.images.get(hands[2].frames[0]);
  assert.equal(outer.w,466);assert.equal(outer.h,466);
});
