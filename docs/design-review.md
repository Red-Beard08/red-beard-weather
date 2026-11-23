# Weather at a glance: design review and implementation

Method: two isolated reviewers (design review and deterministic/visual evidence), followed by synthesis and implementation. Review target: the widget and standalone weather view at version 1.0.0, source revision `d7f7b6f`. This is an assessment of the previous UI, not a new score for version 1.1.0.

## Design health: 23/40

| Heuristic | Score /4 | Finding |
|---|---:|---|
| Visibility of status | 2 | Multiple check/observation times compete |
| Match with real world | 2 | Feed/station mechanics dominate familiar weather information |
| User control | 3 | Commands and disclosures work; refresh loses interaction state |
| Consistency | 3 | Native Obsidian controls and theme tokens |
| Error prevention | 3 | Unknown quantities and stale alerts remain honest |
| Recognition | 2 | Users compare hourly rows mentally |
| Efficiency | 2 | Excessive scrolling and refresh resets |
| Minimalist design | 1 | The widget duplicates report-level content |
| Error recovery | 2 | Technical errors are exposed prominently |
| Help | 3 | Settings and README explain operation |

All ten heuristics apply. The interface had a functional foundation but failed its primary glanceability task. Large temperature text, native controls, and truthful missing-data states were strengths. Its composition resembled a feed inspection report rather than a weather display. The deterministic TypeScript scan returned `[]` (exit 0), showing that a clean mechanical scan cannot establish usability.

## Priority findings and response

1. **P1: weather must be read instead of recognized.** Up to 25 hourly rows precede the week. Add condition icons, a real temperature curve, precipitation bars, and daily range comparisons. Retain exact numeric and accessible text equivalents.
2. **P1: compact widget contains backend explanations.** It includes station identity, multiple check lines, licensing, endorsement, runtime, and snapshot paragraphs. At the saved approximately 198 px width, the native widget measured approximately 1,060 px tall. Give it a distinct short reading hierarchy, with secondary provenance outside the widget.
3. **P1: refresh loses context.** DOM replacement collapses native disclosures and removes focused controls. Restore keyed interaction state and update the weather widget without rebuilding the dashboard.
4. **P2: narrow layouts prioritize controls and metadata.** In the previous narrow capture, hourly weather begins around the bottom of the first viewport. Make secondary actions quieter and adapt to pane/container width, including narrow widgets in wide windows.
5. **P2: time and probability meanings need clarity.** Keep observation age visible, move per-feed timestamps to source details, call percentages precipitation chance, and never equate unknown alert status with an all-clear.

Suggested design operations were layout, distill, clarify, adapt, and harden; the implementation combines them within this weather add-on.

## Cognitive load and personas

The main failures were focus, hierarchy, chunking, and progressive disclosure, rather than excessive action choices. There were only three header actions. The temperature gives an immediate useful signal, followed by a long scroll before the next useful overview.

- Distracted mobile readers cannot quickly answer what changes next.
- Keyboard and assistive-technology users have good native semantics but face refresh-induced focus/disclosure loss.
- First-time readers see snapshot creation emphasized over reading weather, while station/check terminology adds interpretation work.

Minor observations: condition text should remain beside icons, percentages need labels, missing samples must not be connected as invented temperatures, and light/dark color alone must not carry meaning.

## User decisions

The user selected **current conditions and the next few hours** as the leading information and **graphics and summaries only**, without visible hourly tables. Existing free NWS data, commercial-friendly licensing, commands, snapshots, and mobile compatibility remain in place. Technical/source details are secondary; stale readings and alert uncertainty remain prominent.

## Acceptance and verification

- Understand location, temperature/condition, upcoming hours, and alert state within seconds.
- Show a compact widget with no station, per-feed, technical error, legal, or runtime paragraphs.
- Preserve focus, open daily forecasts/alerts, and scroll position during refresh.
- Match chart positions and probability bars to actual NWS values; preserve nulls and zeroes distinctly.
- Check current/stale/missing weather, unknown precipitation, unavailable alerts, and active severe alerts.
- Check light/dark, mobile-width and narrow desktop panes, and actual saved dashboard card width without page-wide overflow.

Assessment independence was preserved between reviewers. Native Obsidian source, CLI data, and accessibility evidence were used for the initial review. The first widget screenshot missed the scrolled target; its original dimensions and copy were measured from the live DOM instead. No browser detector overlay was injected.

The implementation passed 21 provider, model, and DOM checks. The installed view contained the chart, seven daily summaries, weather icons, and no visible table. Native refresh checks preserved focus and an expanded day. The revised widget initially measured approximately 196 by 487 px before the final compact metric treatment, with its technical explanations removed. A final source detector scan returned `[]` across the renderer, graphics, and CSS.

Automatic approval review rejected a full-window screenshot because it could expose unrelated vault information. Final visual inspection therefore used a loopback-only, Weather-only preview exported from the same rendered markup and shipped CSS, with the app's light/dark theme tokens. It covered narrow full view, wide full view, and compact light/dark widgets. The final full-view preview measured 320 px wide without horizontal overflow, all action controls were 44 px high, and seven daily summaries rendered. In the 198 px outer widget preview, its 160 px content area measured 379 px high without overflow after the compact metric treatment. This isolates layout evidence from unrelated vault content; it is not proof of an actual iOS device. The temporary preview server was stopped and its browser tab closed. No claim of real iOS or VoiceOver verification is made.
