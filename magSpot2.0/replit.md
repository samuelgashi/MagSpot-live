# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Magspot 2.0 — Scheduling Algorithm (FullAutomationModal.tsx)

Final approved logic for `generateContinuousBlocks`:

1. **Sample** — each device draws daily hours per act from variance `[min, max]` around target
2. **Normalize to 24h** — acts below `minBlockH` are dropped, remainder renormalized
3. **Segments** — lock closed = 1 block; lock open + `h×0.4 ≥ minBlockH` = 2 blocks (60/40)
4. **Ranged acts** (e.g. Sleep 00–06) placed first into their time window
5. **Shuffle** free segments + greedy pass: no same act appears twice in a row
6. **Sequential placement** — back-to-back through remaining slots, no gap-searching
7. **Sub-minimum leftovers** (`rem < minBlockH`) are discarded, never placed

Key invariants: every block ≥ minBlockH; locked acts = exactly 1 block; no same-color adjacency.

## Magspot 2.0 — Device Grid Interaction

- In `DeviceGrid.tsx`, clicks on the top device bar are delayed briefly to distinguish single-click selection from fast double-click opening.
- Single click toggles selection; fast double click on the same top bar cancels the pending toggle and opens a focused single-device floating window.
- The floating device window is non-modal, draggable by its top bar, stays in front, and mirrors the normal empty device-card format without sample screen content.
- The floating device window uses opaque backgrounds for screen focus and can be resized from the bottom-right corner while preserving the current placeholder phone aspect ratio from the user's reference image (`1024 / 509` height-over-width). The main grid device cards temporarily use the same aspect ratio for visual consistency.
- Grid device card corner radius is proportional (`clamp(5px, 8%, 16px)`) so large cards keep the soft rounded look while small scaled cards do not lose too much future real-screen image area to oversized corners.
- Horizontal mouse wheel input over the grid area or the grid scale slider adjusts the device scaling. Horizontal scroll right increases columns/smaller device cards; horizontal scroll left decreases columns/larger device cards. Vertical wheel input remains normal page/grid scrolling.
- Horizontal scale scrolling is accumulated with a threshold to avoid overly sensitive scaling from small touchpad/mouse wheel deltas.
- Device numbers in the grid/focused top bars are shown without leading zeros, slightly larger, and right-aligned in a fixed `3ch` width so their visual position stays like the old zero-padded layout.
- While a focused single-device window is open, the original grid card is highlighted with a distinct origin color so the user can see where that device came from. Closing the focused window removes that specific device from the current selection.
- Later, when real Android streams are connected, replace the placeholder ratio with each device's real screen dimensions/rotation provided by the backend.

## Magspot 2.0 — Device Registry

- The mini sidebar includes a Devices entry that opens `DeviceRegistryPanel.tsx`.
- The panel lets the user capture frontend-prep records per device number: VPN country, name/account details, Gmail credentials, second email, 2FA notes, card details, billing date, and miscellaneous notes.
- All visible labels in `DeviceRegistryPanel.tsx` use the shared language context, so English and German views stay consistent with the selected language.
- Current storage is browser-local under `magspot-device-registry-v1`; later backend integration should replace this with secure server-side storage and real scanned device identities.
- Future scanned Android devices must be assigned by stable device identity, not by IP address. IPs from OTG/LAN/router scans are only current connection endpoints and may change after router restarts. Use ADB serial/USB identity/MAC/Android ID or a multi-signal fingerprint to map each physical phone back to its fixed Magspot device number, group, account data, and notes; update only `currentIp` on rescan.

## Magspot 2.0 — Schedule Results Calendar

- The mini sidebar includes a Schedule/Calendar entry under Devices that opens `ScheduleResultsPanel.tsx`.
- The Task Planner's "Save Schedule" button stores the latest generated non-stale plan in browser-local storage under `magspot-schedule-results-v1`.
- Saving a plan now asks for confirmation before replacing an existing saved schedule, with a specific warning when selected devices and dates overlap. After a successful save, the Task Planner modal closes automatically.
- The Schedule panel reads that saved plan and renders a per-device 00:00–24:00 timeline for each selected planner date. This is frontend scaffolding for the later backend-backed device pickup calendar.
- Schedule timeline blocks are intentionally wider via horizontal scrolling and render compact labels on all blocks; Google, YouTube Shorts, and TikTok use centered logos for small segments.
- The Schedule panel has an edit mode for local schedule maintenance: users can select devices, select individual timeline blocks, delete selected blocks, delete the active day for selected devices, delete the active day for all devices, or open the Task Planner scoped to the selected devices and active date. Scoped Task Planner saves merge into the existing calendar instead of replacing unrelated days/devices.
- Task Planner overwrite confirmation is now a custom preview dialog instead of a browser confirm. It shows affected device count, affected dates, device/IP rows, and compact summaries of the already saved plan before the user confirms replacing that scoped area.
- Plans cannot be created or saved for past dates. The calendar blocks "Plan für Auswahl erstellen" for past days, and the Task Planner filters/guards past date selections before saving.
- Past-date blocking uses local calendar day keys, so the current local day remains valid for scheduling and saving.
- The mini sidebar has a bottom Settings icon for choosing an app timezone. Schedule/calendar "today" and past-date blocking use this app timezone instead of Replit/server time, with the browser timezone used as the default.
- The focused single-phone view now has a right-side action rail matching the phone display height. Its Info button opens a structured info panel to the right, showing the saved Device Registry data for that device plus basic technical fields.
- Double-clicking a device in the sidebar miniatures opens the same focused single-phone view as double-clicking in the grid. The focused device is marked with the purple focus-origin style in both places, and closing the single view removes that device from the current selection.
- The focused view info panel only displays data explicitly saved in the Devices registry. It no longer shows automatic technical/API fields or generated placeholder values.
- The Devices registry VPN country field now uses a full country lookup. Typing filters matching countries live, and the selected/current match stores the country name together with ISO country code and flag for future visual/database use.
- Saving the Devices registry closes the registry panel automatically. The focused-view info panel has a wider layout, no duplicate header, wraps long values, and supports one-click copying on each displayed field.
- The focused-view info panel has a top-right edit/save action. Edit mode lets the user update the selected device's registry fields inline; saving writes the device data and returns the panel to normal read-only display.
- Copyable fields in the focused-view info panel now show a visible copy chip. After clicking, the field briefly changes to a green copied confirmation.
- The focused single-phone action rail now includes top-to-bottom device controls for Home, Back, Volume Up, Volume Down, Lock Screen, and Restart Device. These call the API server's ADB control route for the selected device. The info panel read-only layout displays one field per row for better use of space.
- The Devices registry Device section order is fixed as Device Number → Device Model → VPN Country → Country Code. The layout must avoid overlap between the model plus button, VPN country input, and country-code box.
- Device registry records now include a reusable Device Model field. New model names are added only via the plus button and saved to the reusable model list. That list appears as a dropdown only while the Device Model input is focused; selecting a model applies it to the current device and closes the dropdown, but does not remove the model from the reusable list. Model names display in device header bars between IP and country badge.
- Clearing a device registry record requires an app-internal second confirmation dialog in English ("Are you sure you want to delete this device data?") with Cancel and Yes, delete actions. Do not use native browser confirm/alert dialogs.
- Device header status dots no longer represent raw online/busy/offline API status. They now represent schedule execution intent: green when the current app-timezone day plan has an active block for that device, grey when no task is currently planned, and red is reserved for future per-device execution/log health reporting when a planned task should be running but is missing.
- Sidebar device miniatures use the same shared schedule-based indicator logic as the grid and focused phone header, so grey/green/red lights stay synchronized across all device views.
- The left sidebar activities area intentionally has extra bottom padding so the last activity button remains fully visible with breathing room at the bottom of the scroll range.
- Horizontal wheel input over the device grid is reserved for grid scale changes only and must not horizontally move the whole page in the new-tab/fullscreen view. The app root should remain overflow-hidden with page overscroll disabled.
- Schedule/calendar edit strings, overwrite dialog text, past-date warnings, and the dashboard device search placeholder are routed through the central EN/DE language map to avoid mixed German/English UI.
- Saved plan rows retain device id, fixed display number, current IP, dates, and absolute activity blocks. Future backend implementation must attach plans to stable device identity, not IP address.

## Magspot 2.0 — Context Menus

- Context-menu submenus render through a portal so side submenus such as "Move to Group" are not clipped by the parent menu and can show created groups reliably.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
