// Device-scoped history supplements the watch's incomplete/late face notifications.
export const REGISTRY_KEY='braun_face_installations_v1';
const FACE_SEEDS={white:'braun-round-pro2-v1',black:'braun-black-pro2-v2',casio:'cmf-casio-world-v1',
  'braun-subdials':'cmf-braun-subdials-v1',skagen:'cmf-skagen-dark-v1'};
for(const theme of ['bai-clock','motyarstudio-dark','motyarstudio-sans','motyarstudio-sans-dark','xeric-mint','seiko-ivory','sternglas','seiko-orange','sliding-light','sliding-dark',
  'radial-dark','typographic','weather-minimal','weather-arc','orbit','zenith-ice'])FACE_SEEDS[theme]='cmf-'+theme+'-v1';
for(const theme of ["photo-submariner-diamond", "photo-daytona-pearl", "photo-chrono-ivory", "photo-tissot-lelocle"])FACE_SEEDS[theme]='cmf-'+theme+'-v1';
export const faceSeed=theme=>{
  if(!FACE_SEEDS[theme])throw Error('Unknown watch face');
  return FACE_SEEDS[theme];
};
const validId=id=>Number.isInteger(id)&&id>0&&id<0xffffffff;
export function readRegistry(storage,deviceId){
  try{
    const record=JSON.parse(storage.getItem(REGISTRY_KEY)||'{}')[deviceId];
    return {faces:(record?.faces??[]).filter(f=>validId(f.id)),retired:(record?.retired??[]).filter(validId)};
  }catch{return {faces:[],retired:[]};}
}
export function rememberInstallation(storage,deviceId,face,replacedId=0){
  const previous=readRegistry(storage,deviceId);
  const retired=new Set(previous.retired);
  if(replacedId&&replacedId!==face.id)retired.add(replacedId);
  retired.delete(face.id);
  const faces=previous.faces.filter(f=>f.id!==face.id&&f.id!==replacedId);
  faces.push({id:face.id,name:face.name});
  let all={};try{all=JSON.parse(storage.getItem(REGISTRY_KEY)||'{}');}catch{}
  storage.setItem(REGISTRY_KEY,JSON.stringify({...all,[deviceId]:{faces,retired:[...retired]}}));
}
export function receiptFaces(reports,model,idForTheme){
  if(!model)return [];
  return reports.flatMap(report=>{
    const receipt=[report?.hardware,report?.previousRevisionHardware].find(r=>r?.uploaded&&r.model===model);
    return receipt?[{id:idForTheme(report.theme),name:report.name}]:[];
  });
}
export function faceChoices({reported=[],installed=[],registry={faces:[],retired:[]},receipts=[],label=id=>`Face ${id}`}){
  const choices=new Map(),reportedIds=new Set(reported),retired=new Set(registry.retired);
  const cached=new Map([...receipts,...registry.faces].map(f=>[f.id,f]));
  for(const id of [...reported,...installed]){
    if(validId(id)&&(reportedIds.has(id)||!retired.has(id)))
      choices.set(id,{id,name:cached.get(id)?.name??label(id),confirmed:reportedIds.has(id)});
  }
  for(const face of cached.values()){
    if(validId(face.id)&&!retired.has(face.id)&&!choices.has(face.id))choices.set(face.id,{...face,confirmed:false});
  }
  return [...choices.values()];
}

// The selector is visible before installation; late lists preserve an explicit choice.
export function createFaceSelector({select,hint,onChange=()=>{}}){
  let state={connected:false,busy:false,full:false,choices:[]},signature='';
  function update(next){
    state={...state,...next};
    const options=[];
    if(state.connected){
      for(const face of state.choices)options.push({value:String(face.id),label:face.name+(face.confirmed?'':' (previous install)')});
      if(!state.full)options.push({value:'new',label:'Add as a new face (if space is available)'});
    }
    const nextSignature=JSON.stringify([state.connected,options]);
    if(nextSignature!==signature){
      const chosen=select.value;
      const placeholder=select.ownerDocument.createElement('option');placeholder.value='';
      placeholder.textContent=state.connected?'Choose a face…':'Connect watch to load faces';
      const nodes=[placeholder,...options.map(o=>{
        const option=select.ownerDocument.createElement('option');option.value=o.value;option.textContent=o.label;return option;
      })];
      select.replaceChildren(...nodes);
      if(state.connected&&options.some(o=>o.value===chosen))select.value=chosen;
      signature=nextSignature;
    }
    select.disabled=!state.connected||state.busy||(!state.choices.length&&state.full);
    hint.textContent=!state.connected?'Connect your watch to load its faces.':
      !state.choices.length?'The watch has not sent its face list. Disconnect and reconnect to reload it.':
      state.full?'The watch is full. Choose an existing face to replace.':
      'Choose the existing face to replace, or explicitly add a new face.';
    onChange();
  }
  function target(){
    if(!state.connected||state.busy||!select.value)return null;
    if(select.value==='new')return state.full?null:0;
    const id=Number(select.value);return state.choices.some(f=>f.id===id)?id:null;
  }
  select.addEventListener('change',onChange);
  update({});
  return {update,target};
}
