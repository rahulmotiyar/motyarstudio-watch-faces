const groups=[
  {id:'braun',name:'Braun',themes:['white','black','braun-subdials']},
  {id:'motyarstudio',name:'MotyarStudio',themes:['bai-clock','motyarstudio-dark','motyarstudio-sans','motyarstudio-sans-dark']},
  {id:'instruments',name:'Chronographs & Instruments',themes:['skagen','xeric-mint','zenith-ice','sternglas','radial-dark','seiko-ivory','seiko-orange']},
  {id:'digital-weather',name:'Digital & Weather',themes:['casio','typographic','weather-minimal','weather-arc','orbit','sliding-light','sliding-dark','diagonal']},
  {id:'photographic',name:'Photographic Dials',themes:['photo-submariner-diamond','photo-daytona-pearl','photo-chrono-ivory','photo-tissot-lelocle']},
  {id:'other',name:'Other Faces',themes:[]},
];

// Keep unfamiliar future designs visible instead of silently excluding them.
export function groupFaces(variants){
  const collections=groups.map(group=>({...group,faces:[]}));
  for(const face of variants){
    const collection=collections.find(group=>group.themes.includes(face.theme))??collections.at(-1);
    collection.faces.push(face);
  }
  return collections.filter(group=>group.faces.length);
}
