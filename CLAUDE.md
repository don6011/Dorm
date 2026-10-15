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

## Visual identity

- Neon purple is the primary. Gold is reserved for VIP / The Suite and must not be used for ordinary UI accents.
- Logo: brush-script "THE DORM", white on transparent (`design/logo-white.webp`).
- Dark interface throughout.
- Reference mockup: `design/mockup-v1.webp`. It is mood, not spec — where it conflicts with the invariants or scope above, the invariants and scope win.

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
