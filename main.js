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
var import_obsidian5 = require("obsidian");

// src/dashboard.ts
var import_obsidian2 = require("obsidian");

// src/graphics.ts
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

// src/presentation.ts
function conditionVisual(text, daytime = true) {
  const t = text.toLowerCase();
  if (/thunder|t-storm/.test(t)) return { icon: "cloud-lightning", tone: "storm" };
  if (/snow|flurr|sleet|ice|freezing/.test(t)) return { icon: "cloud-snow", tone: "snow" };
  if (/rain|shower|drizzle/.test(t)) return { icon: "cloud-rain", tone: "rain" };
  if (/fog|mist|haze|smoke/.test(t)) return { icon: "cloud-fog", tone: "cloud" };
  if (/partly|mostly (?:sunny|clear)|few clouds/.test(t)) return { icon: daytime ? "cloud-sun" : "cloud-moon", tone: "sun" };
  if (/cloud|overcast/.test(t)) return { icon: "cloud", tone: "cloud" };
  if (/sun|clear|fair/.test(t)) return { icon: daytime ? "sun" : "moon", tone: "sun" };
  return { icon: "circle-help", tone: "cloud" };
}
function dateKey(value, zone) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return ["year", "month", "day"].map((k) => {
    var _a;
    return (_a = parts.find((p) => p.type === k)) == null ? void 0 : _a.value;
  }).join("-");
}
function hourLabel(value, zone, minutes = false) {
  return new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", ...minutes ? { minute: "2-digit" } : {} }).format(new Date(value));
}
function isDaytime(period) {
  var _a;
  return (_a = period.isDaytime) != null ? _a : !/night|overnight/i.test(period.name);
}
function dailyOutlook(periods, zone, now) {
  const today = dateKey(now, zone), days = /* @__PURE__ */ new Map();
  for (const p of periods) {
    const date = dateKey(p.startTime, zone);
    if (!date) continue;
    const key = date < today ? today : date;
    let day = days.get(key);
    if (!day) {
      day = { key, label: key === today ? "Today" : new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short" }).format(new Date(p.startTime)), high: null, low: null, condition: p.shortForecast, precipitation: p.precipitation, daytime: isDaytime(p), periods: [] };
      days.set(key, day);
    }
    day.periods.push(p);
    if (isDaytime(p)) {
      day.high = p.temperature;
      day.condition = p.shortForecast;
      day.precipitation = p.precipitation;
      day.daytime = true;
    } else if (p.temperature !== null) day.low = day.low === null ? p.temperature : Math.min(day.low, p.temperature);
  }
  return [...days.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(0, 7);
}
function chartPoints(periods) {
  const temperatures = periods.flatMap((p) => p.temperature === null ? [] : [p.temperature]);
  const low = temperatures.length ? Math.min(...temperatures) : null, high = temperatures.length ? Math.max(...temperatures) : null;
  const span = Math.max(1, (high != null ? high : 0) - (low != null ? low : 0));
  const points = periods.map((period, i) => ({ period, x: 72 + i * 588 / Math.max(1, periods.length - 1), y: period.temperature === null ? null : high === low ? 62 : 28 + ((high != null ? high : 0) - period.temperature) * 68 / span, rainY: period.precipitation === null ? null : 158 - Math.max(0, Math.min(100, period.precipitation)) * 0.4 }));
  const segments = [];
  let current = [];
  for (const point of points) {
    if (point.y === null) {
      if (current.length) segments.push(current.join(" "));
      current = [];
    } else current.push(`${point.x.toFixed(2)},${point.y.toFixed(2)}`);
  }
  if (current.length) segments.push(current.join(" "));
  return { points, low, high, segments };
}
function glanceModel(state, s, now) {
  var _a, _b;
  const hourly = currentPeriods(state.hourly.data, now, true), daily = dailyOutlook(currentPeriods(state.forecast.data, now), s.timeZone, now);
  const nextHours = hourly.filter((p) => Date.parse(p.startTime) >= now).slice(0, 3);
  const observation = state.observation.data, obsStatus = feedStatus(state.observation, now, "observation");
  const alertStatus = feedStatus(state.alerts, now, "alerts"), alerts = activeAlerts((_a = state.alerts.data) != null ? _a : [], now).sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  return { hourly, daily, nextHours, observation, obsStatus, alertStatus, alerts, forecastStatus: feedStatus(state.forecast, now, "forecast"), hourlyStatus: feedStatus(state.hourly, now, "hourly"), visual: conditionVisual((_b = observation == null ? void 0 : observation.description) != null ? _b : "", hourly[0] ? isDaytime(hourly[0]) : true) };
}
function severityRank(severity) {
  return ["Extreme", "Severe", "Moderate", "Minor", "Unknown"].indexOf(severity) < 0 ? 4 : ["Extreme", "Severe", "Moderate", "Minor", "Unknown"].indexOf(severity);
}

// src/graphics.ts
function weatherIcon(parent, text, daytime = true, large = false) {
  const visual = conditionVisual(text, daytime);
  const icon = parent.createSpan({ cls: `rbw-sky rbw-tone-${visual.tone}${large ? " rbw-sky-large" : ""}`, attr: { "aria-hidden": "true" } });
  (0, import_obsidian.setIcon)(icon, visual.icon);
  return icon;
}
function smallIcon(parent, name) {
  (0, import_obsidian.setIcon)(parent.createSpan({ cls: "rbw-small-icon", attr: { "aria-hidden": "true" } }), name);
}
var NS = "http://www.w3.org/2000/svg";
function svg(parent, tag, attributes, text) {
  const element = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (text !== void 0) element.textContent = text;
  parent.appendChild(element);
  return element;
}
function temperatureChart(parent, periods, zone) {
  var _a, _b;
  const chart = chartPoints(periods), units = (_b = (_a = periods.find((p) => p.temperature !== null)) == null ? void 0 : _a.temperatureUnit) != null ? _b : "";
  const figure = parent.createEl("figure", { cls: "rbw-chart" });
  const graphic = svg(figure, "svg", { viewBox: "0 0 700 190", role: "img", "aria-label": `24-hour forecast. Temperature ${chart.low === null ? "unavailable" : `${chart.low} to ${chart.high} degrees ${units}`}. Blue bars show precipitation chance on a zero to one hundred percent scale. Exact values follow in reading order.` });
  if (chart.high !== null) {
    svg(graphic, "text", { x: "0", y: "24", class: "rbw-chart-label" }, `${chart.high}\xB0`);
    svg(graphic, "text", { x: "0", y: "99", class: "rbw-chart-label" }, `${chart.low}\xB0`);
  }
  svg(graphic, "line", { x1: "72", x2: "660", y1: "106", y2: "106", class: "rbw-chart-rule" });
  svg(graphic, "text", { x: "0", y: "120", class: "rbw-chart-label" }, "100%");
  svg(graphic, "text", { x: "0", y: "159", class: "rbw-chart-label" }, "0%");
  for (const point of chart.points) {
    const p = point.period, label = `${hourLabel(p.startTime, zone)}: ${p.temperature === null ? "temperature unavailable" : `${p.temperature}\xB0${p.temperatureUnit}`}, ${p.precipitation === null ? "precipitation chance unavailable" : `${p.precipitation}% precipitation chance`}, ${p.shortForecast}`;
    if (point.rainY !== null) {
      const bar = svg(graphic, "rect", { x: String(point.x - 5), y: String(point.rainY), width: "10", height: String(158 - point.rainY), rx: "2", class: "rbw-rain-bar" });
      svg(bar, "title", {}, label);
    } else {
      const missing = svg(graphic, "text", { x: String(point.x), y: "152", "text-anchor": "middle", class: "rbw-rain-missing" }, "?");
      svg(missing, "title", {}, label);
    }
    if (point.y !== null) {
      const dot = svg(graphic, "circle", { cx: String(point.x), cy: String(point.y), r: "2.5", class: "rbw-temp-dot" });
      svg(dot, "title", {}, label);
    }
  }
  for (const points of chart.segments) svg(graphic, "polyline", { points, class: "rbw-temp-line", fill: "none", "stroke-width": "3", "stroke-linejoin": "round", "stroke-linecap": "round" });
  const ticks = [0, Math.floor((periods.length - 1) / 3), Math.floor(2 * (periods.length - 1) / 3), periods.length - 1];
  for (const i of [...new Set(ticks)]) if (chart.points[i]) svg(graphic, "text", { x: String(chart.points[i].x), y: "183", "text-anchor": "middle", class: "rbw-chart-label" }, hourLabel(periods[i].startTime, zone));
  const caption = figure.createEl("figcaption", { cls: "rbw-chart-legend" });
  const temp = caption.createSpan();
  smallIcon(temp, "thermometer");
  temp.createSpan({ text: `Temperature (\xB0${units || "\u2014"})` });
  const rain = caption.createSpan();
  smallIcon(rain, "droplets");
  rain.createSpan({ text: "Precipitation chance (%)" });
  if (periods.some((p) => p.precipitation === null)) caption.createSpan({ text: "? = chance unavailable" });
  const accessible = figure.createEl("ul", { cls: "rbw-sr-only" });
  for (const p of periods) accessible.createEl("li", { text: `${hourLabel(p.startTime, zone)}: ${p.shortForecast}. ${p.temperature === null ? "Temperature unavailable" : `${p.temperature} degrees ${p.temperatureUnit}`}. ${p.precipitation === null ? "Precipitation chance unavailable" : `Precipitation chance ${p.precipitation}%`}. Wind ${p.windSpeed} ${p.windDirection}.` });
}
function hourStrip(parent, periods, zone, compact = false) {
  const strip = parent.createDiv({ cls: compact ? "rbw-hour-strip rbw-mini-hours" : "rbw-hour-strip", attr: { "aria-label": "Hourly forecast", "data-rbw-scroll": "hours" } });
  if (!compact) {
    strip.tabIndex = 0;
    strip.setAttribute("role", "region");
    strip.setAttribute("data-rbw-focus", "hourly-scroll");
  }
  for (const p of periods) {
    const item = strip.createDiv({ cls: "rbw-hour", attr: { "aria-label": `${hourLabel(p.startTime, zone)}, ${p.shortForecast}` } });
    item.createSpan({ cls: "rbw-hour-time", text: hourLabel(p.startTime, zone) });
    weatherIcon(item, p.shortForecast, isDaytime(p));
    item.createEl("strong", { text: p.temperature === null ? "\u2014" : `${p.temperature}\xB0` });
    if (!compact) item.createSpan({ cls: "rbw-hour-rain", text: p.precipitation === null ? "\u2014" : `${p.precipitation}%`, attr: { "aria-label": p.precipitation === null ? "Precipitation chance unavailable" : `Precipitation chance ${p.precipitation}%` } });
  }
}

// src/dashboard.ts
var WEATHER_VIEW = "red-beard-weather-view";
function action(parent, label, icon, key, run, iconOnly = false) {
  const button = parent.createEl("button", { cls: `rbw-action${iconOnly ? " rbw-icon-action" : ""}`, attr: { "aria-label": label, title: label, "data-rbw-focus": key } });
  smallIcon(button, icon);
  if (!iconOnly) button.createSpan({ text: label });
  button.onclick = run;
  return button;
}
function metric(parent, label, value, icon) {
  const item = parent.createDiv({ cls: "rbw-metric", attr: { "aria-label": `${label}: ${value}`, title: `${label}: ${value}` } }), head = item.createDiv({ cls: "rbw-metric-label" });
  smallIcon(head, icon);
  head.createSpan({ text: label });
  item.createEl("strong", { text: value });
}
function disclosure(parent, label, key) {
  const element = parent.createEl("details", { cls: "rbw-disclosure", attr: { "data-rbw-detail": key } });
  element.createEl("summary", { text: label, attr: { "data-rbw-focus": `detail-${key}` } });
  return element;
}
function announce(parent, text) {
  const line = parent.createDiv({ cls: "rbw-notice", attr: { role: "status" } });
  smallIcon(line, "clock-3");
  line.createSpan({ text });
}
function restoreInteraction(container, open, focus, scroll, offsets) {
  var _a, _b;
  for (const element of Array.from(container.querySelectorAll("details[data-rbw-detail]"))) element.open = open.has(element.dataset.rbwDetail);
  for (const element of Array.from(container.querySelectorAll("[data-rbw-scroll]"))) element.scrollLeft = (_a = offsets.get(element.dataset.rbwScroll)) != null ? _a : 0;
  if (focus) (_b = Array.from(container.querySelectorAll("[data-rbw-focus]")).find((el) => el.dataset.rbwFocus === focus)) == null ? void 0 : _b.focus({ preventScroll: true });
  container.scrollTop = scroll;
}
function renderWeather(container, plugin, compact = false) {
  var _a, _b, _c, _d;
  const scroll = container.scrollTop, open = new Set(Array.from(container.querySelectorAll("details[open][data-rbw-detail]")).map((el) => el.dataset.rbwDetail));
  const active = document.activeElement, focus = active && container.contains(active) ? active.dataset.rbwFocus : void 0;
  const offsets = new Map(Array.from(container.querySelectorAll("[data-rbw-scroll]")).map((el) => [el.dataset.rbwScroll, el.scrollLeft]));
  container.empty();
  container.addClass("rbw");
  container.toggleClass("rbw-compact", compact);
  const root = container.createDiv({ cls: "rbw-body" }), { state } = plugin.service, s = plugin.settings, now = Date.now(), m = glanceModel(state, s, now), o = m.observation;
  const time = (value) => formatTime(value, s.timeZone), sourceUrl = `https://forecast.weather.gov/MapClick.php?lat=${s.latitude}&lon=${s.longitude}`;
  const header = root.createDiv({ cls: "rbw-header" });
  header.createEl(compact ? "h3" : "h1", { text: s.locationName });
  if (!compact) {
    const controls = header.createDiv({ cls: "rbw-actions" });
    const refresh = action(controls, state.refreshing ? "Refreshing weather" : "Refresh weather", "refresh-cw", "refresh", () => {
      if (!state.refreshing) void plugin.refresh(true);
    }, true);
    refresh.setAttribute("aria-disabled", String(state.refreshing));
    refresh.toggleClass("rbw-refreshing", state.refreshing);
    action(controls, "Save snapshot", "file-plus", "snapshot", () => void plugin.saveSnapshot());
    action(controls, "Weather settings", "settings", "settings", () => plugin.openSettings(), true);
  }
  if (m.alerts.length) {
    const first = m.alerts[0];
    if (compact) {
      const alert = action(root, `${first.event}${m.alerts.length > 1 ? ` +${m.alerts.length - 1}` : ""}`, "triangle-alert", "open-alerts", () => void plugin.openDashboard());
      alert.addClass("rbw-warning-link");
      alert.setAttribute("title", first.headline);
    } else {
      const section = root.createEl("section", { cls: "rbw-alert-list", attr: { "aria-label": "Weather alerts" } });
      for (const a of m.alerts) {
        const details = disclosure(section, a.event, `alert-${a.id}`);
        details.addClass("rbw-alert");
        details.toggleClass("rbw-alert-severe", a.severity === "Extreme" || a.severity === "Severe");
        smallIcon(details.querySelector("summary"), "triangle-alert");
        details.createEl("p", { text: a.headline });
        details.createEl("p", { cls: "rbw-muted", text: `${a.severity} \xB7 Until ${time(a.expires)}` });
        details.createEl("p", { cls: "rbw-official-text", text: a.description });
        if (a.instruction) details.createEl("p", { cls: "rbw-official-text", text: a.instruction });
        details.createEl("a", { text: "Official NWS alert", href: a.source, attr: { target: "_blank", rel: "noopener noreferrer" } });
      }
    }
  }
  const hero = root.createEl("section", { cls: "rbw-now", attr: { "aria-label": "Current conditions" } }), current = hero.createDiv({ cls: "rbw-current-reading" });
  weatherIcon(current, ((_a = m.hourly[0]) == null ? void 0 : _a.isDaytime) === void 0 ? "" : (_b = o == null ? void 0 : o.description) != null ? _b : "", (_d = (_c = m.hourly[0]) == null ? void 0 : _c.isDaytime) != null ? _d : true, true);
  current.createDiv({ cls: "rbw-temperature", text: o ? temperature(o.temperatureC, s.units) : "\u2014" });
  const description = hero.createDiv({ cls: "rbw-current-copy" });
  description.createEl("p", { cls: "rbw-condition", text: (o == null ? void 0 : o.description) || (state.refreshing ? "Loading weather\u2026" : "Conditions unavailable") });
  const today = m.daily.find((day) => day.key === dateKey(now, s.timeZone));
  if (today) {
    const range = description.createDiv({ cls: "rbw-today-range", attr: { "aria-label": "Today's available forecast high and low" } });
    range.createSpan({ text: `High ${today.high === null ? "\u2014" : `${today.high}\xB0`}` });
    range.createSpan({ text: `Low ${today.low === null ? "\u2014" : `${today.low}\xB0`}` });
  }
  if (o) {
    description.createEl("p", { cls: `rbw-observed ${m.obsStatus === "Current" ? "" : "rbw-stale"}`, text: `Observed ${dateKey(o.timestamp, s.timeZone) === dateKey(now, s.timeZone) ? hourLabel(o.timestamp, s.timeZone, true) : time(o.timestamp)}` });
    if (m.obsStatus !== "Current") announce(hero, "Reading may be out of date.");
  } else if (!state.refreshing) announce(hero, "Current reading unavailable. Try Refresh.");
  if (m.forecastStatus !== "Current" && m.daily.length) announce(root, "Daily forecast may be out of date.");
  if (m.hourlyStatus !== "Current" && m.hourly.length) announce(root, "Hourly forecast may be out of date.");
  const metrics = root.createDiv({ cls: "rbw-metrics" }), next = m.hourly[0];
  metric(metrics, "Wind", (o == null ? void 0 : o.windKmh) === null || (o == null ? void 0 : o.windKmh) === void 0 ? "\u2014" : `${Math.round(s.units === "us" ? o.windKmh / 1.609344 : o.windKmh)} ${s.units === "us" ? "mph" : "km/h"}`, "wind");
  metric(metrics, "Hourly precip. chance", (next == null ? void 0 : next.precipitation) === null || (next == null ? void 0 : next.precipitation) === void 0 ? "\u2014" : `${next.precipitation}%`, "droplets");
  if (!compact) metric(metrics, "Humidity", (o == null ? void 0 : o.humidity) === null || (o == null ? void 0 : o.humidity) === void 0 ? "\u2014" : `${Math.round(o.humidity)}%`, "waves");
  const status = root.createDiv({ cls: `rbw-alert-status ${m.alertStatus === "Current" ? "" : "rbw-stale"}` });
  smallIcon(status, m.alertStatus === "Current" ? m.alerts.length ? "triangle-alert" : "shield-check" : "shield-question");
  status.createSpan({ text: m.alertStatus !== "Current" ? m.alerts.length ? "Alerts may be out of date" : "Alerts unavailable" : m.alerts.length ? `${m.alerts.length} active ${m.alerts.length === 1 ? "alert" : "alerts"}` : "No active weather alerts" });
  if (compact) {
    if (m.nextHours.length) hourStrip(root, m.nextHours, s.timeZone, true);
    else root.createEl("p", { cls: "rbw-muted", text: state.refreshing ? "Loading forecast\u2026" : "Hourly forecast unavailable" });
    const footer = root.createDiv({ cls: "rbw-widget-footer" });
    footer.createEl("a", { text: "NWS", href: sourceUrl, attr: { title: "National Weather Service forecast", target: "_blank", rel: "noopener noreferrer" } });
    action(footer, "Forecast", "arrow-up-right", "open-weather", () => void plugin.openDashboard());
  } else {
    const hours = root.createEl("section", { cls: "rbw-hours" });
    hours.createEl("h2", { text: "Next 24 hours" });
    if (m.hourly.length) {
      temperatureChart(hours, m.hourly, s.timeZone);
      hourStrip(hours, m.hourly.filter((_, i) => i % 3 === 0), s.timeZone);
    } else hours.createEl("p", { cls: "rbw-empty", text: state.refreshing ? "Loading the hourly outlook\u2026" : "Hourly forecast unavailable. Try Refresh." });
    const week = root.createEl("section", { cls: "rbw-week" }), weekHeader = week.createDiv({ cls: "rbw-section-header" });
    weekHeader.createEl("h2", { text: "Seven days" });
    weekHeader.createSpan({ cls: "rbw-muted", text: `Low / high \xB7 \xB0${s.units === "us" ? "F" : "C"}` });
    const temps = m.daily.flatMap((day) => [day.low, day.high].filter((v) => v !== null)), min = temps.length ? Math.min(...temps) : 0, max = temps.length ? Math.max(...temps) : 1;
    for (const day of m.daily) {
      const details = disclosure(week, "", `day-${day.key}`);
      details.addClass("rbw-day");
      const summary = details.querySelector("summary");
      summary.setAttribute("aria-label", `${day.label}: ${day.condition}. Low ${day.low === null ? "unavailable" : `${day.low} degrees`}; high ${day.high === null ? "unavailable" : `${day.high} degrees`}. Expand forecast.`);
      summary.createSpan({ cls: "rbw-day-label", text: day.label });
      weatherIcon(summary, day.condition, day.daytime);
      summary.createSpan({ cls: "rbw-day-condition", text: day.condition });
      const range = summary.createSpan({ cls: "rbw-day-range" });
      range.createSpan({ cls: "rbw-day-low", text: day.low === null ? "\u2014" : `${day.low}\xB0` });
      const track = range.createSpan({ cls: "rbw-range-track", attr: { "aria-hidden": "true" } });
      if (day.low !== null && day.high !== null) {
        const bar = track.createSpan({ cls: "rbw-range-value" }), left = (Math.min(day.low, day.high) - min) / Math.max(1, max - min) * 100, width = Math.abs(day.high - day.low) / Math.max(1, max - min) * 100;
        bar.style.left = `${Math.min(97, left)}%`;
        bar.style.width = `${Math.max(3, width)}%`;
      }
      range.createSpan({ cls: "rbw-day-high", text: day.high === null ? "\u2014" : `${day.high}\xB0` });
      smallIcon(summary, "chevron-down");
      for (const p of day.periods) {
        details.createEl("p", { text: `${p.name}: ${p.detailedForecast || p.shortForecast}` });
        details.createEl("p", { cls: "rbw-muted", text: `Wind ${p.windSpeed} ${p.windDirection} \xB7 Precipitation chance ${p.precipitation === null ? "unavailable" : `${p.precipitation}%`}` });
      }
    }
    if (!m.daily.length) week.createEl("p", { cls: "rbw-empty", text: state.refreshing ? "Loading the week ahead\u2026" : "Daily forecast unavailable. Try Refresh." });
    const sources = disclosure(root, "Weather details & sources", "sources");
    sources.addClass("rbw-sources");
    if (o) sources.createEl("p", { text: `Observation station: ${o.stationName} (${o.station}). Observed ${time(o.timestamp)}.` });
    for (const kind of ["observation", "forecast", "hourly", "alerts"]) {
      const f = state[kind];
      sources.createEl("p", { text: `${kind}: ${feedStatus(f, now, kind)}. Last checked ${time(f.checkedAt)}.` });
      if (f.source) sources.createEl("a", { cls: "rbw-source-link", text: `${kind} source`, href: f.source, attr: { target: "_blank", rel: "noopener noreferrer" } });
    }
    sources.createEl("p", { text: "Weather data: National Weather Service, public domain. Independently developed; no NOAA/NWS endorsement. Forecasts are predictions; station observations describe the named station." });
    root.createEl("a", { cls: "rbw-credit", text: "National Weather Service", href: sourceUrl, attr: { target: "_blank", rel: "noopener noreferrer" } });
  }
  Array.from(container.querySelectorAll("a[href]")).forEach((link, index) => link.dataset.rbwFocus = `link-${index}-${link.getAttribute("href")}`);
  restoreInteraction(container, open, focus, scroll, offsets);
}
var WeatherView = class extends import_obsidian2.ItemView {
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
    return { isDaytime: typeof row.isDaytime === "boolean" ? row.isDaytime : void 0, name: String((_a2 = row.name) != null ? _a2 : ""), startTime: String((_b2 = row.startTime) != null ? _b2 : ""), endTime: String((_c = row.endTime) != null ? _c : ""), temperature: numberOrNull(row.temperature), temperatureUnit: String((_d = row.temperatureUnit) != null ? _d : ""), windSpeed: String((_e = row.windSpeed) != null ? _e : "Unavailable"), windDirection: String((_f = row.windDirection) != null ? _f : ""), shortForecast: String((_g = row.shortForecast) != null ? _g : ""), detailedForecast: String((_h = row.detailedForecast) != null ? _h : ""), precipitation: numberOrNull((_i = row.probabilityOfPrecipitation) == null ? void 0 : _i.value) };
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
    const headers = { Accept: "application/geo+json", "User-Agent": "RedBeardWeather/1.1 (Obsidian; https://github.com/Red-Beard08/red-beard-weather)" };
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
var import_obsidian3 = require("obsidian");
function snapshotBody(state, settings, now, id) {
  var _a, _b, _c, _d, _e, _f, _g;
  if (![state.forecast.data, state.hourly.data, state.observation.data, state.alerts.data].some(Boolean)) throw new Error("No weather data is available to save. Open Weather and refresh first.");
  const q = markdownText, time = (v) => formatTime(v, settings.timeZone);
  const frontmatter = { type: "weather-snapshot", schema_version: 1, id, created: new Date(now).toISOString(), updated: new Date(now).toISOString(), status: "saved", weather_location: settings.locationName, weather_latitude: settings.latitude, weather_longitude: settings.longitude, weather_units: settings.units, weather_time_zone: settings.timeZone, weather_observed_at: (_b = (_a = state.observation.data) == null ? void 0 : _a.timestamp) != null ? _b : null, weather_forecast_issued_at: (_d = (_c = state.forecast.data) == null ? void 0 : _c.updated) != null ? _d : null, tags: ["weather", "output"] };
  const lines = ["---", (0, import_obsidian3.stringifyYaml)(frontmatter).trimEnd(), "---", "", `# Weather \u2014 ${q(settings.locationName)}`, "", `Saved ${time(now)}.`, "", "## Conditions", ""];
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
  const path = (0, import_obsidian3.normalizePath)(`${folder}/weather-${stamp}-${id.slice(-8)}.md`);
  return vault.create(path, body);
}

// src/settings.ts
var import_obsidian4 = require("obsidian");
var WeatherSettingsTab = class extends import_obsidian4.PluginSettingTab {
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
    new import_obsidian4.Setting(c).setName("Location name").addText((t) => t.setValue(draft.locationName).onChange((v) => {
      draft.locationName = v;
    }));
    new import_obsidian4.Setting(c).setName("Latitude").addText((t) => t.setValue(String(draft.latitude)).onChange((v) => {
      draft.latitude = v.trim() ? Number(v) : NaN;
    }));
    new import_obsidian4.Setting(c).setName("Longitude").addText((t) => t.setValue(String(draft.longitude)).onChange((v) => {
      draft.longitude = v.trim() ? Number(v) : NaN;
    }));
    new import_obsidian4.Setting(c).setName("Units").addDropdown((d) => d.addOptions({ us: "Fahrenheit / mph", si: "Celsius / km/h" }).setValue(draft.units).onChange((v) => {
      draft.units = v === "si" ? "si" : "us";
    }));
    new import_obsidian4.Setting(c).setName("Time zone").setDesc("IANA name; defaults to America/Chicago for Peoria.").addText((t) => t.setValue(draft.timeZone).onChange((v) => {
      draft.timeZone = v.trim();
    }));
    c.createEl("h3", { text: "Snapshot storage" });
    new import_obsidian4.Setting(c).setName("Snapshot folder").setDesc("Vault-relative. Changing this never moves existing notes.").addText((t) => t.setValue(draft.snapshotFolder).onChange((v) => {
      draft.snapshotFolder = v;
    }));
    c.createEl("h3", { text: "Automation and privacy" });
    new import_obsidian4.Setting(c).setName("Automatic refresh").setDesc("Weather every 15 minutes; alerts every 5 minutes while the app is visible. Refreshes on startup and resume. No closed-app notifications.").addToggle((t) => t.setValue(draft.autoRefresh).onChange((v) => {
      draft.autoRefresh = v;
    }));
    c.createEl("p", { text: "No accounts, keys, analytics, paid provider, or server. Settings and the offline cache are stored in this plugin\u2019s data.json and may sync with your vault. NWS rate limits and cache guidance apply to manual refresh too." });
    new import_obsidian4.Setting(c).addButton((b) => b.setButtonText("Save settings").setCta().onClick(async () => {
      try {
        const valid = validateSettings(draft);
        b.setDisabled(true);
        await this.plugin.applySettings(valid);
        new import_obsidian4.Notice("Weather settings saved.");
        this.display();
      } catch (error) {
        new import_obsidian4.Notice(error instanceof Error ? error.message : "Could not save weather settings.");
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
      (0, import_obsidian5.requestUrl)({ url, headers, throw: false }),
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
var WeatherPlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
    this.listeners = /* @__PURE__ */ new Set();
    this.widgetContainers = /* @__PURE__ */ new Set();
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
    this.widgetContainers.clear();
  }
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  notify() {
    if (this.disposed) return;
    for (const fn of this.listeners) fn();
    for (const container of this.widgetContainers) {
      if (!container.isConnected) this.widgetContainers.delete(container);
      else renderWeather(container, this, true);
    }
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
        new import_obsidian5.Notice(errors.length ? "Weather updated with unavailable or cached sections. Open Weather for details." : "Weather checked with NWS.");
      }
    } catch (error) {
      if (showNotice) new import_obsidian5.Notice(`Weather: ${error instanceof Error ? error.message : "Could not save the offline cache."}`);
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
      new import_obsidian5.Notice("Weather snapshot saved.");
    } catch (error) {
      new import_obsidian5.Notice(error instanceof Error ? error.message : "Weather snapshot could not be saved.");
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
    this.widgetContainers.clear();
    if (!(candidate == null ? void 0 : candidate.registerModule) || !candidate.registerWidget) return;
    this.host = candidate;
    this.detachHost.push(candidate.registerModule({ id: this.manifest.id, name: "Weather", command: `${this.manifest.id}:open-dashboard`, icon: "cloud-sun", description: "Peoria conditions, forecasts, and NWS alerts.", order: 70 }));
    this.detachHost.push(candidate.registerWidget({ id: "red-beard-weather/overview", name: "Weather", description: "Conditions now and the next few hours.", icon: "cloud-sun", defaultLayout: { w: 4, mobileW: 12, h: 3, order: 15 }, render: (_, container) => {
      for (const old of this.widgetContainers) if (!old.isConnected) this.widgetContainers.delete(old);
      this.widgetContainers.add(container);
      renderWeather(container, this, true);
    } }));
    if (candidate.registerQuickAction) this.detachHost.push(candidate.registerQuickAction({ id: "red-beard-weather/new-snapshot", name: "New Weather Snapshot", command: `${this.manifest.id}:new-snapshot`, description: "Save the current NWS data to a Markdown note." }));
  }
};
