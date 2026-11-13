// id → { group, name }; generated from stock file names Group__ID__Name.bin
// (see watchfaces/files; regeneration — a python one-liner is in git history, not needed, the set is static)
import stock from "./stock-dials.json" with { type: "json" };

const dials = stock                                                   ;

// A side-loaded face gets a random id, so no catalog can ever name it — but we do know its name
// AND what it looks like at flash time. Remember both, so the watch's bare id list reads as real
// watchfaces. This covers marketplace faces for free: they reach the watch through the editor
// like everything else, so there's nothing to join on a market record id here.
// ponytail: plain localStorage, never pruned — an overwritten id just leaves a dead entry that
// nothing looks up. A thumbnail is ~5 KB, so a few dozen faces stay well inside the quota.
const NAME_STORE = "fmc_dial_names";

                   
               
                   
                                                                                                
                                                                                          
                                                                                             
                                                                                            
                                                                                                
                                                                                               
                                           
                  
 
// localStorage is the single source of truth and the parsed copy is only a cache of one exact
// string — a lazily-filled cache that never invalidated meant a reader who ran before the first
// flash kept answering "unknown" forever (two module instances under HMR are enough to arrange
// that, and so is a second tab). Comparing the raw string costs nothing next to re-parsing it.
let raw = "";
let cache                          = {};

const flashed = () => {
  const cur = localStorage.getItem(NAME_STORE) || "{}";

  if (cur !== raw) {
    raw = cur;
    try {
      // entries written before previews existed are a bare name string
      cache = Object.fromEntries(
        Object.entries(JSON.parse(cur)                           ).map(([k, v]) => [
          k,
          typeof v === "string" ? { name: v } : v,
        ]),
      )                           ;
    } catch {
      cache = {};
    }
  }
  return cache;
};

const write = (next                         ) => {
  raw = JSON.stringify(next);
  localStorage.setItem(NAME_STORE, raw);
  cache = JSON.parse(raw)                           ;
};

export const rememberDial = (id        , name        , preview         , serial                ) =>
  write({ ...flashed(), [id]: { name, preview, serial: serial || undefined } });

// that dial no longer occupies a slot on that watch — deleted on the watch, replaced by the
// upload that just landed, or the record outlived a factory reset. Only the claim goes: the name
// and the preview cost nothing and still label the id if it turns out to be there after all,
// which matters because the claim is also dropped on refusals we can't fully explain.
export const unclaimDial = (id        ) => {
  const e = flashed()[id];

  if (e?.serial) write({ ...flashed(), [id]: { ...e, serial: undefined } });
};

// ids this browser put on that particular watch — what a055 leaves out of the installed list
export const flashedOn = (serial        ) =>
  Object.entries(flashed())
    .filter(([, v]) => v.serial === serial)
    .map(([id]) => Number(id));

// i = position in the list the watch reported, which is the order its own carousel shows them
// in — the only handle a user has on a dial nothing can name. Real hardware reports ids like
// 22139654 that hit neither map (gallery faces installed from the official app keep their names
// in that app, the watch sends ids only), so this fallback is the common case, not the corner.
export const dialLabel = (id        , i        ) =>
  dials[id]?.name || flashed()[id]?.name || `Slot ${i + 1}`;

export const dialPreview = (id        ) => flashed()[id]?.preview;

export const dialTitle = (id        ) => {
  const group = dials[id]?.group || (flashed()[id] ? "Flashed from here" : "");

  return group ? `${group} · id ${id}` : `id ${id}`;
};
