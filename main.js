/* Red-Beard Weather - MIT; NWS data remains public domain. */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => WeatherPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/dashboard.ts
var import_obsidian = require("obsidian");

// src/utils.ts
var DEFAULT_SETTINGS = {
  settingsVersion: 1,
  locationName: "Peoria, IL",
  latitude: 40.6936,
  longitude: -89.589,
  units: "us",
  timeZone: "America/Chicago",
  snapshotFolder: "Weather/Snapshots",
  autoRefresh: true
};
var MINUTE = 6e4;
var WEATHER_INTERVAL = 15 * MINUTE;
var ALERT_INTERVAL = 5 * MINUTE;
function safeFolder(value) {
  const raw = value.trim().replace(/\\/g, "/");
  if (!raw || raw.startsWith("/") || /[:\x00-\x1f]/.test(raw)) throw new Error("Use a vault-relative folder, such as Weather/Snapshots.");
  const parts = raw.split("/").filter(Boolean);
  if (parts.some((p) => p === "." || p === ".." || p.startsWith(".") || /[<>"|?*]/.test(p))) throw new Error("Choose a regular vault folder without traversal or reserved characters.");
  return parts.join("/");
}
function validateSettings(s) {
  if (!Number.isFinite(s.latitude) || s.latitude < -90 || s.latitude > 90 || !Number.isFinite(s.longitude) || s.longitude < -180 || s.longitude > 180) throw new Error("Enter valid latitude and longitude coordinates.");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: s.timeZone }).format();
  } catch (e) {
    throw new Error("Enter an IANA time zone, such as America/Chicago.");
  }
  if (!s.locationName.trim()) throw new Error("Enter a location name.");
  return { ...s, settingsVersion: 1, units: s.units === "si" ? "si" : "us", locationName: s.locationName.trim(), snapshotFolder: safeFolder(s.snapshotFolder) };
}
function normalizeSettings(value) {
  try {
    return validateSettings({ ...DEFAULT_SETTINGS, ...value && typeof value === "object" ? value : {} });
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}
function locationKey(s) {
  return `${s.latitude.toFixed(4)},${s.longitude.toFixed(4)}:${s.units}`;
}
function apiUrl(value) {
  if (typeof value !== "string") throw new Error("NWS did not provide the requested endpoint.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "api.weather.gov" || url.port || url.username || url.password) throw new Error("Refused an unexpected provider address.");
  return url.toString();
}
function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function formatTime(value, zone) {
  if (value === void 0 || !Number.isFinite(new Date(value).getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", { timeZone: zone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}
function temperature(c, units) {
  return c === null ? "Unavailable" : `${Math.round(units === "us" ? c * 9 / 5 + 32 : c)}\xB0${units === "us" ? "F" : "C"}`;
}
function activeAlerts(alerts, now) {
  return alerts.filter((a) => {
    const expiry = Date.parse(a.expires), end = Date.parse(a.ends);
    return Number.isFinite(expiry) && expiry > now && (!Number.isFinite(end) || end > now);
  });
}
function currentPeriods(forecast, now, hourly = false) {
  var _a;
  return (_a = forecast == null ? void 0 : forecast.periods.filter((p) => Date.parse(p.endTime) > now && (!hourly || Date.parse(p.startTime) < now + 24 * 60 * MINUTE)).slice(0, hourly ? 25 : 14)) != null ? _a : [];
}
function feedStatus(feed, now, kind) {
  if (!feed.data) return feed.error ? `Unavailable \u2014 ${feed.error}` : "Not yet available";
  let old = feed.expiresAt === void 0 || now >= feed.expiresAt;
  if (kind === "observation") old || (old = now - Date.parse(feed.data.timestamp) > 2 * 60 * MINUTE);
  if (kind === "forecast" || kind === "hourly") {
    const f = feed.data;
    old || (old = !currentPeriods(f, now).length || !Number.isFinite(Date.parse(f.updated)) || now - Date.parse(f.updated) > 12 * 60 * MINUTE);
  }
  return feed.error || old ? `Stale cached data${feed.error ? ` \u2014 ${feed.error}` : ""}` : "Current";
}
function markdownText(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/([\\`*_{}\[\]#|!])/g, "\\$1");
}

// src/dashboard.ts
var WEATHER_VIEW = "red-beard-weather-view";
function action(parent, label, icon, run, primary = false) {
  const button = parent.createEl("button", { cls: primary ? "mod-cta" : "", attr: { "aria-label": label } });
  (0, import_obsidian.setIcon)(button.createSpan({ cls: "rbw-button-icon" }), icon);
  button.createSpan({ text: label });
  button.onclick = run;
  return button;
}
function renderWeather(container, plugin, compact = false) {
  var _a, _b, _c, _d;
  const scroll = container.scrollTop;
  container.empty();
  container.addClass("rbw");
  container.toggleClass("rbw-compact", compact);
  const { state } = plugin.service, s = plugin.settings, now = Date.now(), time = (v) => formatTime(v, s.timeZone);
  const header = container.createDiv({ cls: "rbw-header" }), title = header.createDiv();
  title.createEl(compact ? "h3" : "h1", { text: s.locationName });
  title.createEl("p", { cls: "rbw-muted", text: "National Weather Service" });
  const actions = header.createDiv({ cls: "rbw-actions" });
  const refresh = action(actions, state.refreshing ? "Refreshing\u2026" : "Refresh", "refresh-cw", () => void plugin.refresh(true));
  refresh.disabled = state.refreshing;
  if (compact) action(actions, "Open Weather", "cloud-sun", () => void plugin.openDashboard());
  else {
    action(actions, "New Weather Snapshot", "file-plus", () => void plugin.saveSnapshot(), true);
    action(actions, "Settings", "settings", () => plugin.openSettings());
  }
  const freshness = (parent, feed, kind) => {
    const status = feedStatus(feed, now, kind), line = parent.createEl("p", { cls: `rbw-freshness ${status === "Current" ? "" : "rbw-stale"}`, text: `${status} \xB7 Checked ${time(feed.checkedAt)}` });
    line.setAttribute("role", "status");
  };
  const o = state.observation.data, current = container.createEl("section", { cls: "rbw-current", attr: { "aria-label": "Current observations" } });
  current.createDiv({ cls: "rbw-temperature", text: o ? temperature(o.temperatureC, s.units) : "\u2014" });
  const copy = current.createDiv();
  copy.createEl("p", { cls: "rbw-condition", text: (o == null ? void 0 : o.description) || "Conditions unavailable" });
  if (o) {
    copy.createEl("p", { cls: "rbw-muted", text: `${o.stationName} (${o.station}) \xB7 Observed ${time(o.timestamp)}` });
    copy.createEl("p", { text: `Humidity ${o.humidity === null ? "unavailable" : `${Math.round(o.humidity)}%`} \xB7 Wind ${o.windKmh === null ? "unavailable" : `${Math.round(s.units === "us" ? o.windKmh / 1.609344 : o.windKmh)} ${s.units === "us" ? "mph" : "km/h"}`}` });
  }
  freshness(copy, state.observation, "observation");
  const alertSection = container.createEl("section", { cls: "rbw-alerts" });
  const alerts = activeAlerts((_a = state.alerts.data) != null ? _a : [], now), alertStatus = feedStatus(state.alerts, now, "alerts");
  alertSection.createEl(compact ? "h4" : "h2", { text: `NWS alerts${alerts.length ? ` (${alerts.length})` : ""}` });
  if (!alerts.length) alertSection.createEl("p", { text: alertStatus === "Current" ? "No active NWS alerts at the last check." : "Alert status unavailable or stale. Check weather.gov for current alerts." });
  for (const a of alerts) {
    const details = alertSection.createEl("details", { cls: `rbw-alert rbw-severity-${a.severity.toLowerCase()}` });
    details.createEl("summary", { text: a.headline });
    details.createEl("p", { cls: "rbw-muted", text: `${a.severity} \xB7 Sent ${time(a.sent)} \xB7 Expires ${time(a.expires)}` });
    details.createEl("p", { cls: "rbw-official-text", text: a.description });
    if (a.instruction) details.createEl("p", { cls: "rbw-official-text", text: a.instruction });
    details.createEl("a", { text: "Official NWS alert", href: a.source, attr: { target: "_blank", rel: "noopener noreferrer" } });
  }
  freshness(alertSection, state.alerts, "alerts");
  if (compact) {
    const p = currentPeriods(state.forecast.data, now)[0];
    if (p) container.createEl("p", { text: `${p.name}: ${(_b = p.temperature) != null ? _b : "\u2014"}\xB0${p.temperatureUnit} \xB7 ${p.shortForecast}` });
    freshness(container, state.forecast, "forecast");
  } else {
    const hourly = container.createEl("section");
    hourly.createEl("h2", { text: "Next 24 hours" });
    freshness(hourly, state.hourly, "hourly");
    const periods = currentPeriods(state.hourly.data, now, true);
    if (!periods.length) hourly.createEl("p", { text: "Hourly forecast unavailable for the current period." });
    else {
      const table = hourly.createEl("table", { cls: "rbw-table" });
      table.createEl("caption", { cls: "rbw-muted", text: `Issued ${time((_c = state.hourly.data) == null ? void 0 : _c.updated)} \xB7 ${s.timeZone}` });
      const head = table.createEl("thead").createEl("tr");
      for (const text of ["Time / weather", "Temp", "Wind", "Rain / snow"]) head.createEl("th", { text, attr: { scope: "col" } });
      const body = table.createEl("tbody");
      for (const p of periods) {
        const row = body.createEl("tr"), first = row.createEl("th", { attr: { scope: "row" } });
        first.createDiv({ text: new Intl.DateTimeFormat("en-US", { timeZone: s.timeZone, weekday: "short", hour: "numeric", timeZoneName: "short" }).format(new Date(p.startTime)) });
        first.createDiv({ cls: "rbw-muted", text: p.shortForecast });
        row.createEl("td", { text: p.temperature === null ? "\u2014" : `${p.temperature}\xB0${p.temperatureUnit}` });
        row.createEl("td", { text: `${p.windSpeed} ${p.windDirection}` });
        row.createEl("td", { text: p.precipitation === null ? "\u2014" : `${p.precipitation}%` });
      }
    }
    const forecast = container.createEl("section");
    forecast.createEl("h2", { text: "Seven-day forecast" });
    forecast.createEl("p", { cls: "rbw-muted", text: `Issued ${time((_d = state.forecast.data) == null ? void 0 : _d.updated)}` });
    freshness(forecast, state.forecast, "forecast");
    const daily = currentPeriods(state.forecast.data, now);
    if (!daily.length) forecast.createEl("p", { text: "Forecast unavailable for the current period." });
    for (const p of daily) {
      const details = forecast.createEl("details", { cls: "rbw-period" }), summary = details.createEl("summary");
      summary.createSpan({ cls: "rbw-period-name", text: p.name });
      summary.createSpan({ cls: "rbw-period-temp", text: p.temperature === null ? "\u2014" : `${p.temperature}\xB0${p.temperatureUnit}` });
      summary.createSpan({ text: p.shortForecast });
      details.createEl("p", { text: p.detailedForecast || p.shortForecast });
      details.createEl("p", { cls: "rbw-muted", text: `Wind ${p.windSpeed} ${p.windDirection} \xB7 Rain/snow chance ${p.precipitation === null ? "unavailable" : `${p.precipitation}%`}` });
    }
  }
  const footer = container.createEl("footer", { cls: "rbw-footer rbw-muted" });
  footer.createEl("a", { text: "Weather data: NWS \xB7 public domain", href: `https://forecast.weather.gov/MapClick.php?lat=${s.latitude}&lon=${s.longitude}`, attr: { target: "_blank", rel: "noopener noreferrer" } });
  footer.createEl("p", { text: "Independent add-on; no NOAA/NWS endorsement. Updates while Obsidian is running. Saved snapshots do not update." });
  container.scrollTop = scroll;
}
var WeatherView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return WEATHER_VIEW;
  }
  getDisplayText() {
    return "Weather";
  }
  getIcon() {
    return "cloud-sun";
  }
  async onOpen() {
    this.unsubscribe = this.plugin.subscribe(() => renderWeather(this.contentEl, this.plugin));
    renderWeather(this.contentEl, this.plugin);
    void this.plugin.refresh();
  }
  async onClose() {
    var _a;
    (_a = this.unsubscribe) == null ? void 0 : _a.call(this);
    this.contentEl.empty();
  }
};

// src/provider.ts
function object(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("NWS returned an invalid response.");
  return value;
}
function properties(value) {
  return object(object(value).properties);
}
function parseForecast(value) {
  var _a, _b;
  const p = properties(value);
  if (!Array.isArray(p.periods)) throw new Error("NWS forecast periods are unavailable.");
  return { updated: String((_b = (_a = p.updateTime) != null ? _a : p.generatedAt) != null ? _b : ""), periods: p.periods.map((v) => {
    var _a2, _b2, _c, _d, _e, _f, _g, _h, _i;
    const row = object(v);
    return { name: String((_a2 = row.name) != null ? _a2 : ""), startTime: String((_b2 = row.startTime) != null ? _b2 : ""), endTime: String((_c = row.endTime) != null ? _c : ""), temperature: numberOrNull(row.temperature), temperatureUnit: String((_d = row.temperatureUnit) != null ? _d : ""), windSpeed: String((_e = row.windSpeed) != null ? _e : "Unavailable"), windDirection: String((_f = row.windDirection) != null ? _f : ""), shortForecast: String((_g = row.shortForecast) != null ? _g : ""), detailedForecast: String((_h = row.detailedForecast) != null ? _h : ""), precipitation: numberOrNull((_i = row.probabilityOfPrecipitation) == null ? void 0 : _i.value) };
  }) };
}
function parseAlerts(value) {
  const root = object(value);
  if (!Array.isArray(root.features)) throw new Error("NWS alerts are unavailable.");
  return root.features.filter((v) => {
    var _a, _b;
    return ((_a = v.properties) == null ? void 0 : _a.status) === "Actual" && ((_b = v.properties) == null ? void 0 : _b.messageType) !== "Cancel";
  }).map((v) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
    const p = properties(v);
    return { id: String((_b = (_a = v.id) != null ? _a : p.id) != null ? _b : ""), event: String((_c = p.event) != null ? _c : "Weather alert"), headline: String((_e = (_d = p.headline) != null ? _d : p.event) != null ? _e : "Weather alert"), severity: String((_f = p.severity) != null ? _f : "Unknown"), sent: String((_g = p.sent) != null ? _g : ""), effective: String((_h = p.effective) != null ? _h : ""), expires: String((_i = p.expires) != null ? _i : ""), ends: String((_j = p.ends) != null ? _j : ""), description: String((_k = p.description) != null ? _k : ""), instruction: String((_l = p.instruction) != null ? _l : ""), source: apiUrl((_m = v.id) != null ? _m : p.id) };
  });
}
var NwsClient = class {
  constructor(cache, transport2, clock = Date.now) {
    this.cache = cache;
    this.transport = transport2;
    this.clock = clock;
    this.failures = /* @__PURE__ */ new Map();
  }
  async get(url, interval) {
    var _a, _b, _c, _d, _e;
    url = apiUrl(url);
    const now = this.clock(), previous = this.cache[url], failure = this.failures.get(url);
    if (failure && failure.until > now) throw new Error(failure.message);
    if (previous && previous.expiresAt > now) return previous;
    const headers = { Accept: "application/geo+json", "User-Agent": "RedBeardWeather/1.0 (Obsidian; https://github.com/Red-Beard08/red-beard-weather)" };
    if (previous == null ? void 0 : previous.etag) headers["If-None-Match"] = previous.etag;
    if (previous == null ? void 0 : previous.lastModified) headers["If-Modified-Since"] = previous.lastModified;
    try {
      const response = await this.transport(url, headers);
      const h = Object.fromEntries(Object.entries(response.headers).map(([k, v]) => [k.toLowerCase(), v]));
      if (response.status !== 304 && (response.status < 200 || response.status >= 300)) {
        const retry = Number(h["retry-after"]), date = Date.parse((_a = h["retry-after"]) != null ? _a : "");
        const delay = Number.isFinite(retry) ? retry * 1e3 : Number.isFinite(date) ? date - now : MINUTE;
        const message = response.status === 429 ? "NWS rate limit; retrying later." : `NWS request failed (${response.status}); retrying later.`;
        this.failures.set(url, { until: now + Math.max(MINUTE, delay), message });
        throw new Error(message);
      }
      if (response.status === 304 && !previous) throw new Error("NWS returned an empty cached response.");
      const maxAge = /(?:^|,)\s*max-age=(\d+)/i.exec((_b = h["cache-control"]) != null ? _b : "");
      const remaining = maxAge ? Math.max(0, Number(maxAge[1]) * 1e3 - (Number(h.age) || 0) * 1e3) : 0;
      const entry = { data: response.status === 304 ? previous.data : object(response.json), checkedAt: now, expiresAt: now + Math.max(interval, remaining), etag: (_c = h.etag) != null ? _c : previous == null ? void 0 : previous.etag, lastModified: (_d = h["last-modified"]) != null ? _d : previous == null ? void 0 : previous.lastModified };
      if (/no-store|private/i.test((_e = h["cache-control"]) != null ? _e : "")) throw new Error("NWS response could not be stored safely.");
      this.cache[url] = entry;
      this.failures.delete(url);
      return entry;
    } catch (error) {
      if (!this.failures.has(url)) this.failures.set(url, { until: now + MINUTE, message: error instanceof Error ? error.message : "NWS connection unavailable." });
      throw error;
    }
  }
};
var WeatherService = class {
  constructor(settings, client, clock = Date.now) {
    this.settings = settings;
    this.client = client;
    this.clock = clock;
    this.state = { locationKey: locationKey(settings), forecast: {}, hourly: {}, observation: {}, alerts: {}, refreshing: false };
  }
  refresh() {
    if (this.pending) return this.pending;
    this.pending = this.run().finally(() => {
      this.pending = void 0;
    });
    return this.pending;
  }
  async feed(previous, url, interval, parse) {
    try {
      const entry = await this.client.get(url, interval);
      return { data: parse(entry.data), checkedAt: entry.checkedAt, expiresAt: entry.expiresAt, source: url };
    } catch (error) {
      const cached = this.client.cache[url];
      let fallback = previous;
      if (!previous.data && cached) {
        try {
          fallback = { data: parse(cached.data), checkedAt: cached.checkedAt, expiresAt: cached.expiresAt };
        } catch (e) {
        }
      }
      return { ...fallback, source: url, error: error instanceof Error ? error.message : "NWS unavailable." };
    }
  }
  async observations(stationsUrl) {
    try {
      let metadata;
      try {
        metadata = (await this.client.get(stationsUrl, 24 * 60 * MINUTE)).data;
      } catch (error) {
        if (!this.client.cache[stationsUrl]) throw error;
        metadata = this.client.cache[stationsUrl].data;
      }
      const stations = object(metadata);
      if (!Array.isArray(stations.features)) throw new Error("Nearby observation stations are unavailable.");
      let best;
      for (const feature of stations.features.slice(0, 3)) {
        const station = object(feature), props = properties(station);
        const source = `${apiUrl(station.id).replace(/\/$/, "")}/observations/latest`;
        const result = await this.feed({}, source, WEATHER_INTERVAL, (value) => {
          var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
          const p = properties(value);
          if (!Number.isFinite(Date.parse(p.timestamp)) || numberOrNull((_a = p.temperature) == null ? void 0 : _a.value) === null) throw new Error("Station has no recent temperature observation.");
          const t = numberOrNull((_b = p.temperature) == null ? void 0 : _b.value), w = numberOrNull((_c = p.windSpeed) == null ? void 0 : _c.value);
          const temperatureC = t === null ? null : ((_d = p.temperature) == null ? void 0 : _d.unitCode) === "wmoUnit:degF" ? (t - 32) * 5 / 9 : t;
          const windKmh = w === null ? null : ((_e = p.windSpeed) == null ? void 0 : _e.unitCode) === "wmoUnit:m_s-1" ? w * 3.6 : ((_f = p.windSpeed) == null ? void 0 : _f.unitCode) === "wmoUnit:kn" ? w * 1.852 : w;
          return { station: String((_g = props.stationIdentifier) != null ? _g : ""), stationName: String((_i = (_h = props.name) != null ? _h : props.stationIdentifier) != null ? _i : "Nearby station"), timestamp: String(p.timestamp), description: String((_j = p.textDescription) != null ? _j : ""), temperatureC, humidity: numberOrNull((_k = p.relativeHumidity) == null ? void 0 : _k.value), windKmh };
        });
        if (result.data && (!(best == null ? void 0 : best.data) || Date.parse(result.data.timestamp) > Date.parse(best.data.timestamp))) best = result;
        if ((best == null ? void 0 : best.data) && this.clock() - Date.parse(best.data.timestamp) < 2 * 60 * MINUTE) return best;
      }
      if (best) return best;
      throw new Error("Nearby stations have no usable observations.");
    } catch (error) {
      return { ...this.state.observation, error: error instanceof Error ? error.message : "Observation unavailable." };
    }
  }
  async run() {
    this.state.refreshing = true;
    this.state.lastAttempt = this.clock();
    const point = `https://api.weather.gov/points/${this.settings.latitude.toFixed(4)},${this.settings.longitude.toFixed(4)}`;
    const alertUrl = `https://api.weather.gov/alerts/active?point=${this.settings.latitude.toFixed(4)},${this.settings.longitude.toFixed(4)}`;
    try {
      const forecastTask = (async () => {
        try {
          let metadata;
          try {
            metadata = (await this.client.get(point, 24 * 60 * MINUTE)).data;
          } catch (error) {
            if (!this.client.cache[point]) throw error;
            metadata = this.client.cache[point].data;
          }
          const p = properties(metadata);
          const suffix = `?units=${this.settings.units}`;
          const [forecast, hourly, observation] = await Promise.all([
            this.feed(this.state.forecast, apiUrl(p.forecast) + suffix, WEATHER_INTERVAL, parseForecast),
            this.feed(this.state.hourly, apiUrl(p.forecastHourly) + suffix, WEATHER_INTERVAL, parseForecast),
            this.observations(apiUrl(p.observationStations))
          ]);
          Object.assign(this.state, { forecast, hourly, observation });
        } catch (error) {
          const message = error instanceof Error ? error.message : "NWS location lookup failed.";
          for (const feed of [this.state.forecast, this.state.hourly, this.state.observation]) feed.error = message;
        }
      })();
      const alertTask = this.feed(this.state.alerts, alertUrl, ALERT_INTERVAL, parseAlerts).then((alerts) => {
        this.state.alerts = alerts;
      });
      await Promise.all([forecastTask, alertTask]);
      if (this.state.alerts.data) this.state.alerts.data = activeAlerts(this.state.alerts.data, this.clock());
    } finally {
      this.state.refreshing = false;
    }
  }
};

// src/repository.ts
var import_obsidian2 = require("obsidian");
function snapshotBody(state, settings, now, id) {
  var _a, _b, _c, _d, _e, _f, _g;
  if (![state.forecast.data, state.hourly.data, state.observation.data, state.alerts.data].some(Boolean)) throw new Error("No weather data is available to save. Open Weather and refresh first.");
  const q = markdownText, time = (v) => formatTime(v, settings.timeZone);
  const frontmatter = { type: "weather-snapshot", schema_version: 1, id, created: new Date(now).toISOString(), updated: new Date(now).toISOString(), status: "saved", weather_location: settings.locationName, weather_latitude: settings.latitude, weather_longitude: settings.longitude, weather_units: settings.units, weather_time_zone: settings.timeZone, weather_observed_at: (_b = (_a = state.observation.data) == null ? void 0 : _a.timestamp) != null ? _b : null, weather_forecast_issued_at: (_d = (_c = state.forecast.data) == null ? void 0 : _c.updated) != null ? _d : null, tags: ["weather", "output"] };
  const lines = ["---", (0, import_obsidian2.stringifyYaml)(frontmatter).trimEnd(), "---", "", `# Weather \u2014 ${q(settings.locationName)}`, "", `Saved ${time(now)}.`, "", "## Conditions", ""];
  const o = state.observation.data;
  lines.push(o ? `${temperature(o.temperatureC, settings.units)} \u2014 ${q(o.description)}. Station: ${q(o.stationName)} (${q(o.station)}). Observed ${time(o.timestamp)}.` : "Conditions unavailable.");
  for (const [kind, title] of [["forecast", "Seven-day forecast"], ["hourly", "Next 24 hours"]]) {
    const feed = state[kind];
    lines.push("", `## ${title}`, "", `Issued ${time((_e = feed.data) == null ? void 0 : _e.updated)}.`, "");
    for (const p of currentPeriods(feed.data, now, kind === "hourly")) lines.push(`- **${q(p.name || time(p.startTime))} \xB7 ${(_f = p.temperature) != null ? _f : "Unavailable"}${p.temperature === null ? "" : `\xB0${q(p.temperatureUnit)}`}** \u2014 ${q(p.detailedForecast || p.shortForecast)} Wind: ${q(p.windSpeed)} ${q(p.windDirection)}. Rain/snow chance: ${p.precipitation === null ? "Unavailable" : `${p.precipitation}%`}.`);
    if (!currentPeriods(feed.data, now, kind === "hourly").length) lines.push("Forecast unavailable for the current period.");
  }
  lines.push("", "## NWS alerts", "");
  const alerts = activeAlerts((_g = state.alerts.data) != null ? _g : [], now), status = feedStatus(state.alerts, now, "alerts");
  if (!alerts.length) lines.push(status === "Current" ? "No active NWS alerts at the last check." : "Alert status unavailable or stale; an empty cached list does not confirm that there are no active alerts.");
  for (const a of alerts) lines.push(`### ${q(a.headline)}`, "", `Severity: ${q(a.severity)}. Sent ${time(a.sent)}. Expires ${time(a.expires)}.`, "", q(a.description), "", q(a.instruction), "", `[Official NWS alert](${a.source})`, "");
  lines.push("", "## Sources and freshness", "");
  for (const kind of ["observation", "forecast", "hourly", "alerts"]) {
    const f = state[kind];
    lines.push(`- ${kind}: ${q(feedStatus(f, now, kind))}. Checked ${time(f.checkedAt)}.${f.source ? ` [NWS data](${f.source})` : ""}`);
  }
  lines.push("", "Weather data: National Weather Service, public domain. Red-Beard Weather is independently developed and is not endorsed by NOAA/NWS. This snapshot records data available when saved; alerts are not updated in saved notes.", "", "## My notes", "", "");
  return lines.join("\n");
}
async function createSnapshot(vault, settings, state, now = Date.now()) {
  const id = `weather-${crypto.randomUUID()}`;
  const body = snapshotBody(state, settings, now, id);
  const folder = safeFolder(settings.snapshotFolder);
  let parent = "";
  for (const segment of folder.split("/")) {
    parent = parent ? `${parent}/${segment}` : segment;
    if (!vault.getAbstractFileByPath(parent)) {
      try {
        await vault.createFolder(parent);
      } catch (error) {
        if (!vault.getAbstractFileByPath(parent)) throw error;
      }
    }
  }
  const stamp = new Date(now).toISOString().replace(/[:.]/g, "-");
  const path = (0, import_obsidian2.normalizePath)(`${folder}/weather-${stamp}-${id.slice(-8)}.md`);
  return vault.create(path, body);
}

// src/settings.ts
var import_obsidian3 = require("obsidian");
var WeatherSettingsTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const c = this.containerEl;
    c.empty();
    const draft = { ...this.plugin.settings };
    c.createEl("h2", { text: "Red-Beard Weather" });
    c.createEl("h3", { text: "Location and display" });
    c.createEl("p", { text: "NWS coverage is limited to supported U.S. locations. Coordinates are sent directly to NWS; GPS access is not used." });
    new import_obsidian3.Setting(c).setName("Location name").addText((t) => t.setValue(draft.locationName).onChange((v) => {
      draft.locationName = v;
    }));
    new import_obsidian3.Setting(c).setName("Latitude").addText((t) => t.setValue(String(draft.latitude)).onChange((v) => {
      draft.latitude = v.trim() ? Number(v) : NaN;
    }));
    new import_obsidian3.Setting(c).setName("Longitude").addText((t) => t.setValue(String(draft.longitude)).onChange((v) => {
      draft.longitude = v.trim() ? Number(v) : NaN;
    }));
    new import_obsidian3.Setting(c).setName("Units").addDropdown((d) => d.addOptions({ us: "Fahrenheit / mph", si: "Celsius / km/h" }).setValue(draft.units).onChange((v) => {
      draft.units = v === "si" ? "si" : "us";
    }));
    new import_obsidian3.Setting(c).setName("Time zone").setDesc("IANA name; defaults to America/Chicago for Peoria.").addText((t) => t.setValue(draft.timeZone).onChange((v) => {
      draft.timeZone = v.trim();
    }));
    c.createEl("h3", { text: "Snapshot storage" });
    new import_obsidian3.Setting(c).setName("Snapshot folder").setDesc("Vault-relative. Changing this never moves existing notes.").addText((t) => t.setValue(draft.snapshotFolder).onChange((v) => {
      draft.snapshotFolder = v;
    }));
    c.createEl("h3", { text: "Automation and privacy" });
    new import_obsidian3.Setting(c).setName("Automatic refresh").setDesc("Weather every 15 minutes; alerts every 5 minutes while the app is visible. Refreshes on startup and resume. No closed-app notifications.").addToggle((t) => t.setValue(draft.autoRefresh).onChange((v) => {
      draft.autoRefresh = v;
    }));
    c.createEl("p", { text: "No accounts, keys, analytics, paid provider, or server. Settings and the offline cache are stored in this plugin\u2019s data.json and may sync with your vault. NWS rate limits and cache guidance apply to manual refresh too." });
    new import_obsidian3.Setting(c).addButton((b) => b.setButtonText("Save settings").setCta().onClick(async () => {
      try {
        const valid = validateSettings(draft);
        b.setDisabled(true);
        await this.plugin.applySettings(valid);
        new import_obsidian3.Notice("Weather settings saved.");
        this.display();
      } catch (error) {
        new import_obsidian3.Notice(error instanceof Error ? error.message : "Could not save weather settings.");
        b.setDisabled(false);
      }
    }));
    c.createEl("a", { text: "NWS API documentation and free-use policy", href: "https://www.weather.gov/documentation/services-web-api", attr: { target: "_blank", rel: "noopener noreferrer" } });
  }
};

// src/main.ts
var transport = async (url, headers) => {
  let timeout;
  try {
    const response = await Promise.race([
      (0, import_obsidian4.requestUrl)({ url, headers, throw: false }),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("NWS request timed out; retrying later.")), 2e4);
      })
    ]);
    let json;
    if (response.status >= 200 && response.status < 300) json = response.json;
    return { status: response.status, headers: response.headers, json };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};
var WeatherPlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
    this.listeners = /* @__PURE__ */ new Set();
    this.detachHost = [];
    this.disposed = false;
    this.saves = Promise.resolve();
    this.lastSaved = "";
    this.snapshotPending = false;
  }
  async onload() {
    var _a;
    const stored = await this.loadData();
    this.settings = normalizeSettings(stored == null ? void 0 : stored.settings);
    const cache = {};
    for (const [url, entry] of Object.entries((_a = stored == null ? void 0 : stored.cache) != null ? _a : {})) {
      if (url.startsWith("https://api.weather.gov/") && entry && typeof entry === "object" && Number.isFinite(entry.checkedAt) && Number.isFinite(entry.expiresAt)) cache[url] = entry;
    }
    this.service = new WeatherService(this.settings, new NwsClient(cache, transport));
    this.registerView(WEATHER_VIEW, (leaf) => new WeatherView(leaf, this));
    this.addSettingTab(new WeatherSettingsTab(this.app, this));
    this.addRibbonIcon("cloud-sun", "Open Weather", () => void this.openDashboard());
    this.addCommand({ id: "open-dashboard", name: "Open weather", callback: () => void this.openDashboard() });
    this.addCommand({ id: "refresh", name: "Refresh weather", callback: () => void this.refresh(true) });
    this.addCommand({ id: "new-snapshot", name: "New Weather Snapshot", callback: () => void this.saveSnapshot() });
    this.addCommand({ id: "open-settings", name: "Open weather settings", callback: () => this.openSettings() });
    this.registerDomEvent(window, "red-beard-dashboard-ready", () => this.connectHost());
    this.registerDomEvent(document, "visibilitychange", () => {
      if (!document.hidden) void this.refresh();
    });
    this.registerDomEvent(window, "focus", () => void this.refresh());
    this.registerInterval(window.setInterval(() => {
      this.connectHost();
      if (!document.hidden && this.settings.autoRefresh) void this.refresh();
    }, 6e4));
    this.app.workspace.onLayoutReady(() => {
      this.connectHost();
      void this.refresh();
    });
  }
  onunload() {
    this.disposed = true;
    this.detachHost.forEach((fn) => fn());
    this.detachHost = [];
    this.listeners.clear();
  }
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  notify() {
    if (this.disposed) return;
    for (const fn of this.listeners) fn();
    if (this.host) void this.host.refreshViews().catch(() => {
    });
  }
  persist() {
    const serialized = JSON.stringify({ settings: this.settings, cache: this.service.client.cache });
    this.saves = this.saves.catch(() => {
    }).then(async () => {
      if (serialized === this.lastSaved) return;
      await this.saveData(JSON.parse(serialized));
      this.lastSaved = serialized;
    });
    return this.saves;
  }
  async refresh(showNotice = false) {
    if (this.disposed) return;
    const service = this.service, pending = service.refresh();
    this.notify();
    try {
      await pending;
      if (this.disposed || service !== this.service) return;
      await this.persist();
      if (showNotice) {
        const errors = [service.state.forecast, service.state.hourly, service.state.observation, service.state.alerts].filter((f) => f.error);
        new import_obsidian4.Notice(errors.length ? "Weather updated with unavailable or cached sections. Open Weather for details." : "Weather checked with NWS.");
      }
    } catch (error) {
      if (showNotice) new import_obsidian4.Notice(`Weather: ${error instanceof Error ? error.message : "Could not save the offline cache."}`);
    } finally {
      this.notify();
    }
  }
  async applySettings(settings) {
    const changed = locationKey(settings) !== locationKey(this.settings);
    const previous = this.settings, previousService = this.service;
    this.settings = settings;
    if (changed) this.service = new WeatherService(settings, new NwsClient({}, transport));
    else this.service.settings = settings;
    try {
      await this.persist();
    } catch (error) {
      this.settings = previous;
      this.service = previousService;
      this.service.settings = previous;
      throw error;
    }
    this.notify();
    void this.refresh();
  }
  async openDashboard() {
    let leaf = this.app.workspace.getLeavesOfType(WEATHER_VIEW)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf(true);
      await leaf.setViewState({ type: WEATHER_VIEW, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
  }
  openSettings() {
    const settings = this.app.setting;
    settings == null ? void 0 : settings.open();
    settings == null ? void 0 : settings.openTabById(this.manifest.id);
  }
  async saveSnapshot() {
    if (this.snapshotPending) return;
    this.snapshotPending = true;
    try {
      await this.refresh();
      const file = await createSnapshot(this.app.vault, this.settings, this.service.state);
      await this.app.workspace.getLeaf(false).openFile(file);
      new import_obsidian4.Notice("Weather snapshot saved.");
    } catch (error) {
      new import_obsidian4.Notice(error instanceof Error ? error.message : "Weather snapshot could not be saved.");
    } finally {
      this.snapshotPending = false;
    }
  }
  connectHost() {
    var _a;
    if (this.disposed) return;
    const candidate = (_a = this.app.plugins) == null ? void 0 : _a.getPlugin("red-beard-dashboard");
    if (candidate === this.host) return;
    this.detachHost.forEach((fn) => fn());
    this.detachHost = [];
    this.host = void 0;
    if (!(candidate == null ? void 0 : candidate.registerModule) || !candidate.registerWidget) return;
    this.host = candidate;
    this.detachHost.push(candidate.registerModule({ id: this.manifest.id, name: "Weather", command: `${this.manifest.id}:open-dashboard`, icon: "cloud-sun", description: "Peoria conditions, forecasts, and NWS alerts.", order: 70 }));
    this.detachHost.push(candidate.registerWidget({ id: "red-beard-weather/overview", name: "Weather", description: "Local NWS conditions, forecast, and alerts.", icon: "cloud-sun", defaultLayout: { w: 4, mobileW: 12, h: 3, order: 15 }, render: (_, container) => renderWeather(container, this, true) }));
    if (candidate.registerQuickAction) this.detachHost.push(candidate.registerQuickAction({ id: "red-beard-weather/new-snapshot", name: "New Weather Snapshot", command: `${this.manifest.id}:new-snapshot`, description: "Save the current NWS data to a Markdown note." }));
  }
};
