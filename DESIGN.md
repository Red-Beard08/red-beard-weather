# Weather presentation

## Established visual system

Inherit Obsidian's native typeface, theme surfaces, controls, focus styles, and icon vocabulary. This is an Operate surface: recognize the weather, inspect the next hours, and continue working. The dashboard host owns its surrounding card and heading; the plugin adds no nested card shell.

## Hierarchy

Widget: active warning when present, location, condition symbol with current temperature, condition text, today's available high/low, wind and hourly precipitation chance, three upcoming hours, observation age, and one link to the full forecast. No station names, per-feed check lines, legal paragraphs, runtime explanations, or snapshot instructions.

Full view: current conditions and relevant warnings, compact next-hour values, a 24-hour temperature curve and precipitation probability bars, hourly condition symbols, seven daily range rows with expandable official wording, then secondary source/freshness details. Snapshot and settings are secondary actions. No visible hourly data table.

## Graphics and semantics

Use the host's Lucide weather icons with accompanying condition text. Amber represents sun/temperature, blue precipitation, and semantic warning/error tokens represent alerts. Actual temperature samples define the curve; missing samples break it. Precipitation bars have an explicit 0–100% probability scale. Day ranges contain only available day/night forecast values; missing high/low stays a dash.

Use scoped container queries for narrow panes/widgets in wide desktop windows. Match light/dark theme tokens. Use 44px touch targets, visible focus, semantic native disclosures, concise accessible chart descriptions, and numerical text equivalents. Preserve focus, disclosure, and horizontal scroll state during refresh. No decorative motion, external images, gradients, or chart framework.
