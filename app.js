import {parseBin,assertFlashable} from './engine/editor/core/format/bin.js';
import {decodePixels} from './engine/editor/core/format/pixels-codec.js';
import {fromLegacy} from './engine/editor/core/document/doc.js';
import {defaultSim} from './engine/editor/core/document/sources.js';
import {renderDoc} from './engine/editor/core/render/render.js';
import {verifyNativeRendering} from './native-verification.js';
import {Watch,NoFreeSlotError} from './engine/device/lib/ble.js';
import {CMD,UUID,dialId} from './engine/device/lib/ble-protocol.js';
import {rememberDial,dialLabel} from './engine/device/lib/catalog-names.js';
import {faceSeed,readRegistry,rememberInstallation,receiptFaces,faceChoices,createFaceSelector} from './face-slots.js?v=radial-lite-v1';
import {groupFaces} from './face-groups.js?v=radial-lite-v1';

// Inspection reads identity and battery without synchronizing the watch's clock.
class InspectWatch extends Watch {
  async fetchInfo(){
    const reply=this.waitFor(CMD.fwRet,5000).catch(()=>null);
    await this.send(CMD.fwGet,new Uint8Array());
    const firmware=await reply;this.firmware=firmware?[...firmware].join('.'):null;
    const serialReply=this.waitFor(CMD.serialRet,4000).catch(()=>null);
    this.serial=null;
    try{
      await this.send(CMD.serialGet,new Uint8Array());
      const p=await serialReply;
      if(p?.length>1&&p[0]<=p.length-1)this.serial=new TextDecoder().decode(p.slice(1,1+p[0]));
    }catch{}
    this.mergeDials();
    try{if(this.chars[UUID.battery])this.battery=(await this.chars[UUID.battery].readValue()).getUint8(0);}catch{}
  }
}

// The default adapter is the real BLE client. Tests supply an isolated in-memory watch.
export async function mountInstaller({root=document,watchFactory=onStatus=>new InspectWatch(onStatus),getDevice=()=>window.__wf,
  bluetoothAvailable=Boolean(navigator.bluetooth),standalone,storage=localStorage,fetchFile=fetch,saveDial=rememberDial}={}){
  const win=root.defaultView,$=id=>root.getElementById(id),canvas=$('face'),ctx=canvas.getContext('2d');
  const response=await fetchFile('variants.json',{cache:'no-store'});
  if(!response.ok)throw Error('The face list is unavailable');
  const variants=await response.json();
  if(!Array.isArray(variants)||!variants.length)throw Error('The face collection is empty');
  const requested=new URLSearchParams(win.location.search).get('theme');
  const collections=groupFaces(variants);
  // Old group links never hide retained faces on a later visit.
  const entryUrl=new URL(win.location.href);entryUrl.searchParams.delete('group');
  win.history.replaceState(null,'',entryUrl);
  let variant=variants.find(v=>v.theme===requested)??variants[0];
  let bytes,doc,store,faceReady=false,connected=false,connecting=false,uploading=false,loading=false;
  const initialFilter='all';
  let opened=root.body.dataset.startFilter==='photo'||Boolean(requested&&variants.some(v=>v.theme===requested)),everConnected=false,info=null,deviceId=null,full=false,receipts=[];
  let aod=false,reference=false,filter=initialFilter,selector,destroyed=false,animationId;
  const sim=defaultSim(),fixed=new Date(2026,0,29,10,8,35).getTime(),tiles=new Map(),sections=new Map();
  const isStandalone=standalone??win.self===win.top;
  const allowed=win.isSecureContext&&bluetoothAvailable&&isStandalone;
  const busy=()=>connecting||uploading||loading;
  const status=(text,error=false)=>{$('status').textContent=text;$('status').dataset.error=String(error);};
  const connectionStatus=(text,error=false)=>{$('connect-status').textContent=text;$('connect-status').dataset.error=String(error);};
  const reports=()=>Promise.all(variants.map(async v=>{
    try{const r=await fetchFile(v.validationFile,{cache:'no-store'});return r.ok?await r.json():null;}catch{return null;}
  }));
  let installationReports;
  function caption(){
    const metrics=!aod&&(variant.metrics?.length||variant.metricSources?.length)?
      connected&&Number.isFinite(watch.battery)?' · live battery; sample weather/activity':' · sample weather/activity':'';
    $('caption').textContent=faceReady?`${aod?'Always-on':'Live'} preview · ${reference?'10:08:35 / date 29':'local time'}${metrics}`:
      loading?'Loading native preview…':'Image preview · installation file unavailable';
  }
  function update(){
    root.body.dataset.connected=String(connected);root.body.dataset.connecting=String(connecting);
    $('workspace').hidden=!opened;
    $('connection-stage').hidden=connected;
    $('connection-stage').classList.toggle('compact',opened);
    $('connect-title').textContent=everConnected?'Reconnect your watch.':'Connect your watch.';
    $('connect').textContent=connecting?'Connecting…':everConnected?'Reconnect watch':'Connect watch';
    $('connect').disabled=!allowed||busy();$('browse').disabled=busy();
    $('disconnect').hidden=!connected;$('disconnect').disabled=busy();
    const battery=Number.isFinite(watch.battery)?` · ${Math.max(0,Math.min(100,watch.battery))}%`:'';
    $('connection-label').textContent=connecting?'Connecting…':connected?`Connected${battery}`:'Not connected';
    $('install').disabled=!faceReady||!connected||busy()||!info?.firmware||!/watch pro 2/i.test(info?.name??'')||selector?.target()==null;
    $('install').textContent=uploading?'Installing…':'Install face';
    $('slot').disabled=!connected||busy()||$('slot').options.length<=1;
    $('retry-face').hidden=faceReady||loading;
    for(const [theme,tile] of tiles){tile.disabled=busy();tile.setAttribute('aria-pressed',String(theme===variant.theme));}
    for(const button of root.querySelectorAll('[data-filter]'))button.disabled=uploading;
    $('reset-filter').disabled=uploading;
  }
  function showSlots(){
    let registry={faces:[],retired:[]};try{if(deviceId)registry=readRegistry(storage,deviceId);}catch{}
    const choices=faceChoices({reported:watch.reportedWf,installed:watch.installedWf,registry,receipts,
      label:id=>dialLabel(id,watch.installedWf.indexOf(id))});
    selector?.update({connected,busy:busy(),choices,full:full||watch.installedWf.length>=watch.capacity});
  }
  function disconnected(){
    connected=false;info=null;deviceId=null;full=false;receipts=[];
    watch.reportedWf=[];watch.installedWf=[];
    $('info').textContent='No watch connected.';
    $('progress-row').hidden=true;
    connectionStatus('Connect again when you’re ready.');
    status(uploading?'The connection ended during transfer. Reconnect and check the watch before trying again.':'Connect your watch to install this face.',uploading);
    showSlots();caption();
  }
  const watch=watchFactory(message=>{
    if(message==='disconnected'){disconnected();return;}
    if(connecting)connectionStatus(message);
    if(uploading)status(message);
  });
  selector=createFaceSelector({select:$('slot'),hint:$('slot-hint'),onChange:update});
  watch.onDials=showSlots;
  function draw(){
    if(destroyed)return;
    if(doc&&opened&&!root.hidden){
      sim.live=!reference;sim.time=fixed;
      sim.battery=connected&&Number.isFinite(watch.battery)?Math.max(0,Math.min(100,watch.battery)):80;
      renderDoc(ctx,doc,store,aod?'aod':'main',sim);
    }
    animationId=win.requestAnimationFrame(draw);
  }
  function showLibrary(){
    let count=0;
    for(const group of collections){
      let visible=0;
      for(const v of group.faces){
        const matchesType=filter==='all'||filter==='analog'&&v.kind!=='digital'||filter==='digital'&&v.kind==='digital'||filter==='photo'&&v.theme.startsWith('photo-');
        const match=matchesType;
        tiles.get(v.theme).hidden=!match;if(match)visible++;
      }
      sections.get(group.id).section.hidden=visible===0;
      sections.get(group.id).count.textContent=`${visible} ${visible===1?'face':'faces'}`;
      count+=visible;
    }
    $('count').textContent=`${count} ${count===1?'face':'faces'}`;$('empty').hidden=count>0;
    for(const b of root.querySelectorAll('[data-filter]'))b.setAttribute('aria-pressed',String(b.dataset.filter===filter));
  }
  for(const group of collections){
    const section=root.createElement('section'),header=root.createElement('div'),heading=root.createElement('h2'),count=root.createElement('span'),grid=root.createElement('div');
    section.className='face-group';section.dataset.group=group.id;heading.id=`group-${group.id}`;heading.textContent=group.name;
    section.setAttribute('aria-labelledby',heading.id);header.className='group-heading';count.className='group-count';grid.className='faces';
    header.append(heading,count);section.append(header,grid);$('faces').append(section);sections.set(group.id,{section,count,grid});
  }
  for(const v of variants){
    const tile=root.createElement('button'),image=root.createElement('img'),name=root.createElement('span');
    tile.type='button';tile.className='face-card';tile.dataset.theme=v.theme;tile.setAttribute('aria-pressed',String(v===variant));
    tile.setAttribute('aria-label',`Preview ${v.name}`);image.src=v.preview;image.alt='';image.width=466;image.height=466;image.loading='lazy';
    name.textContent=v.name;tile.append(image,name);tiles.set(v.theme,tile);
    const group=collections.find(group=>group.faces.includes(v));sections.get(group.id).grid.append(tile);
    tile.addEventListener('click',()=>switchTheme(v.theme));
  }
  for(const button of root.querySelectorAll('[data-filter]'))button.addEventListener('click',()=>{filter=button.dataset.filter;showLibrary();});
  $('reset-filter').addEventListener('click',()=>{filter='all';showLibrary();});
  function openWorkspace(focus=false){opened=true;update();if(focus)$('workspace-title').focus({preventScroll:true});}
  $('browse').addEventListener('click',()=>openWorkspace(true));
  $('mode').addEventListener('click',()=>{aod=!aod;$('mode').setAttribute('aria-pressed',String(aod));caption();});
  $('reference').addEventListener('click',()=>{reference=!reference;$('reference').setAttribute('aria-pressed',String(reference));caption();});
  $('help-open').addEventListener('click',()=>$('help-dialog').showModal());
  $('help-close').addEventListener('click',()=>$('help-dialog').close());
  if(/\/help\.html$/.test(win.location.pathname))$('help-dialog').showModal();
  const note=$('browser-note');
  if(!isStandalone){
    note.hidden=false;note.append('To connect, open this page in its own browser tab. ');
    const link=root.createElement('a');link.href=win.location.href;link.target='_blank';link.rel='noopener';link.textContent='Open page ↗';note.append(link);
  }else if(!allowed){note.hidden=false;note.textContent='Use Google Chrome or Microsoft Edge on a Windows or Mac computer to connect. You can still preview faces here.';}
  connectionStatus(allowed?'Choose your Watch Pro 2 in the Bluetooth window.':'Your browser supports previews. Use desktop Chrome or Edge to connect.');

  async function loadFace(){
    loading=true;faceReady=false;$('face').hidden=true;$('face-poster').hidden=false;$('verification').hidden=true;
    $('face-title').textContent=variant.name;$('face-poster').src=variant.preview;$('face-poster').alt=`${variant.name} image preview`;
    canvas.setAttribute('aria-label',`${variant.name} live watch-face preview`);
    $('description').textContent=variant.description??'';
    $('download').href=variant.filename;$('download').download=variant.filename;$('image-link').href=variant.preview;
    caption();showSlots();
    const cache=new Map();
    try{
      const response=await fetchFile(variant.filename,{cache:'no-store'});
      if(!response.ok)throw Error('The watch-face file is unavailable');
      const nextBytes=new Uint8Array(await response.arrayBuffer());
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',nextBytes)),x=>x.toString(16).padStart(2,'0')).join('');
      if(hash!==variant.sha256)throw Error('The file did not pass its integrity check');
      const parsed=parseBin(nextBytes);assertFlashable(nextBytes);const {doc:nextDoc}=fromLegacy(parsed);
      for(const [id,asset] of nextDoc.images){const px=decodePixels(asset);cache.set(id,{bitmap:await createImageBitmap(new ImageData(px,asset.w,asset.h))});}
      if(new URLSearchParams(win.location.search).has('verify')){
        await verifyNativeRendering(variant,nextDoc,{assets:nextDoc.images,cache},{savePreviews:false});
        $('verification').hidden=false;$('verification').textContent='Native rendering checks passed.';
      }
      for(const item of store?.cache.values()??[])item.bitmap?.close();
      bytes=nextBytes;doc=nextDoc;store={assets:nextDoc.images,cache};faceReady=true;
      $('face').hidden=false;$('face-poster').hidden=true;
    }catch(error){
      for(const item of cache.values())item.bitmap?.close();
      status(`Could not load ${variant.name}: ${error.message}. Reload this face to try again.`,true);
    }finally{loading=false;caption();showSlots();}
  }
  async function switchTheme(next){
    if(busy()||next===variant.theme)return;
    const chosen=variants.find(v=>v.theme===next);if(!chosen)return;
    variant=chosen;$('progress-row').hidden=true;
    const url=new URL(win.location.href);url.searchParams.set('theme',variant.theme);win.history.replaceState(null,'',url);
    status(connected?'Choose its destination, then install.':'Connect your watch to install this face.');
    await loadFace();
    if(win.matchMedia('(max-width:700px)').matches)$('preview-panel').scrollIntoView({block:'start',behavior:win.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
  }
  $('retry-face').addEventListener('click',()=>{if(!busy())loadFace();});
  $('connect').addEventListener('click',async()=>{
    if(busy()||connected||!allowed)return;
    connecting=true;full=false;receipts=[];info=null;deviceId=null;showSlots();connectionStatus('Choose your watch…');
    try{
      watch.reportedWf=[];watch.installedWf=[];watch.serial=null;watch.firmware=null;
      const nextInfo=await watch.connect();const device=getDevice();
      if(!device?.id||!device.gatt?.connected)throw Error('The watch connection ended. Try again');
      info=nextInfo;connected=true;deviceId=device.id;everConnected=true;
      installationReports??=reports();
      receipts=receiptFaces((await installationReports).filter(Boolean),info.name,theme=>dialId(faceSeed(theme)));
      $('info').textContent=`${info.name??'Unknown watch'}\nFirmware ${info.firmware??'not reported'} · Battery ${Number.isFinite(info.battery)?info.battery+'%':'unavailable'}`;
      status(!/watch pro 2/i.test(info.name??'')?'This collection is for Watch Pro 2. Installation is unavailable for this model.':
        !info.firmware?'Firmware could not be read. Disconnect and reconnect before installing.':'Choose a face and its install destination.');
      openWorkspace(true);caption();
    }catch(error){
      if(!connected){info=null;deviceId=null;}
      connectionStatus(error.name==='NotFoundError'?'No watch selected. Keep it nearby, release the phone connection, and try again.':`Could not connect: ${error.message}`,true);
    }finally{connecting=false;showSlots();}
  });
  $('disconnect').addEventListener('click',()=>{if(busy())return;getDevice()?.gatt?.disconnect();disconnected();});
  $('install').addEventListener('click',async()=>{
    if($('install').disabled)return;
    const destination=selector.target();if(destination===null)return;
    const selected=variant,uploadBytes=bytes;
    uploading=true;showSlots();$('progress-row').hidden=false;$('progress').value=0;$('progress-label').textContent='0%';
    status(`Installing ${selected.name}… Keep your watch nearby.`);
    try{
      parseBin(uploadBytes);assertFlashable(uploadBytes);const seed=faceSeed(selected.theme);
      await watch.uploadWatchface(uploadBytes,destination,seed,value=>{
        const percent=Math.max(0,Math.min(100,Math.round(value)));$('progress').value=percent;$('progress-label').textContent=percent+'%';
      });
      if(!connected||!info)throw Error('The watch disconnected before the transfer could be confirmed');
      let historySaved=true;
      try{
        saveDial(dialId(seed),selected.name,canvas.toDataURL(),info.serial);
        rememberInstallation(storage,deviceId,{id:dialId(seed),name:selected.name},destination);
        storage.setItem('motyarstudio_last_test_'+selected.theme,JSON.stringify({connected:true,model:info.name,firmware:info.firmware,uploaded:true,verifiedOnWatch:false,sha256:selected.sha256}));
      }catch{historySaved=false;}
      watch.mergeDials();
      status(`${selected.name} transferred. Check it on your watch. ${historySaved?'You can choose another face here.':'This browser could not save the installation history.'}`);
      $('progress-row').hidden=true;
    }catch(error){
      if(error instanceof NoFreeSlotError)full=true;
      status(error instanceof NoFreeSlotError?'The watch is full. Choose an existing face to replace, then try again.':`Installation failed: ${error.message}`,true);
      $('progress-row').hidden=true;
    }finally{uploading=false;showSlots();}
  });
  const cleanup=()=>{destroyed=true;win.cancelAnimationFrame(animationId);getDevice()?.gatt?.disconnect();for(const item of store?.cache.values()??[])item.bitmap?.close();};
  win.addEventListener('pagehide',cleanup,{once:true});
  showLibrary();showSlots();await loadFace();draw();update();
  return {destroy:cleanup};
}
