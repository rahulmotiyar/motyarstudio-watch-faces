import {defaultSim} from './engine/editor/core/document/sources.js';
import {renderDoc} from './engine/editor/core/render/render.js';

// Exercise the exact compiled document, including every image-picker boundary.
export async function verifyNativeRendering(variant,doc,store,{savePreviews=true}={}){
  const canvas=new OffscreenCanvas(466,466),ctx=canvas.getContext('2d');
  const sample=(kind,h=10,m=8,s=35,day=29,extra={})=>{
    const sim={...defaultSim(),live:false,time:new Date(2026,0,day,h,m,s).getTime(),...extra};
    renderDoc(ctx,doc,store,kind,sim);return new Uint8ClampedArray(ctx.getImageData(0,0,466,466).data);
  };
  const check=(value,message)=>{if(!value)throw Error(variant.name+': '+message);};
  const difference=(a,b,box={x:0,y:0,w:466,h:466})=>{
    let n=0;for(let y=box.y;y<box.y+box.h;y++)for(let x=box.x;x<box.x+box.w;x++){
      const p=(y*466+x)*4;if(a[p]!==b[p]||a[p+1]!==b[p+1]||a[p+2]!==b[p+2])n++;
    }return n;
  };
  const baseline=sample('main'),main=doc.screens.find(s=>s.kind==='main').layers;
  const sources=[...new Set(main.map(l=>l.meta?.source).filter(Boolean))];
  for(const day of [1,9,10,31]){
    const other=sample('main',10,8,35,day);
    if(variant.hasDate!==false){
      const box=variant.dateBox??{x:220,y:342,w:26,h:28},inside=difference(baseline,other,box);
      check(inside>8,`day ${day} did not change the calendar`);
      check(difference(baseline,other)===inside,'calendar change altered unrelated artwork');
    }else check(difference(baseline,other)===0,'date changed a face with no calendar');
  }
  const seconds=variant.supportsSeconds!==false;
  if(seconds)check(difference(baseline,sample('main',10,8,36))>25,'seconds display did not move');
  check(difference(baseline,sample('main',10,9))>25,'minute display did not move');
  check(difference(baseline,sample('main',11,8))>25,'hour display did not move');
  for(const [h,m,s] of [[0,0,0],[12,0,0],[23,59,59]]){
    const frame=sample('main',h,m,s);let lit=0;for(let p=0;p<frame.length;p+=4)if(frame[p]+frame[p+1]+frame[p+2]>30)lit++;
    check(lit>350,'clock picker boundary rendered blank');
  }
  if(variant.clockRegions){
    const box=region=>({x:region[0],y:region[1],w:region[2],h:region[3]});
    check(difference(sample('main',0,8),sample('main',1,8),box(variant.clockRegions.hours))>25,'hour picker boundary is static');
    check(difference(sample('main',10,0),sample('main',10,59),box(variant.clockRegions.minutes))>25,'minute picker boundary is static');
    if(variant.clockRegions.seconds)check(difference(sample('main',10,8,0),sample('main',10,8,59),box(variant.clockRegions.seconds))>25,'seconds picker boundary is static');
  }
  let photographicGeometryChecked=false;
  if(variant.artworkMode==='supplied-image'&&variant.photoMainSources){
    const mainScreen=doc.screens.find(s=>s.kind==='main');
    const atPivot=(layer,center)=>layer.kind==='hand'&&layer.x+layer.pivotX===center[0]&&layer.y+layer.pivotY===center[1];
    const secondHands=main.filter(l=>l.kind==='hand'&&l.meta.source===0x12);
    check(secondHands.length===2,'main seconds hand and shadow must use stock rotating-hand source 0x12');
    check(secondHands.every(l=>l.meta.max===60&&l.meta.sub===0),'main seconds hand does not match stock rotation metadata');
    check(!main.some(l=>l.kind==='hand'&&l.meta.source===0x0f),'unverified raw-seconds rotation could freeze on the watch');
    for(const source of variant.photoMainSources)
      check(main.some(l=>atPivot(l,variant.mainPivot)&&l.meta.source===source),'main hand misses the photographed pivot');
    const isolated=(layer,h=6,m=0,s=0)=>{
      const sim={...defaultSim(),live:false,time:new Date(2026,0,29,h,m,s).getTime()};
      renderDoc(ctx,{...doc,screens:[{...mainScreen,layers:[layer]}]},store,'main',sim);
      return new Uint8ClampedArray(ctx.getImageData(0,0,466,466).data);
    };
    for(const register of variant.photoRegisters??[]){
      let layer;
      if(register.widget==='hand'){
        layer=main.find(l=>atPivot(l,register.center)&&l.meta.source===register.source);
        check(layer,register.name+' pointer misses its photographed pivot');
      }else{
        layer=main.find(l=>{
          if(l.kind!=='image'||l.meta.source!==register.source||l.frames.length!==60)return false;
          const asset=doc.images.get(l.frames[0]);
          return l.x+asset.w/2===register.center[0]&&l.y+asset.h/2===register.center[1];
        });
        check(layer,register.name+' picker misses its photographed pivot');
      }
      const first=isolated(layer);
      if(register.kind==='minute30'){
        check(difference(first,isolated(layer,6,30))===0,register.name+' does not repeat on its printed 30-minute scale');
        check(difference(first,isolated(layer,6,15))>10,register.name+' minute pointer does not move');
      }else if(register.kind==='hour12'){
        check(difference(first,isolated(layer,18))===0,register.name+' does not repeat on its printed 12-hour scale');
        check(difference(first,isolated(layer,9))>10,register.name+' hour pointer does not move');
      }else{
        const other=register.kind==='second'?isolated(layer,6,0,30):isolated(layer,6,30,0);
        check(difference(first,other)>10,register.name+' pointer does not move');
      }
    }
    if(variant.datePointerLayout){
      check(main.some(l=>l.kind==='image'&&l.meta.source===23&&l.frames.length===32),'date pointer lacks its 31-day native frame set');
    }
    photographicGeometryChecked=true;
  }
  let nativeRotatingDiscsChecked=false;
  if(variant.nativeRotatingDiscs){
    const layout=variant.nativeRotatingDiscs,mainScreen=doc.screens.find(s=>s.kind==='main');
    const isolated=(layer,h=0,m=0,s=0)=>{
      const sim={...defaultSim(),live:false,time:new Date(2026,0,29,h,m,0).getTime()+s*1000};
      renderDoc(ctx,{...doc,screens:[{...mainScreen,layers:[layer]}]},store,'main',sim);
      return new Uint8ClampedArray(ctx.getImageData(0,0,466,466).data);
    };
    for(const name of ['hours','minutes','seconds']){
      const spec=layout[name];
      if(spec.widget==='picker'){
        const layer=main.find(l=>l.kind==='image'&&l.meta.source===spec.source&&l.frames.length===spec.frames&&doc.images.get(l.frames[0])?.w===spec.size);
        check(layer,name+' lightweight ring lacks its native image picker');
        if(name==='hours'){
          check(difference(isolated(layer),isolated(layer,1))>25,'hour picker does not advance');
          check(difference(isolated(layer),isolated(layer,0,30))===0,'hour picker unexpectedly changes within an hour');
        }else{
          check(difference(isolated(layer),isolated(layer,0,1))>25,'minute picker does not advance');
          check(difference(isolated(layer),isolated(layer,0,0,30))===0,'minute picker unexpectedly changes within a minute');
        }
        continue;
      }
      const layer=main.find(l=>l.kind==='hand'&&l.meta.source===spec.source);
      check(layer&&layer.frames.length===1,name+' disc is not a single native rotating image');
      check(layer.meta.w===0&&layer.meta.h===0&&layer.meta.max===60,'full-size rotor has background rather than stock hand metadata');
      check(layer.x+layer.pivotX===233&&layer.y+layer.pivotY===233,name+' rotor pivot is off-center');
      if(name==='hours')check(difference(isolated(layer),isolated(layer,0,30))>25,'hour rotor did not move within an hour');
      if(name==='minutes')check(difference(isolated(layer),isolated(layer,0,0,30))>25,'minute rotor did not move within a minute');
      if(name==='seconds'){
        check(layer.meta.source===0x12,'seconds rotor does not use the stock smooth-hand source');
        check(difference(isolated(layer),isolated(layer,0,0,.5))>25,'seconds rotor has no fractional-second preview motion');
        const marker=s=>{
          const frame=isolated(layer,0,0,s);let sx=0,sy=0,n=0;
          for(let y=0;y<466;y++)for(let x=0;x<466;x++){
            if(Math.abs(Math.hypot(x-233,y-233)-spec.zeroMarkerRadius)>4)continue;
            const p=(y*466+x)*4,r=frame[p],g=frame[p+1],b=frame[p+2];
            if(frame[p+3]>160&&r<130&&g>r+40&&b>r+70){sx+=x;sy+=y;n++;}
          }
          check(n>3,'native rotor zero marker is missing');return [sx/n-233,sy/n-233];
        };
        for(const [start,end] of [[0,.5],[59.5,.5]]){
          const a=marker(start),b=marker(end),angle=Math.atan2(a[0]*b[1]-a[1]*b[0],a[0]*b[0]+a[1]*b[1]);
          const expected=(end<start?60+end-start:end-start)*Math.PI/30;
          check(Math.abs(angle-expected)<.015,`native rotor angle ${angle.toFixed(4)} differs from ${expected.toFixed(4)} at ${start}→${end}; markers ${a.map(n=>n.toFixed(1))} / ${b.map(n=>n.toFixed(1))}`);
        }
      }
    }
    nativeRotatingDiscsChecked=true;
  }
  let discsRotateAnticlockwise=false;
  if(variant.discLayout){
    const layout=variant.discLayout,[cx,cy]=layout.center;
    for(const name of ['hours','minutes','seconds']){
      const spec=layout[name];if(!spec)continue;
      const {source,frames:count}=spec;
      const layer=main.find(l=>l.kind==='image'&&l.meta?.source===source&&l.frames.length===count);
      check(layer,'rotating '+name+' disc lacks its native '+count+'-state picker');
      const marker=frame=>{
        let sx=0,sy=0,count=0;
        for(let y=0;y<466;y++)for(let x=0;x<466;x++){
          if(x>=330&&Math.abs(y-cy)<40)continue;
          if(Math.abs(Math.hypot(x-cx,y-cy)-spec.zeroMarkerRadius)>4)continue;
          const p=(y*466+x)*4,r=frame[p],g=frame[p+1],b=frame[p+2];
          // Separate the cyan index from the blue-grey type after RGB4444 quantization.
          if(r<125&&g>r+45&&b>r+70){sx+=x;sy+=y;count++;}
        }
        check(count>3,name+' disc index marker is missing');return [sx/count-cx,cy-sy/count];
      };
      const atValue=value=>name==='hours'?sample('main',value,8,35):name==='minutes'?sample('main',6,value,35):sample('main',6,8,value);
      const a=marker(atValue(10)),b=marker(atValue(11));
      const turn=Math.atan2(a[0]*b[1]-a[1]*b[0],a[0]*b[0]+a[1]*b[1]);
      const expected=Math.abs(spec.degreesPerStep??layout.degreesPerStep)*Math.PI/180;
      check(Math.abs(turn-expected)<.035,name+' disc does not rotate the expected amount anticlockwise');
      const [x,y,w,h]=spec.readoutROI;
      check(difference(atValue(0),atValue(count-1),{x,y,w,h})>25,name+' window does not show the wrap boundary');
    }
    discsRotateAnticlockwise=true;
  }
  for(const layer of main.filter(l=>l.kind==='image'&&l.frames.length>1)){
    if(layer.meta.source===4)check([12,24].includes(layer.frames.length),'hour picker has an incomplete frame set');
    if([11,15,114].includes(layer.meta.source))check(layer.frames.length===60,'minute/seconds picker has an incomplete frame set');
  }
  if(variant.hourFormat?.startsWith('24')){
    check(doc.screens.find(s=>s.kind==='aod').layers.some(l=>l.meta?.source===4),'always-on hour format differs from the main face');
  }
  if(variant.hourFormat==='12-hour disc'){
    const [x,y,w,h]=variant.clockRegions.hours,box={x,y,w,h};
    for(const hour of [0,1,11]){
      check(difference(sample('main',hour,8,35),sample('main',hour+12,8,35),box)===0,'hour disc does not repeat after twelve hours');
      check(difference(sample('main',hour,8,35,29,{is24h:false}),sample('main',hour,8,35,29,{is24h:true}),box)===0,'hour disc depends on watch time preference');
      check(difference(sample('aod',hour,8,35),sample('aod',hour+12,8,35))===0,'always-on hour format differs from the main face');
    }
    check(main.some(l=>l.kind==='image'&&l.meta.source===4&&l.frames.length===12),'12-hour disc lacks its twelve-frame cycle');
  }
  const metricChecks=[];
  for(const [source,metric,a,b] of [[25,'steps',1234,9876],[26,'hr',60,120],[36,'battery',10,90],[48,'battery',10,90],[54,'temp',-5,25],[95,'temp',-5,25]]){
    if(!sources.includes(source))continue;
    check(difference(sample('main',10,8,35,29,{[metric]:a}),sample('main',10,8,35,29,{[metric]:b}))>3,metric+' reading is static');
    metricChecks.push(metric);
  }
  if(sources.includes(54)||sources.includes(95)){
    check(difference(sample('main',10,8,35,29,{temp:5}),sample('main',10,8,35,29,{temp:-5}))>2,'negative temperature has no minus sign');
    check(difference(sample('main',10,8,35,29,{temp:-400}),sample('main',10,8,35,29,{temp:1000}))===0,'missing temperature fallbacks differ');
  }
  const dark=sample('aod');let lit=0;for(let p=0;p<dark.length;p+=4)if(dark[p]+dark[p+1]+dark[p+2]>40)lit++;
  check(lit/(466*466)<.05,'always-on screen lights too much of the panel');
  check(difference(dark,sample('aod',10,8,35,31))===0,'always-on screen changes with the date');
  check(!doc.screens.find(s=>s.kind==='aod').layers.some(l=>l.kind==='hand'&&[15,18,114].includes(l.meta?.source)),'always-on screen includes a seconds hand');
  if(variant.subdialLayout){
    const sub=variant.subdialLayout,at=(x,y,source)=>main.find(l=>l.kind==='hand'&&l.x+l.pivotX===x&&l.y+l.pivotY===y&&l.meta.source===source);
    check(at(...sub.minute,14)&&at(...sub.second,114),'subdial pointers are misaligned');
    if(sub.hour24)check(difference(sample('main',0,8),sample('main',12,8))>20,'24-hour dial does not distinguish midnight and noon');
    if(sub.minute30){
      const [x,y]=sub.minute30,box={x:x-48,y:y-48,w:96,h:96};
      check(difference(sample('main',6,29),sample('main',6,30),box)>20,'30-minute register did not move at its boundary');
      check(difference(sample('main',6,0),sample('main',6,30),box)===0,'30-minute register did not repeat after 30 minutes');
      check(main.some(l=>l.kind==='image'&&l.meta.source===11&&l.frames.length===60),'30-minute register lacks its native minute picker');
    }
  }
  if(variant.digitalLayout?.ampm){
    const [x,y,w,h]=variant.digitalLayout.ampm,[hx,hy,hw,hh]=variant.digitalLayout.hours;
    check(difference(sample('main',10,8,35,29,{is24h:false}),sample('main',22,8,35,29,{is24h:false}),{x,y,w,h})>5,'AM/PM indicator did not change');
    check(difference(sample('main',22,8,35,29,{is24h:false}),sample('main',22,8,35,29,{is24h:true}),{x:hx,y:hy,w:hw,h:hh})>100,'12/24-hour format ignored');
  }
  const result={nativeFileLoaded:true,hasDate:variant.hasDate!==false,dateIsolated:true,secondsMove:seconds,
    minuteAndHourMove:true,clockBoundaryValues:true,metricChecks:[...new Set(metricChecks)],
    ...(photographicGeometryChecked?{photographedPivotsChecked:true,printedRegisterScalesChecked:true}:{}),
    ...(nativeRotatingDiscsChecked?{nativeRotatingDiscsChecked:true,nativeSecondsSubsecondPreview:true,nativeClockwiseRotation:true,hardwareMotionVerified:false}:{}),
    ...(discsRotateAnticlockwise?{discsRotateAnticlockwise:true,discWindowWrapChecked:true,hoursDiscRotates:!!variant.discLayout?.hours}:{}),
    ...(variant.hourFormat==='12-hour disc'?{twelveHourCycle:true,timePreferenceIndependent:true,alwaysOnTwelveHourCycle:true}:{}),
    ...((sources.includes(54)||sources.includes(95))?{negativeTemperatureSign:true,missingTemperatureFallback:true}:{}),aodLitFraction:lit/(466*466),passed:true};
  return result;
}
