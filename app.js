import {parseBin,assertFlashable} from './engine/editor/core/format/bin.js';
import {decodePixels} from './engine/editor/core/format/pixels-codec.js';
import {fromLegacy} from './engine/editor/core/document/doc.js';
import {defaultSim} from './engine/editor/core/document/sources.js';
import {renderDoc} from './engine/editor/core/render/render.js';
import {verifyNativeRendering} from './native-verification.js';
import {Watch,NoFreeSlotError} from './engine/device/lib/ble.js';
import {CMD,UUID} from './engine/device/lib/ble-protocol.js';
import {rememberDial,dialLabel} from './engine/device/lib/catalog-names.js';
import {dialId} from './engine/device/lib/ble-protocol.js';
import {faceSeed,readRegistry,rememberInstallation,receiptFaces,faceChoices,createFaceSelector} from './face-slots.js';

const $=id=>document.getElementById(id);
const canvas=$('face'),ctx=canvas.getContext('2d');
let bytes,doc,store,sim=defaultSim(),aod=false,reference=false,connected=false,busy=false,info=null,faceReady=false;
const variants=await (await fetch('variants.json',{cache:'no-store'})).json();
const requestedTheme=new URLSearchParams(location.search).get('theme');
let theme=variants.some(v=>v.theme===requestedTheme)?requestedTheme:'white';
let variant=variants.find(v=>v.theme===theme);
$('face-choice').replaceChildren(...variants.map(v=>new Option(v.name,v.theme)));$('face-choice').value=theme;
const fixed=new Date(2026,0,29,10,8,35).getTime();
let deviceId=null,full=false,selector;
const installationReports=Promise.all(variants.map(v=>v.validationFile??(v.theme==='black'?'black-validation.json':'validation.json')).map(async file=>{
  try{return await (await fetch(file,{cache:'no-store'})).json();}catch{return null;}
}));
let receipts=[];

// Deliberately query only firmware and battery during inspection. Upstream fetchInfo also
// synchronizes the watch time; inspecting a device here does not change its clock.
class InspectWatch extends Watch {
  async fetchInfo(){
    const reply=this.waitFor(CMD.fwRet,5000).catch(()=>null);
    await this.send(CMD.fwGet,new Uint8Array());
    try{this.firmware=[...await reply].join('.');}catch{this.firmware=null;}
    const serialReply=this.waitFor(CMD.serialRet,4000).catch(()=>null);
    try{
      await this.send(CMD.serialGet,new Uint8Array());
      const p=await serialReply;
      if(p?.length>1&&p[0]<=p.length-1)this.serial=new TextDecoder().decode(p.slice(1,1+p[0]));
    }catch{this.serial=null;}
    this.mergeDials();
    try{if(this.chars[UUID.battery])this.battery=(await this.chars[UUID.battery].readValue()).getUint8(0);}catch{}
  }
}
const watch=new InspectWatch(message=>{
  $('status').textContent=message;
  if(message==='disconnected'){connected=false;info=null;deviceId=null;showSlots();$('info').textContent='No watch connected.';}
});
selector=createFaceSelector({select:$('slot'),hint:$('slot-hint'),onChange:updateButtons});
watch.onDials=()=>showSlots();
function updateButtons(){
  $('connect').disabled=connected||busy||!navigator.bluetooth;
  $('disconnect').disabled=!connected||busy;
  $('face-choice').disabled=busy;
  $('install').disabled=!faceReady||!connected||busy||!info?.firmware||!/watch pro 2/i.test(info?.name??'')||selector?.target()==null;
  $('slot').disabled=!connected||busy||($('slot').options.length<=1);
}
function showSlots(){
  const registry=deviceId?readRegistry(localStorage,deviceId):{faces:[],retired:[]};
  const choices=faceChoices({reported:watch.reportedWf,installed:watch.installedWf,registry,receipts,
    label:id=>dialLabel(id,watch.installedWf.indexOf(id))});
  selector?.update({connected,busy,choices,full:full||watch.installedWf.length>=watch.capacity});
}
const note=$('browser-note');
if(window.self!==window.top){
  note.hidden=false;note.append('For Bluetooth, open this installer in its own tab. ');
  const link=document.createElement('a');link.href=location.href;link.target='_blank';link.rel='noopener';link.textContent='Open installer ↗';note.append(link);
}else if(!window.isSecureContext||!navigator.bluetooth){
  note.hidden=false;note.textContent='To connect your watch, open this website in Google Chrome or Microsoft Edge on a Windows or Mac computer.';
  $('status').textContent='This browser cannot connect to Bluetooth devices. Your previews still work.';
}

function draw(){
  if(doc){sim.live=!reference;sim.time=fixed;renderDoc(ctx,doc,store,aod?'aod':'main',sim);}
  requestAnimationFrame(draw);
}
$('mode').addEventListener('click',()=>{aod=!aod;$('mode').setAttribute('aria-pressed',String(aod));setCaption();});
$('reference').addEventListener('click',()=>{reference=!reference;$('reference').setAttribute('aria-pressed',String(reference));setCaption();});
function setCaption(){
  const metrics=!aod&&(variant.metrics?.length||variant.metricSources?.length)?' · sample sensor readings':'';
  $('caption').textContent=`${aod?'Always-on':'Native face'} preview · ${reference?'10:08:35 / date 29':'live local time'}${metrics}`;
}
$('face-choice').addEventListener('change',()=>switchTheme($('face-choice').value));
async function switchTheme(next){
  if(busy||next===theme)return;
  busy=true;updateButtons();theme=next;variant=variants.find(v=>v.theme===theme);
  const url=new URL(location.href);url.searchParams.set('theme',theme);history.replaceState(null,'',url);
  try{await loadFace();}catch(e){$('status').textContent=`Face load failed: ${e.message}`;}
  finally{busy=false;showSlots();}
}

$('connect').addEventListener('click',async()=>{
  busy=true;updateButtons();
  try{
    full=false;receipts=[];info=null;deviceId=null;
    watch.reportedWf=[];watch.installedWf=[];watch.serial=null;watch.firmware=null;
    info=await watch.connect();connected=true;deviceId=window.__wf.id;
    receipts=receiptFaces((await installationReports).filter(Boolean),info.name,theme=>dialId(faceSeed(theme)));
    showSlots();
    $('info').textContent=`${info.name??'Unknown model'}\nFirmware: ${info.firmware??'not reported'} · Battery: ${info.battery??'?'}%`;
    $('firmware-note').textContent='Choose the face you want to replace before installing.';
    $('status').textContent=!/watch pro 2/i.test(info.name??'')?'This face targets Watch Pro 2. Installation is unavailable for this model.':
      !info.firmware?'Could not read firmware. Reconnect before installing.':'Connected. Choose a face to replace, then click Install face.';
    await recordHardware({connected:true,firmware:info.firmware,model:info.name,uploaded:false,verifiedOnWatch:false,sha256:variant.sha256});
  }catch(e){$('status').textContent=e.name==='NotFoundError'?'No watch selected. Keep the watch nearby and release the phone connection, then try again.':`Connection: ${e.message}`;}
  finally{busy=false;showSlots();}
});
$('disconnect').addEventListener('click',()=>{window.__wf?.gatt?.disconnect();connected=false;info=null;deviceId=null;showSlots();});
window.addEventListener('pagehide',()=>window.__wf?.gatt?.disconnect());

$('install').addEventListener('click',async()=>{
  if($('install').disabled)return;
  const slot=selector.target();
  if(slot===null)return;
  busy=true;updateButtons();$('progress').hidden=false;
  $('progress').value=0;
  try{
    parseBin(bytes);assertFlashable(bytes);
    const seed=faceSeed(theme);
    await watch.uploadWatchface(bytes,slot,seed,n=>{$('progress').value=n;});
    rememberDial(dialId(seed),variant.name,canvas.toDataURL(),info.serial);
    rememberInstallation(localStorage,deviceId,{id:dialId(seed),name:variant.name},slot);
    watch.mergeDials();
    $('status').textContent='Transfer accepted by the watch. Check that the hands move and the date is correct on its screen.';
    await recordHardware({connected:true,firmware:info.firmware,model:info.name,uploaded:true,verifiedOnWatch:false,sha256:variant.sha256});
  }catch(e){
    $('status').textContent=e instanceof NoFreeSlotError?'The watch is full. Choose a watch face to replace, then try again.':`Install: ${e.message}`;
    if(e instanceof NoFreeSlotError)full=true;
    $('progress').hidden=true;
  }finally{busy=false;showSlots();}
});
async function recordHardware(value){
  try{localStorage.setItem('motyarstudio_last_test_'+theme,JSON.stringify(value));}catch{}
}

async function verifyRendering(){
  await verifyNativeRendering(variant,doc,store);
  $('verification').hidden=false;$('verification').textContent='Native rendering checks passed: live clock, calendar, metrics and dark always-on screen.';
}
async function loadFace(){
  faceReady=false;$('verification').hidden=true;updateButtons();
  const nextBytes=new Uint8Array(await (await fetch(variant.filename,{cache:'no-store'})).arrayBuffer());
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',nextBytes)),x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==variant.sha256)throw Error('File changed. Reload this page before installing.');
  const parsed=parseBin(nextBytes);assertFlashable(nextBytes);const {doc:nextDoc}=fromLegacy(parsed);
  const cache=new Map();
  for(const [id,asset] of nextDoc.images){
    const px=decodePixels(asset);
    cache.set(id,{bitmap:await createImageBitmap(new ImageData(px,asset.w,asset.h))});
  }
  for(const item of store?.cache.values()??[])item.bitmap?.close();
  bytes=nextBytes;doc=nextDoc;store={assets:nextDoc.images,cache};
  $('face-title').textContent=variant.name;document.title=`${variant.name} · CMF Watch Pro 2`;
  canvas.setAttribute('aria-label',`${variant.name} native watch-face preview`);
  $('description').textContent=variant.description??(theme==='black'?'A charcoal dial with silver-white hands, yellow seconds and a larger recessed date window.':
    'A softly shaded white dial, floating black hands, yellow seconds and a larger recessed date window.');
  if(variant.hourFormat?.startsWith('24'))$('description').textContent+=' Uses a 24-hour display.';
  $('face-choice').value=theme;
  $('download').href=variant.filename;$('image-link').href=variant.preview??(theme==='black'?'black-preview.png':'preview.png');
  setCaption();
  if(new URLSearchParams(location.search).has('verify'))await verifyRendering();
  faceReady=true;
}
try{
  await loadFace();draw();updateButtons();
}catch(e){$('status').textContent=`Face load failed: ${e.message}`;throw e;}
