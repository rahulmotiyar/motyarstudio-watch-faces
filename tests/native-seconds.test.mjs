import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {parseBin,assertFlashable} from '../engine/editor/core/format/bin.js';
import {fromLegacy} from '../engine/editor/core/document/doc.js';

const root=new URL('../',import.meta.url);
const variants=JSON.parse(fs.readFileSync(new URL('variants.json',root)));
const load=variant=>{
  const bytes=fs.readFileSync(new URL(variant.filename,root));
  assertFlashable(bytes);
  return fromLegacy(parseBin(bytes)).doc;
};
const flatten=layers=>layers.flatMap(l=>[l,...(l.children?flatten(l.children):[])]);

test('no compiled rotating hand uses the seconds source that froze on the watch',()=>{
  for(const variant of variants){
    const doc=load(variant);
    for(const screen of doc.screens)for(const layer of flatten(screen.layers)){
      if(layer.kind==='hand')assert.notEqual(layer.meta.source,0x0f,variant.name);
    }
  }
});

for(const variant of variants.filter(v=>v.photoMainSources)){
  test(variant.name+' uses stock smooth-hand encoding for its main seconds hand and shadow',()=>{
    const main=load(variant).screens.find(s=>s.kind==='main').layers;
    const hands=main.filter(l=>l.kind==='hand'&&l.meta.source===0x12);
    assert.equal(hands.length,2,'both the visible hand and shadow need the corrected source');
    for(const hand of hands){
      assert.equal(hand.meta.max,60);
      assert.equal(hand.meta.sub,0);
      assert.equal(hand.meta.w,0);
      assert.equal(hand.meta.h,0);
      assert.equal(hand.frames.length,1);
    }
    assert(hands.some(l=>l.x+l.pivotX===variant.mainPivot[0]&&l.y+l.pivotY===variant.mainPivot[1]),'hand must keep the photographed pivot');
  });
}
