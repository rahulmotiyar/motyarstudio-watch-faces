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
  }
  for(const layer of main.filter(l=>l.kind==='image'&&l.frames.length>1)){
    if(layer.meta.source===4)check([12,24].includes(layer.frames.length),'hour picker has an incomplete frame set');
    if([11,15,114].includes(layer.meta.source))check(layer.frames.length===60,'minute/seconds picker has an incomplete frame set');
  }
  if(variant.hourFormat?.startsWith('24')){
    check(doc.screens.find(s=>s.kind==='aod').layers.some(l=>l.meta?.source===4),'always-on hour format differs from the main face');
  }
  const metricChecks=[];
  for(const [source,metric,a,b] of [[25,'steps',1234,9876],[26,'hr',60,120],[36,'battery',10,90],[48,'battery',10,90],[54,'temp',-5,25]]){
    if(!sources.includes(source))continue;
    check(difference(sample('main',10,8,35,29,{[metric]:a}),sample('main',10,8,35,29,{[metric]:b}))>3,metric+' reading is static');
    metricChecks.push(metric);
  }
  if(sources.includes(54)){
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
  // Hosted checks are browser-only: no images or device records are sent to a server.
  const result={nativeFileLoaded:true,hasDate:variant.hasDate!==false,dateIsolated:true,secondsMove:seconds,
    minuteAndHourMove:true,clockBoundaryValues:true,metricChecks:[...new Set(metricChecks)],
    ...(sources.includes(54)?{negativeTemperatureSign:true,missingTemperatureFallback:true}:{}),aodLitFraction:lit/(466*466),passed:true};
  return result;
}
