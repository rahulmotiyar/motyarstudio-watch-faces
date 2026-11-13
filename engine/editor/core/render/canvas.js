// Canvas-side primitives shared by the renderer: its types, and how a Resource becomes
// something drawImage can take.
                                                    
                                                                              

                                                                               
                                                     

                        
            
            
 

                       
            
            
 

                                          
                 
 

/** Doc-side hit: the layer itself, not the TLV node it came from. */
                                               
               
 

/** What the Doc renderer draws from: the file's assets plus the editor's decoded-pixel cache,
 *  which is deliberately NOT part of the document (see ImageCache). */
                             
                                                    
                                                   
 

/** Same precedence as `bmp`: an accent recolor wins over the baked pixels. */
export const bmpOf = (s            , id          )                       => {
  const c = id == null ? undefined : s.cache.get(id);

  return c?.accent ?? c?.bitmap;
};

export const ringBmpOf = (s            , id          )                       => {
  const b = bmpOf(s, id);

  return !b || (id != null && s.assets.get(id)?.cf !== 4) ? b : maskNearBlack(b               );
};

/** accentBitmap (if set — see accentFx in editor.model.ts) takes priority over the baked one. */
export const bmp = (res            , i        )                       =>
  res[i]?.accentBitmap ?? res[i]?.bitmap;

// cf=4 (RGB565, no alpha channel — see wf.ts's decodePixels) ring/arc fill images bake their
// "empty" background as opaque black, which is fine for a genuine full-bleed background image
// but wrong for a ring meant to sit transparently over other content: confirmed on Dichotomy,
// where this exact bitmap — drawn as a literal opaque rectangle by drawSector/the 0x80 bar
// path — blotted out a "BATT" text label sharing its group, and clipped into the background's
// own baked "10" hour-marker glyph at the ring's edge. Chroma-key near-black to transparent,
// lazily once per bitmap (keyed on the bitmap itself, not the resource, so an accent-recolored
// swap naturally invalidates it). Only cf=4 is touched — cf=5 already carries real alpha.
const ringMaskCache = new WeakMap                              ();

function maskNearBlack(b             )                  {
  let masked = ringMaskCache.get(b);

  if (!masked) {
    masked = new OffscreenCanvas(b.width, b.height);
    const mctx = masked.getContext("2d") ;

    mctx.drawImage(b, 0, 0);
    const px = mctx.getImageData(0, 0, b.width, b.height);
    const d = px.data;

    for (let k = 0; k < d.length; k += 4) {
      if (d[k] < 12 && d[k + 1] < 12 && d[k + 2] < 12) d[k + 3] = 0;
    }
    mctx.putImageData(px, 0, 0);
    ringMaskCache.set(b, masked);
  }
  return masked;
}

export function ringBmp(res            , i        )                       {
  const b = bmp(res, i);

  return !b || res[i]?.cf !== 4 ? b : maskNearBlack(b               );
}
