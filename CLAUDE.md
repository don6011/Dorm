# The Dorm

Multi-campus digital nightclub for verified college students. Tagline: **Every campus. One night.**

## What this is

A scheduled, room-based social venue. Students from many campuses occupy the same rooms at the same time. The product is a night, not a feed — it opens, it fills, it closes.

## Stack

- React + Vite + TypeScript
- Mobile-first, designed at 390×844. Desktop is not a target for V1.
- Currently frontend-only on mock data. Supabase backend is deferred — do not add it, scaffold it, or install its client unless asked.

## Hard invariants — never violate these

These are product and safety rules, not preferences. If a change would break one, stop and say so rather than working around it.

1. The Suite is strictly 21+. No exception, no override.
2. Guest passes never bypass the 21+ gate. A pass can grant access to a room; it can never grant an under-21 member access to The Suite.
3. Under-21 members see zero-proof only at The Bar. No alcohol-identified items are rendered for them anywhere.
4. DOB is never public and is not freely editable after registration. Corrections go through a support path, not a profile form.
5. .edu verification is required for membership. 18+ platform minimum.
6. Block, mute, and report must be reachable in one or two taps from any surface where another member appears.

## V1 scope — locked

**In:**

- Rooms: Main Floor (The Bar is part of Main Floor), Rooftop, The Suite (VIP), The Spot, After Hours
- Live DJ presence
- Bottom nav: Home | People | Messages | Me — four items, no more
- Venue discovery through an "Explore The Dorm" overlay, not a nav tab

**Explicitly out of V1** (built to expand later, do not implement now): Crews, public feeds, followers, campus hubs, virtual currency, stores, achievements.

Do not add features outside this list. If something seems missing, ask.

## Product decisions (settled — do not reopen without asking)

- **Rooms.** Main Floor; The Bar (child of Main Floor, so rule 3 has an addressable place); Rooftop; The Suite (21+ **and** guest-pass-only — 21+ is the floor, not the headline); Suite Booth (child of The Suite); The Spot; After Hours.
- **After Hours concentrates the night.** When After Hours opens, Main Floor, The Bar, Rooftop and The Spot close. The Suite stays open. Expressed via each room's `openDuring`, not code.
- **Cut from V1:** Open Circles, Music Trivia, Campus Clash. Rooms must not make games hard to add later (games would be their own records pointing at a room), but don't build them.
- **Capacity rolls upward.** A room's capacity counts the room and everything beneath it (see the comment on `capacity` in `rooms.ts`). Not yet implemented.
- **Rule 3 lives in the machine, scoped to items and menus.** `canSeeAlcohol` decides whether alcohol-identified *items and menus* render; `visibleMenu` applies it and is the **only** gate (the menu component doesn't re-check). Every menu goes through it, including The Suite's. Menus are display only: no ordering or prices in V1. It does not gate art: there is one art set, with nothing legible, so there is no art variant to branch on. Don't build one.
- **Headcounts: show occupancy for barriers you can overcome, hide it for barriers you can't.** A pass, .edu verification or a full room can be overcome, so the count shows. Age can't, so it's hidden: show the lock, not the party. This lives in `showsHeadcount` in the machine. Access reports age before "closed", so the permanent barrier is the one shown.
- **Locked and closed rooms stay visible.** The Suite shows a 21+ lock to under-21 members, never hidden. Rooms closed at After Hours show dimmed beneath a divider, so it reads as the night moving, not the app shrinking.
- **Dev tools dispatch through the machine.** The dev switcher may only use machine actions and `createVenueState` (which is what sign-in does). It never sets state directly, so it can't show a state the machine can't produce.
- **Safety actions.** One person sheet. Tapping any person on any surface opens it; block, mute and report live there (two taps total). Every person-tap routes to it — no per-card safety icons.
  - Block acts on the second tap, closes the sheet and shows an Undo toast for a few seconds; it never asks to confirm. Mute and Report confirm with a line in the sheet. The member acted on is never told.
  - Block hides a member from People, room rosters and avatars, threads, every chat and invitations, and ends the connection (Undo restores it). Mute hides only their messages, in every chat including DMs.
  - Members render only through `PersonTap` in `src/people/`; a test fails if a member's name is rendered anywhere else.
- **Presence never reveals age.** A member in The Suite or the Suite Booth shows as "In The Dorm" to anyone outside that age-gated area: People rows, the person sheet, invitations, threads, everywhere presence appears. `presenceOf` in the machine decides it. The person sheet never shows age, DOB or 21+ status.
- **Room screens.** One generic `RoomScreen` driven by each room's record (art, crowd phrase, `scene` layout); Main Floor's Double Halo and hotspots are data on its record. Home shows the room you're in, or Main Floor when it's open (`homeRoom`); otherwise the doors screen. Back goes to the parent room (The Bar → Main Floor), else Main Floor if open, else Leave.
  - Locked doors explain in place via `lockedReason`: "The Suite is 21+." only ever reaches under-21 members; 21+ without a pass reads "Entry by guest pass." Age is never the headline for them.
  - "N from your campus" is derived (`campusCount`): members in the room who share your campus, minus blocked. Hidden at 0. Never invented.
  - The Double Halo ticker is built from tonight's programming only (`lineup`), never member data, so no school names.
  - Chat drawer: peek / half / full; the bottom nav hides at half and full. Escape on the person sheet closes only the sheet.
- **The Suite.** Its own `SuiteScreen` (also used for the Suite Booth): gold, framed scene, no halo, small roster, a Booth card, a menu.
  - The Suite Booth is reachable only from inside The Suite (`reachedFrom: 'parent'` on its record; refusal `throughParent`).
  - 21+ without a pass (or with one when it's full) gets the **door sheet**: head count, never who is inside; "Request a pass" and "Join the waitlist" (waitlist only when full). Under-21 never gets a door: the lock and "The Suite is 21+." in place.
  - `requestPass` / `joinWaitlist` are refused in the machine unless the refusal really is "needs a pass" (or "full" for the waitlist), so under-21 members can't request even by direct dispatch.
  - `passGranted` stands in for the server's grant; it re-checks the room's age gate itself. Only the dev panel's "Grant Suite pass" sends it. **Who grants passes in production is an open product decision.**
- **Repos.** `don6011/Dorm` is the base. The Lovable prototype (`don6011/the-dorm-experience`) and the zipped "the-dorm v1" build are parts bins only: port pieces one at a time (chat sheet, keyboard fix, offline outbox, service seam) when we reach them, never wholesale.
- **Schools.** School name is a plain-text member attribute. No real school logos, marks or colors as brand elements. Every campus gets the same neutral token: a letter monogram in our palette. The About screen carries a non-affiliation line.

## Visual identity

- Neon purple is the primary. Gold is reserved for VIP / The Suite and must not be used for ordinary UI accents.
- Logo: brush-script "THE DORM", white on transparent (`design/logo-white.webp`).
- Dark interface throughout.
- Reference mockup: `design/mockup-v1.webp`. It is mood, not spec — where it conflicts with the invariants or scope above, the invariants and scope win.
- Art rules: drinks may appear as unlabeled glassware and backlit shelves only — no readable labels or identifiable bottle silhouettes, anywhere. Banner crowns are white; gold appears only in The Suite.
- Room art lives in `src/assets/rooms/<room.art>.webp` and is picked up by file name; a missing file falls back to a gradient tile. Status:
  - In: Main Floor, The Bar, Rooftop, The Suite (from the Lovable prototype).
  - Needs a 1024px regeneration: The Bar and The Suite (current files are the 768px "-young" versions).
  - Being regenerated separately: Suite Booth, The Spot, After Hours, and the arrival scene.

## How to work in this repo

- Plan before multi-file changes. Use plan mode for anything touching more than two files or introducing a new pattern.
- Run the build and typecheck yourself before reporting a task done. Do not report success on code you have not run.
- Small commits. One logical change each.
- Mock data lives in one place. Do not scatter fixtures through components.
- No new dependencies without asking — especially UI kits and state libraries. This app is small enough not to need them.
- Prefer editing existing files over creating new ones.

## Where state belongs

Night phase and room occupancy are one state machine, not per-screen state. Any screen that needs to know where the user is reads from it; no screen derives it independently. Room access checks (21+, guest pass, verification) live in that machine and are enforced in one place.

## Notes for future sessions

- Backend is deferred on purpose. When it lands, it is Supabase.
- Rooms should be data, not code — one shape describing each room's label, parent, capacity, access rule, and art. Adding a room should mean adding a record, not writing a component.

## Code map

- `src/venue/rooms.ts` — room records + load-time self-check (parents exist, no cycles, The Suite and everything under it is 21+).
- `src/venue/machine.ts` — the venue state machine. `canEnter` is the **only** access check. Access is inherited: entering a room requires passing every ancestor's rule. Age is checked before guest passes are consulted, so a pass cannot affect the age result. The app never holds a DOB: `Viewer.eligibility` carries `is18`/`is21` flags, computed server-side from DOB when the backend lands (invariant 4).
- `src/venue/VenueProvider.tsx` — `useVenue()` for screens. Screens show `canEnter` reasons; they never re-express a rule.
- `src/social/social.ts` — connections, mute, block (with undo), report, and the selectors every surface filters through (`visibleMembers`, `visibleMessages`, `visibleThreads`, `visibleInvites`). The only place block/mute rules live. `SocialProvider.tsx` exposes it with the member directory.
- `src/people/` — `PersonTap` (the only way members render), `PersonSheet` (the one sheet + Undo toast).
- `src/nav/BottomNav.tsx`, `src/tabs/Tabs.tsx` — the four tabs. `hidden` on the nav is for open chat sheets.
- `src/rooms/` — `RoomScreen` (scene, halo, hotspots, context, action), `SuiteScreen` (The Suite + Booth), `DoorSheet` (pass rooms), `Menu.tsx` (one menu for The Bar and The Suite), `navigation.ts` (`backTarget`, `opensDoor`), `lineup.ts`, `art.ts` (art by file name, `inSuite`). Menu and door sheets render into `<body>` so they sit above the bottom nav.
- `src/chat/` — `chat.ts` (posting rule: only in the room you're in), `ChatProvider`, `ChatDrawer` (ported from the zip), `useKeyboardInset` (iOS keyboard).
- `src/testing/renderApp.tsx` — test harness that wires the whole app on mock data.
- `src/data/mock.ts` — the only fixture file.
- Tests: `npm test` (vitest; dev-only, pinned). Component tests opt into a DOM with a `// @vitest-environment jsdom` first line. Lint: `npm run lint` (oxlint, from the starter).
