# Red-Beard Weather

Free NWS weather at a glance in Obsidian Desktop and iOS: condition symbols, current temperature, the next few hours, a 24-hour temperature/precipitation graphic, seven daily ranges, official alerts, and portable Markdown snapshots. Defaults to Peoria, Illinois. No server, Docker container, account, API key, or subscription is needed.

## Install

Copy `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/red-beard-weather/` in your vault. Enable **Red-Beard Weather** in Community plugins. Use the weather ribbon icon or **Red-Beard Weather: Open weather** from the command palette. The plugin works independently of the Red-Beard Dashboard.

With Red-Beard Dashboard **1.3.6 or newer**, Weather registers a module button, overview widget, and **New Weather Snapshot** quick action using the host's public extension APIs. Earlier dashboard versions support the module and widget; the snapshot command remains available in the palette. Existing widget visibility and layout preferences are respected. Registering and removing the add-on preserves the dashboard's saved preferences.

## Use

- The dashboard widget leads with current temperature and condition, today's available high/low, wind, hourly precipitation chance, and three upcoming hours. Station metadata, diagnostics, legal paragraphs, and operating explanations are omitted. Observation time and relevant stale/unknown-alert warnings remain visible. **Forecast** opens the full view.
- Open Weather for a temperature curve, precipitation probability bars, hourly condition symbols, and seven compact daily ranges. The view contains graphics and summaries rather than an hourly table. Expand a day or alert to read the official wording. **Weather details & sources** holds station provenance, provider links, and per-feed freshness/error detail.
- **Refresh** checks for eligible updates, respecting provider cache lifetimes and rate-limit retry instructions; it does not bypass them.
- **New Weather Snapshot** checks weather, then creates a new note under `Weather/Snapshots`. Notes contain location, timestamps, units, provider links, conditions, forecasts, alerts, and a **My notes** section. Existing notes are never rewritten. Filenames use a UTC timestamp and random suffix; displayed times use the configured time zone.
- Settings configure display name, latitude/longitude, U.S./metric units, IANA time zone, snapshot folder, and automatic refresh. Changing storage folders never moves files. Changing coordinates or units starts a separate cache to avoid mixing locations.

Graphics use existing NWS data: a missing temperature breaks the curve, a missing precipitation probability stays unknown, and a missing daily high/low stays a dash. The precipitation graphic has a 0–100% probability scale, separate from temperature. Daily ranges combine the available daytime high and nighttime low for the location's calendar day. No probabilities or missing values are invented. Numeric text alternatives accompany the chart. Refresh preserves focused controls, expanded forecasts/alerts, and scroll position; weather refresh does not rebuild the surrounding dashboard.

## Data, freshness, and privacy

Data comes directly from `https://api.weather.gov` using an identifying User-Agent. Coordinates resolve NWS forecast endpoints and nearby observation stations; the first usable observation from the first three nearby stations is used, falling back to the newest available among those stations. Station observations describe the station location, not a sensor at your home. The plugin never requests GPS permission.

Weather refreshes every 15 minutes and alerts every five minutes while Obsidian is visible, with startup/resume checks and a manual command. Longer upstream cache lifetimes are honored. Disabling automatic refresh stops periodic updates; startup/resume and manual checks remain available. Only supported NWS U.S. locations work; unsupported coordinates show an actionable provider error.

An offline cache persists in the plugin's `data.json` alongside settings. This can sync with your vault. No analytics, credentials, advertising services, or tracking endpoints are used. Periodic checks do not rewrite unchanged cache files. The cache is loaded on restart, with expired content visibly marked stale if refresh fails. Observations older than two hours and forecasts issued more than twelve hours ago are marked stale. Expired forecast periods and alerts are excluded. Unknown quantities remain unavailable rather than becoming zero. An empty stale alert list never implies that there are no active alerts.

The plugin does not run while Obsidian is closed and cannot provide closed-app notifications. Saved snapshots are historical records and never update. The NWS API is a public service with rate limits and no guaranteed timely delivery; use official alert channels for time-sensitive warnings.

## Commercial use and licensing

Original plugin code is MIT licensed; it may be sold or included in commercial software with the license notice retained. NWS API data is free for any purpose, including commercial use, and public-domain NWS content remains public domain. Preserve attribution and distinguish modified/derived material from official NWS products. Red-Beard Weather is independent and does not imply NOAA/NWS endorsement. No paid or personal-use-only weather provider is included.

- [NWS API documentation and usage policy](https://www.weather.gov/documentation/services-web-api)
- [NWS reuse terms and disclaimer](https://www.weather.gov/disclaimer)

The production bundle depends on the Obsidian host API, with no bundled third-party runtime library. Development tooling and its notices are recorded by `package-lock.json`; Obsidian itself has its own terms.

## Development and verification

Use Node.js 22 or newer, then run `npm ci` and `npm run verify` (type checking, fixture tests, build, and release/mobile portability checks). Run `npm audit` to inspect development dependencies.

Tests cover endpoint discovery, independent alerts during forecast outages, HTTP caching and conditional requests, rate limits, offline restarts, null quantities, station fallback, alert expiry, Chicago DST, snapshot collision safety and note preservation, and concurrent refreshes. Presentation/DOM tests also cover day/night symbols, local daily ranges, graphical null/zero handling, compact copy, alert states, accessible numerical equivalents, and interaction preservation. `happy-dom` is development-only and is excluded from the runtime bundle. Build success and responsive desktop inspection do not establish real iOS behavior; actual device verification is tracked separately.

The version 1.0.0 assessment and its resulting changes are recorded in [the design review](docs/design-review.md). Product priorities and visual rules are recorded in `PRODUCT.md` and `DESIGN.md`.

Future custom forecasting or continuous collection can use an optional service. Neither is part of this version.
