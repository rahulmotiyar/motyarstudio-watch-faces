// The raw shape of a .bin watchface: the tree exactly as the file stores it, plus the byte
// primitives every codec in this folder needs. This is the parser's output, not the editor's
// model — `Doc` (core/document/doc.ts) is what the editor edits, and fromLegacy/toLegacy bridge
// the two. Format: docs/cmf-protocol.md §9.6a.

                           
             
            
            
                   
                       
                                                                                          
                                                                                             
                                                                                                 
                                                                                   
                          
                                                                                   
                                                                             
                             
                                                                                           
                                                                                             
                                                           
                                                                                   
 

                           
              
                    
                
               
             
             
                
                
                  
                   
                    
                
                  
                  
                 
                                                                                          
                                                                                            
                                     
 

                       
               
                   
                      
                        
 

export const TAG = {
  root: 0x20,
  main: 0x21,
  aod: 0x22,
  name: 0x86,
  preview: 0x28,
  struct: 0x01,
  bind: 0x02,
  pivot: 0x05,
  pvStruct: 0x08,
  fmt: 0x40,
  frame: 0x48,
  image: 0x30,
  number: 0x60,
  group: 0x68,
  hand: 0x70,
  /** Progress-ring spec, in two flavours: `arc` carries its own radius, `arcClipped` takes one
   *  from the ring image it is clipped to. See core/render/arc.ts for the body. */
  arc: 0x5a,
  arcClipped: 0x5b,
  /** A widget slot's body: index, the metrics it offers, and the active one. */
  slot: 0x5f,
}         ;

// 0x0a/0x0e were swapped until this fix — confirmed by comparing hand geometry in
// Analog__287__Simple_Dial.bin: the hand tagged 0x0e is the long/thin one (pivot-to-tip
// 163px), 0x0a is the short/thick one (122px). Minute hands are longer than hour hands.
export const handKinds                         = {
  0x0a: "hour",
  0x0e: "minute",
  0x72: "second",
  0x12: "second",
};

export const hex = (d            ) => [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
export const unhex = (s        ) =>
  new Uint8Array((s.match(/../g) || []).map((b) => parseInt(b, 16)));
export const u16 = (d            , o        ) => d[o] | (d[o + 1] << 8);
// widget x/y are int16 (LVGL lv_coord_t): 10 nodes across the corpus sit at 0xfffe/0xfffc/…,
// i.e. a couple of pixels off the left/top edge, not at x=65534
export const i16 = (d            , o        ) => (u16(d, o) << 16) >> 16;
export const u32 = (d            , o        ) =>
  (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;
