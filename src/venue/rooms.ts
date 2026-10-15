// Rooms are data. Adding a room means adding a record here — nothing else.
// The self-check at the bottom runs at module load and refuses a bad config.

export type NightPhase = 'closed' | 'live' | 'afterHours';

export interface AccessRule {
  /** 18 is the platform floor. 21 is a hard gate that nothing overrides. */
  minAge: 18 | 21;
  /** 'guestPass': a valid pass for this room is required, on top of minAge. */
  entry: 'open' | 'guestPass';
}

export interface RoomRecord {
  id: string;
  label: string;
  /** Entering a room requires passing every ancestor's rules too. */
  parent: string | null;
  /**
   * Max people in this room. null = uncapped.
   *
   * Decided, not yet implemented: capacity counts this room AND everything
   * beneath it. Access inherits downward, so occupancy rolls upward — someone
   * at The Bar counts against Main Floor. Otherwise a capped parent can be
   * bypassed by routing through a child. Today the check counts the target
   * room only, which is safe while no parent with children has a cap.
   */
  capacity: number | null;
  access: AccessRule;
  /** Phases this room is open. A child is only open when its ancestors are. */
  openDuring: readonly NightPhase[];
  /** Art key. Assets are resolved by screens, not here. */
  art: string;
}

const RECORDS = [
  {
    id: 'main-floor',
    label: 'Main Floor',
    parent: null,
    capacity: null,
    access: { minAge: 18, entry: 'open' },
    openDuring: ['live'],
    art: 'main-floor',
  },
  {
    id: 'bar',
    label: 'The Bar',
    parent: 'main-floor',
    capacity: 60,
    access: { minAge: 18, entry: 'open' },
    openDuring: ['live'],
    art: 'bar',
  },
  {
    id: 'rooftop',
    label: 'Rooftop',
    parent: null,
    capacity: 400,
    access: { minAge: 18, entry: 'open' },
    openDuring: ['live'],
    art: 'rooftop',
  },
  {
    id: 'suite',
    label: 'The Suite',
    parent: null,
    capacity: 40,
    access: { minAge: 21, entry: 'guestPass' },
    openDuring: ['live', 'afterHours'],
    art: 'suite',
  },
  {
    id: 'suite-booth',
    label: 'Suite Booth',
    parent: 'suite',
    capacity: 8,
    access: { minAge: 21, entry: 'open' },
    openDuring: ['live', 'afterHours'],
    art: 'suite-booth',
  },
  {
    id: 'spot',
    label: 'The Spot',
    parent: null,
    capacity: 300,
    access: { minAge: 18, entry: 'open' },
    openDuring: ['live'],
    art: 'spot',
  },
  {
    id: 'after-hours',
    label: 'After Hours',
    parent: null,
    capacity: null,
    access: { minAge: 18, entry: 'open' },
    openDuring: ['afterHours'],
    art: 'after-hours',
  },
] as const satisfies readonly RoomRecord[];

export type RoomId = (typeof RECORDS)[number]['id'];

export interface Room extends RoomRecord {
  id: RoomId;
  parent: RoomId | null;
}

export const ROOMS: readonly Room[] = RECORDS;

/** The Suite is strictly 21+ (invariant 1). Checked below, not trusted. */
export const SUITE_ID = 'suite' satisfies RoomId;

/** Returns every config error; empty means the rooms are valid. */
export function validateRooms(rooms: readonly RoomRecord[]): string[] {
  const errors: string[] = [];
  const byId = new Map<string, RoomRecord>();

  for (const room of rooms) {
    if (byId.has(room.id)) errors.push(`duplicate room id "${room.id}"`);
    byId.set(room.id, room);
    if (room.capacity !== null && room.capacity < 1) {
      errors.push(`room "${room.id}" has capacity ${room.capacity}`);
    }
  }

  // Parent chain: every parent exists, no cycles. A bad chain would
  // otherwise surface as an infinite loop in the access check.
  const chainOk = new Set<string>();
  for (const room of rooms) {
    const seen = new Set<string>();
    let cur: RoomRecord | undefined = room;
    while (cur) {
      if (seen.has(cur.id)) {
        errors.push(`parent cycle through "${room.id}": ${[...seen].join(' → ')} → ${cur.id}`);
        break;
      }
      seen.add(cur.id);
      if (cur.parent === null) {
        chainOk.add(room.id);
        break;
      }
      const parent = byId.get(cur.parent);
      if (!parent) {
        errors.push(`room "${cur.id}" has unknown parent "${cur.parent}"`);
        break;
      }
      cur = parent;
    }
  }

  for (const room of rooms) {
    if (!chainOk.has(room.id) || room.parent === null) continue;
    const parent = byId.get(room.parent)!;
    for (const phase of room.openDuring) {
      if (!parent.openDuring.includes(phase)) {
        errors.push(`room "${room.id}" opens during "${phase}" but its parent "${parent.id}" does not`);
      }
    }
  }

  // Invariant 1: The Suite and everything under it is 21+. Inheritance
  // already enforces this in the access check; requiring each record to
  // say so keeps the data honest for anyone reading it.
  const suite = byId.get(SUITE_ID);
  if (!suite) {
    errors.push(`The Suite ("${SUITE_ID}") is missing`);
  } else {
    for (const room of rooms) {
      if (!chainOk.has(room.id)) continue;
      let cur: RoomRecord | undefined = room;
      let underSuite = false;
      while (cur) {
        if (cur.id === SUITE_ID) underSuite = true;
        cur = cur.parent === null ? undefined : byId.get(cur.parent);
      }
      if (underSuite && room.access.minAge !== 21) {
        errors.push(`room "${room.id}" is in The Suite but is not 21+`);
      }
    }
  }

  return errors;
}

const configErrors = validateRooms(ROOMS);
if (configErrors.length > 0) {
  throw new Error(`Invalid room config:\n- ${configErrors.join('\n- ')}`);
}

const ROOM_BY_ID = new Map<RoomId, Room>(ROOMS.map((r) => [r.id, r]));

export function getRoom(id: RoomId): Room {
  return ROOM_BY_ID.get(id)!;
}

/** The room followed by its ancestors, outermost last. */
export function roomChain(id: RoomId): Room[] {
  const chain: Room[] = [];
  for (let cur: Room | null = getRoom(id); cur; cur = cur.parent ? getRoom(cur.parent) : null) {
    chain.push(cur);
  }
  return chain;
}
