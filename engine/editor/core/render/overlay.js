// The editor chrome drawn over a rendered screen: selection boxes, corner and rotate handles,
// a hand's pivot cross and the snap guides. Pure — the page hands in the hitboxes renderDoc
// returned plus its own drag state. The handle geometry lives here too, because where a handle
// is drawn is where shared/drag.ts hit-tests it.
import { framesOf, isPlaced,                                   } from "../document/doc.js";
import { containerOrigin, findLayer, parentOf } from "../document/edits.js";
                                                      
import { CENTER, SCREEN } from "./screen.js";

                               
                                                  

export const HANDLE = 10;
export const CORNERS = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
]         ;

/** Pull a handle back inside the round screen, so a corner off the disc stays grabbable. */
export const onDisc = (x        , y        )        => {
  const dx = x - CENTER,
    dy = y - CENTER,
    d = Math.hypot(dx, dy),
    max = CENTER - HANDLE;

  return d <= max ? { x, y } : { x: CENTER + (dx / d) * max, y: CENTER + (dy / d) * max };
};

const hasArt = (l       )          =>
  framesOf(l).length > 0 || (l.kind === "group" && l.children.some(hasArt));
export const isBareRing = (l       )          => l.kind === "ring" && !l.frames.length;
export const resizable = (l              )          =>
  Boolean(l) && (hasArt(l ) || isBareRing(l )) && !l .locked;
export const rotatable = (l              )          =>
  Boolean(l) && framesOf(l ).length > 0 && !l .locked;
export const rotateHandle = (h          )        => onDisc(h.x + h.w / 2, h.y - HANDLE * 1.5);

export const hitOf = (hits                     , id               ) =>
  id ? hits.findLast((h) => h.layer.id === id) : undefined;

/** Where a placed layer that drew nothing this frame would sit — still worth a dashed box. */
export function ghostBox(doc            , id               ) {
  const l = id && doc ? findLayer(doc, id) : null;

  if (!l || !isPlaced(l) || !l.meta.w || !l.meta.h) return null;
  const o = containerOrigin(doc , parentOf(doc , l.id)?.id ?? null);

  return {
    x: o.x + l.x,
    y: o.y + l.y,
    w: l.meta.w,
    h: l.meta.h,
    ghost: true         ,
  };
}

export const boxOf = (doc            , hits                     , id               ) =>
  hitOf(hits, id) ?? ghostBox(doc, id);

function outline(ctx                          , b     , color        , ghost = false) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash(ghost ? [2, 5] : [6, 4]);
  ctx.strokeRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
  ctx.restore();
}

function drawSelection(
  ctx                          ,
  doc     ,
  hits                     ,
  id               ,
  color        ,
) {
  const h = hitOf(hits, id);

  if (!h) {
    const g = ghostBox(doc, id);

    if (g) outline(ctx, g, color, true);
    return;
  }
  outline(ctx, h, color);
  ctx.save();

  if (h.layer.locked) {
    ctx.restore();
    return;
  }
  if (resizable(h.layer)) {
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    for (const [cx, cy] of CORNERS) {
      const p = onDisc(h.x + cx * h.w, h.y + cy * h.h);

      ctx.fillRect(p.x - HANDLE / 2, p.y - HANDLE / 2, HANDLE, HANDLE);
    }
  }
  // round, and off the box, so it doesn't read as a fifth corner
  if (rotatable(h.layer)) {
    const p = rotateHandle(h);

    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, HANDLE / 2, 0, 2 * Math.PI);
    ctx.fill();
  }
  // a hand rotates around x+pivot — mark that point, it's what the user aims when centring
  if (h.layer.kind === "hand") {
    const px = h.layer.x + h.layer.pivotX,
      py = h.layer.y + h.layer.pivotY;

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(px - 8, py);
    ctx.lineTo(px + 8, py);
    ctx.moveTo(px, py - 8);
    ctx.lineTo(px, py + 8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGuides(
  ctx                          ,
  guides        ,
  style                                  ,
) {
  if (!guides.x.length && !guides.y.length) return;
  ctx.save();
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width;
  ctx.beginPath();
  for (const x of guides.x) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, SCREEN);
  }
  for (const y of guides.y) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(SCREEN, y + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

                          
           
                            
                     
                             
                 
                                                  
                
                                          
 

export function drawOverlay(ctx                          , o         ) {
  // extra picks get a plain box; the primary one carries the handles and the pivot cross
  for (const l of o.selected.slice(1)) {
    const b = boxOf(o.doc, o.hits, l.id);

    if (b) outline(ctx, b, o.color, "ghost" in b);
  }
  drawSelection(ctx, o.doc, o.hits, o.sel, o.color);
  drawGuides(ctx, o.guides, o.guide);
}
