# MotyarStudio watch-face website

Static HTTPS gallery and Bluetooth installer for the eight-face CMF Watch Pro 2 bundle.
Serve this repository root as the site root. No runtime, database or API server is required.
The recipient opens the hosted website in desktop Chrome or Edge on Windows or Mac.

Bluetooth transfers occur directly from the browser to the selected watch. Device records
and installation history stay in browser local storage. This website has no device-data
upload endpoints. Compiled face hashes are checked before transfer.

The original complete source and AGPL license are provided in the download linked from
the site footer. Modified hosted installer source is included in this repository.

Checks: all eight native-file browser renders passed, all 13 replacement-selector browser
checks passed and all 10 Node selector/history checks passed. No watch was flashed during
website validation. Native face hashes match the original eight-face release.

This project can be hosted at a subdirectory (for example GitHub Pages) without rewriting
paths. No Python, package install, database, account or local server is required for visitors.
