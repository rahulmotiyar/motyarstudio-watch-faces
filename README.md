# MotyarStudio Watch Faces

Open the shared installer: **https://rahulmotiyar.github.io/motyarstudio-watch-faces/**

Use desktop Google Chrome or Microsoft Edge on Windows or Mac. No Python, installation or GitHub sign-in is needed. Temporarily release your watch's phone Bluetooth connection, connect the watch once, then choose a face and its install destination. Browsing, groups, previews, inline help and repeated installations keep the same connection. Reloading or closing the tab disconnects it.

This archive contains 25 native 466 × 466 faces, previews, always-on screens, the installer, complete corresponding source, artwork assets and licenses.

| Face | Revision | File |
| --- | --- | --- |
| Braun Round | 7 | `braun-round.bin` |
| Braun Black | 7 | `braun-black.bin` |
| MotyarStudio | 9 | `motyarstudio.bin` |
| Xeric Mint | 2 | `xeric-mint.bin` |
| Seiko Ivory | 1 | `seiko-ivory.bin` |
| Sternglas Chrono | 3 | `sternglas.bin` |
| Seiko Orange | 1 | `seiko-orange.bin` |
| Sliding Numbers Light | 2 | `sliding-light.bin` |
| Sliding Numbers Dark | 2 | `sliding-dark.bin` |
| MotiyarStudios Radial Instruments | 8 | `radial-dark.bin` |
| Ceramic Type | 3 | `typographic.bin` |
| Weather Minimal | 2 | `weather-minimal.bin` |
| Weather Arc | 3 | `weather-arc.bin` |
| Orbit Minimal | 2 | `orbit.bin` |
| Zenith Ice | 3 | `zenith-ice.bin` |
| MotyarStudio Dark | 5 | `motyarstudio-dark.bin` |
| Casio World | 2 | `casio-world.bin` |
| Braun Subdials | 4 | `braun-subdials.bin` |
| Skagen Dark | 4 | `skagen-dark.bin` |
| MotyarStudio Sans | 3 | `motyarstudio-sans.bin` |
| MotyarStudio Sans Dark | 3 | `motyarstudio-sans-dark.bin` |
| Submariner Diamond | 1 | `photo-submariner-diamond.bin` |
| Daytona Pearl Photo | 1 | `photo-daytona-pearl.bin` |
| Chronograph Ivory Photo | 1 | `photo-chrono-ivory.bin` |
| Tissot Le Locle | 1 | `photo-tissot-lelocle.bin` |

## This revision

- A minimal single-page installer starts with connection, then reveals the face library beside a live preview and assignment panel. Five groups organize the selection: Braun, MotyarStudio, Chronographs & Instruments, Digital & Weather, and Photographic Dials. Each group has its own section and count. The group dropdown was removed; old group URLs open the complete collection. MotiyarStudios Radial Instruments is in the MotyarStudio group. Optional face-type filters work without changing the selected preview, install destination or watch connection. The destination stays above Install. Always-on preview, reference time and help work inline. Optional preview browsing works without a watch. Earlier install.html and help.html entry links open this same application. The application has simulated-watch flow checks, including grouping, complete inventory, two consecutive uploads on one connection, late destination lists, empty storage, missing files, model/firmware checks, chooser cancellation and connection loss during transfer. These checks do not send files to a physical watch.
- The photographic selection contains 4 faces: Submariner Diamond, Daytona Pearl Photo, Chronograph Ivory Photo, Tissot Le Locle. These backgrounds use the supplied photographs directly. Source images, crop boxes, original pivots and native register geometry are included in source/photo-dials/. Printed chronograph registers show clock readings on their original scales, rather than an interactive stopwatch. Calendar apertures use native watch values. The other photographic designs were removed from the local gallery, native collection, artwork selection and this package.

- Braun Round/Black now use the Subdials-style aperture with thinner walls, softer inset shading and lighter dial/hand shadows; the large date type is retained.
- Aligned Braun Subdials needles, a lower seconds well and a date on the four-o'clock ray, equidistant between the two neighboring wells.
- Original Skagen wordmark, shifted left; outer 3, 6, 9 and 12 numerals.
- All four MotyarStudio calendar faces use a darker date disc that reads beneath the main dial, retaining the soft inner shading, red weekday with white text and 1px gray split. The light editions retain 93% of the dial's date-paper tone; the dark editions retain 82%. Branding remains bold “Motyar” and light “Studio”. Orange seconds hands extend past the center hub; calendar shading stays inside the apertures.
- MotyarStudio Sans and MotyarStudio Sans Dark are separate copies using Helvetica Neue Bold for the hour numerals and date, matching the weekday typeface. Their outer minute/second track uses 48 small dots, four between each pair of hour labels. Their original geometric counterparts remain available with separate native identities.
- Broad, contrasting Zenith hands over the unchanged supplied dial image.
- Sternglas hour labels are now 21px; its date and MECHA·QUARTZ/CHRONO block are raised together.
- MotiyarStudios Radial Instruments retains its original artwork and install identity under its new name. Three native anticlockwise discs show hours, minutes and seconds through a clear lens that reveals and refracts the underlying disc boundaries. Current numerals receive precomputed convex distortion with up to 24% optical gain; surface-normal lighting supplies a fine variable rim and soft reflections, without oval strokes. The inner disc has twelve positions; the AOD uses the same 12-hour cycle. Centered two-line branding reads bold “motyar” over light “studios”. Image-picker discs still step by hour/minute/second; smooth anticlockwise disc rotation is not verified in the native format.
- Sliding Numbers uses slightly smaller hours, larger minute numerals and a dot scale aligned to the hour numerals: prominent hour boundaries, medium half-hour markers, and subtle ten-minute markers. The MINUTES label and Diagonal Tracks face are removed.
- Ceramic time type is slightly reduced to 160/104px while retaining aligned baselines and compact date spacing, with a filled cloud/sun.
- Weather Arc groups a filled cloud/sun and temperature on the left, steps/pulse on the right, and the live battery at bottom center. Other weather layouts and Zenith are retained from the preceding refinement.

## Real watch data and previews

Installed faces use native watch values. Weather faces use stock-exercised temperature source 0x5f (including negative and missing readings), battery source 0x24, and native steps/pulse where shown. Weather may need to sync through the phone app. Weather-condition icons are illustrative: no supported condition selector has been verified in this native format. A cloud icon is not a live forecast claim.

Browser weather/activity previews use sample values. When a watch is connected, the installer's battery preview uses its Bluetooth battery reading. The watch itself supplies the installed face's values. Subdials display clock readings rather than an interactive stopwatch. Casio AMS remains a fixed Amsterdam target. Zenith preserves the original photo and uses a repeating 30-minute right register.

## Optional local use and rebuilding

To use the local installer instead of the website, run `python3 source/serve.py` (Windows: `py -3 source/serve.py`) from this extracted folder, then open http://127.0.0.1:48762/ in desktop Chrome or Edge.

To reproduce the native files from the bundled RGBA assets with Node.js 22.13 or newer:

```sh
node source/build.mjs
node source/build-collection.mjs
node source/build-expanded.mjs
node --test tests/face-slots.test.mjs
```

Artwork regeneration additionally uses Pillow and the macOS fonts referenced by the generators; fonts are not redistributed. Source generators can create additional family artwork, but the packaged expanded compiler restricts native outputs to this manifest's faces. The `hosted-installer-source/` folder contains the public website's HTML/JS modifications; copy the root native files, previews, variants and engine alongside those files to serve that version as static HTTPS.

## Verification and credits

The exact compiled files passed CRC, decode, round-trip and browser rendering checks. Radial direction and window wrap are checked against the actual rendered index markers. Each report separates software validation from physical-watch testing. Hardware appearance and battery life must still be checked on the watch; no watch was flashed while validating this revision. Creator hardware records are omitted.

Native format/renderer/Bluetooth code: FMC, pinned commit cfc340c95ddd18adbf1e04a9e3613cad145c2dc3. Installer and FMC-derived code: AGPL-3.0-only; retain LICENSE, source/fmc/LICENSE and corresponding source when sharing. These are AI-generated personal adaptations, unofficial and unendorsed. Brand marks and the supplied Zenith photo retain their owners' rights. Braun/Skagen artwork provenance and Casio/Natural Earth credits are included in source/. Zenith's supplied photo, crop and pivots are included.
