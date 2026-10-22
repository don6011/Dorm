// Dev-only. Signs in as a mock viewer, shows the codes the mock server
// "emails", and simulates the time of night so every state can be seen
// without waiting for midnight.
//
// It may only drive the app the way production does: signing in as a viewer
// makes a session through the account service (what sign-in does), time
// arrives as ticks from the provider's clock, and headcounts arrive as
// `occupancy` actions. It never sets state directly, so it can't show a state
// the machine can't produce. Incoming direct messages arrive as `dmReceived`,
// through the store's drop rules.

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';

import { AccountProvider, useAccount } from '../account/AccountProvider.tsx';
import { deviceStorage, SESSION_KEY } from '../account/service.ts';
import { AccountGate } from '../account/Signup.tsx';
import { MOCK_CONNECTIONS, MOCK_DM_INCOMING, MOCK_VIEWERS, tonight } from '../data/mock.ts';
import { createMockAccountService, type MockAccountService } from '../data/mockService.ts';
import { MockVenue } from '../data/MockVenue.tsx';
import { formatTime } from '../explore/labels.ts';
import { useSocial } from '../social/SocialProvider.tsx';
import type { NightSchedule } from '../venue/machine.ts';
import { getRoom } from '../venue/rooms.ts';
import { useVenue } from '../venue/VenueProvider.tsx';

type ViewerKey = keyof typeof MOCK_VIEWERS;

const DM_SENDERS = Object.keys(MOCK_CONNECTIONS).filter((id) => MOCK_CONNECTIONS[id] === 'connected');

const HOUR = 3_600_000;
// Every preset is an offset from the schedule, and its label shows the time it
// lands on, so changing the night's hours never leaves a stale label here.
const TIMES = {
  real: { label: 'Real clock', at: null },
  beforeDoors: { label: 'Before doors', at: (s: NightSchedule) => s.opensAt - HOUR },
  live: { label: 'Live', at: (s: NightSchedule) => s.opensAt + HOUR },
  lastCall: { label: 'Last call', at: (s: NightSchedule) => s.lastCallAt + 2 * 60_000 },
  afterHours: { label: 'After Hours', at: (s: NightSchedule) => s.afterHoursAt + HOUR },
  afterClose: { label: 'After close', at: (s: NightSchedule) => s.closesAt + HOUR },
} as const;
type TimeKey = keyof typeof TIMES;

function readParams(): { viewer: ViewerKey | null; time: TimeKey } {
  const q = new URLSearchParams(window.location.search);
  const viewer = q.get('viewer');
  const time = q.get('time');
  return {
    // ?viewer= signs straight in as that viewer; without it, a first visit opens on arrival.
    viewer: viewer && viewer in MOCK_VIEWERS ? (viewer as ViewerKey) : null,
    // Previews open mid-night so the rooms are open whenever someone checks the
    // link; "Real clock" is one tap away in the panel, or ?time=real.
    time: time && time in TIMES ? (time as TimeKey) : 'live',
  };
}

function simulate(timeKey: TimeKey, schedule: NightSchedule): { base: number; t0: number } | null {
  const at = TIMES[timeKey].at;
  return at ? { base: at(schedule), t0: Date.now() } : null;
}

interface PanelProps {
  service: MockAccountService;
  timeKey: TimeKey;
  onTime: (k: TimeKey) => void;
  schedule: NightSchedule;
  open: boolean;
  onToggle: () => void;
}

export function DevRoot() {
  const [initial] = useState(readParams);
  const [timeKey, setTimeKey] = useState<TimeKey>(initial.time);
  const [schedule] = useState(() => tonight(Date.now()));
  const [sim, setSim] = useState(() => simulate(initial.time, schedule));
  // Lives here, not in the panel: signing in as someone else remounts the venue.
  const [panelOpen, setPanelOpen] = useState(false);

  // Simulated time runs forward from the chosen point, like a real night.
  const clock = useMemo(() => (sim ? () => sim.base + (Date.now() - sim.t0) : Date.now), [sim]);
  const [service] = useState(() => {
    const svc = createMockAccountService({ clock });
    if (initial.viewer) deviceStorage().setItem(SESSION_KEY, svc.signInAs(initial.viewer).token);
    return svc;
  });
  // The mock server reads the same clock (ages, message times).
  useEffect(() => service.setClock(clock), [service, clock]);

  const panel: PanelProps = {
    service,
    timeKey,
    onTime: (k) => {
      setTimeKey(k);
      setSim(simulate(k, schedule));
    },
    schedule,
    open: panelOpen,
    onToggle: () => setPanelOpen(!panelOpen),
  };

  return (
    <AccountProvider service={service}>
      <DevShell clock={clock} panel={panel} />
    </AccountProvider>
  );
}

/** The panel sits over arrival and signup too; its venue tools exist once someone is in. */
function DevShell({ clock, panel }: { clock: () => number; panel: PanelProps }) {
  const { session } = useAccount();
  return (
    <>
      <AccountGate>
        {(s) => (
          <MockVenue session={s} schedule={panel.schedule} clock={clock}>
            <DevPanel {...panel}>
              <VenueTools />
            </DevPanel>
          </MockVenue>
        )}
      </AccountGate>
      {!session && <DevPanel {...panel} />}
    </>
  );
}

function DevPanel({ service, timeKey, onTime, schedule, open, onToggle, children }: PanelProps & { children?: ReactNode }) {
  const { session, signedIn } = useAccount();
  const code = useSyncExternalStore(service.subscribe, service.latestCode);
  const current = (Object.keys(MOCK_VIEWERS) as ViewerKey[]).find((k) => MOCK_VIEWERS[k].profile.id === session?.viewer.profile.id) ?? '';

  return (
    <aside className="dev-panel" data-open={open}>
      <button className="dev-toggle" onClick={onToggle}>
        DEV
      </button>
      {open && (
        <div className="dev-body">
          <label>
            Sign in as
            <select value={current} onChange={(e) => e.target.value && signedIn(service.signInAs(e.target.value as ViewerKey))}>
              <option value="">{session ? 'Signed-up member' : 'Signed out'}</option>
              {Object.keys(MOCK_VIEWERS).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            Time
            <select value={timeKey} onChange={(e) => onTime(e.target.value as TimeKey)}>
              {Object.entries(TIMES).map(([k, t]) => (
                <option key={k} value={k}>
                  {t.at ? `${t.label} (${formatTime(t.at(schedule))})` : t.label}
                </option>
              ))}
            </select>
          </label>
          <span className="dev-code">{code ? `Code for ${code.email}: ${code.code}` : 'No code sent yet'}</span>
          {children}
        </div>
      )}
    </aside>
  );
}

function VenueTools() {
  const { state, dispatch } = useVenue();
  const social = useSocial();
  const booth = getRoom('suite-booth');
  const [received, setReceived] = useState(0);

  // Stands in for the server: the next of your connections (as of sign-in)
  // sends the next line. Whether it lands is the store's call, not the panel's:
  // a member you've blocked since is dropped like any other message from them.
  const receive = () => {
    const from = DM_SENDERS[received % DM_SENDERS.length];
    const body = MOCK_DM_INCOMING[received % MOCK_DM_INCOMING.length];
    social.dispatch({ type: 'dmReceived', message: { id: `dev-dm-${received + 1}`, withId: from, authorId: from, body, sentAt: state.now } });
    setReceived(received + 1);
  };
  const lastId = `dev-dm-${received}`;

  return (
    <>
      <button onClick={() => dispatch({ type: 'occupancy', counts: { [booth.id]: booth.capacity ?? 0 } })}>
        Fill {booth.label}
      </button>
      {/* Stands in for whoever grants Suite passes (undecided). The machine
          re-checks 21+, so this does nothing for an under-21 viewer. */}
      <button onClick={() => dispatch({ type: 'passGranted', pass: { roomId: 'suite', expiresAt: state.schedule.closesAt } })}>
        Grant Suite pass
      </button>
      <button onClick={receive}>Receive a message</button>
      {received > 0 && (
        <span role="status">{social.state.dms.some((m) => m.id === lastId) ? 'Delivered' : 'Dropped: blocked or not connected'}</span>
      )}
    </>
  );
}
