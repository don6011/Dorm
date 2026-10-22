// Dev-only. Swaps the mock viewer and simulates the time of night so every
// room state can be seen without waiting for midnight.
//
// It may only drive the machine the way production does: a viewer swap is a
// fresh createVenueState (what sign-in does), time arrives as ticks from the
// provider's clock, and headcounts arrive as `occupancy` actions. It never
// sets state directly, so it can't show a state the machine can't produce.

import { useMemo, useState } from 'react';

import App from '../App.tsx';
import { MOCK_CHAT, MOCK_CONNECTIONS, MOCK_DJ, MOCK_MEMBERS, MOCK_OCCUPANCY, MOCK_PRESENCE, MOCK_THREADS, MOCK_VIEWERS, tonight } from '../data/mock.ts';
import { SocialProvider } from '../social/SocialProvider.tsx';
import { ChatProvider } from '../chat/ChatProvider.tsx';
import type { NightSchedule } from '../venue/machine.ts';
import { getRoom } from '../venue/rooms.ts';
import { useVenue, VenueProvider } from '../venue/VenueProvider.tsx';

type ViewerKey = keyof typeof MOCK_VIEWERS;

const HOUR = 3_600_000;
const TIMES = {
  real: { label: 'Real clock', at: null },
  beforeDoors: { label: 'Before doors', at: (s: NightSchedule) => s.opensAt - HOUR },
  live: { label: 'Live (10 PM)', at: (s: NightSchedule) => s.opensAt + HOUR },
  afterHours: { label: 'After Hours (1 AM)', at: (s: NightSchedule) => s.afterHoursAt + HOUR },
  afterClose: { label: 'After close', at: (s: NightSchedule) => s.closesAt + HOUR },
} as const;
type TimeKey = keyof typeof TIMES;

function readParams(): { viewer: ViewerKey; time: TimeKey } {
  const q = new URLSearchParams(window.location.search);
  const viewer = q.get('viewer');
  const time = q.get('time');
  return {
    viewer: viewer && viewer in MOCK_VIEWERS ? (viewer as ViewerKey) : 'over21WithSuitePass',
    time: time && time in TIMES ? (time as TimeKey) : 'real',
  };
}

function simulate(timeKey: TimeKey, schedule: NightSchedule): { base: number; t0: number } | null {
  const at = TIMES[timeKey].at;
  return at ? { base: at(schedule), t0: Date.now() } : null;
}

export function DevRoot() {
  const [initial] = useState(readParams);
  const [viewerKey, setViewerKey] = useState<ViewerKey>(initial.viewer);
  const [timeKey, setTimeKey] = useState<TimeKey>(initial.time);
  const [schedule] = useState(() => tonight(Date.now()));
  const [sim, setSim] = useState(() => simulate(initial.time, schedule));
  // Lives here, not in the panel: a viewer swap remounts everything under the provider.
  const [panelOpen, setPanelOpen] = useState(false);

  const onTime = (k: TimeKey) => {
    setTimeKey(k);
    setSim(simulate(k, schedule));
  };

  // Simulated time runs forward from the chosen point, like a real night.
  const clock = useMemo(() => (sim ? () => sim.base + (Date.now() - sim.t0) : Date.now), [sim]);

  return (
    <VenueProvider
      key={viewerKey}
      viewer={MOCK_VIEWERS[viewerKey]}
      schedule={schedule}
      occupancy={MOCK_OCCUPANCY}
      dj={MOCK_DJ}
      presence={MOCK_PRESENCE}
      clock={clock}
    >
      <SocialProvider members={MOCK_MEMBERS} connections={MOCK_CONNECTIONS} threads={MOCK_THREADS}>
        <ChatProvider initial={MOCK_CHAT}>
          <App />
        </ChatProvider>
      </SocialProvider>
      <DevPanel
        viewerKey={viewerKey}
        onViewer={setViewerKey}
        timeKey={timeKey}
        onTime={onTime}
        open={panelOpen}
        onToggle={() => setPanelOpen(!panelOpen)}
      />
    </VenueProvider>
  );
}

function DevPanel(props: {
  viewerKey: ViewerKey;
  onViewer: (k: ViewerKey) => void;
  timeKey: TimeKey;
  onTime: (k: TimeKey) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const { dispatch } = useVenue();
  const { open } = props;
  const booth = getRoom('suite-booth');

  return (
    <aside className="dev-panel" data-open={open}>
      <button className="dev-toggle" onClick={props.onToggle}>
        DEV
      </button>
      {open && (
        <div className="dev-body">
          <label>
            Viewer
            <select value={props.viewerKey} onChange={(e) => props.onViewer(e.target.value as ViewerKey)}>
              {Object.keys(MOCK_VIEWERS).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            Time
            <select value={props.timeKey} onChange={(e) => props.onTime(e.target.value as TimeKey)}>
              {Object.entries(TIMES).map(([k, t]) => (
                <option key={k} value={k}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => dispatch({ type: 'occupancy', counts: { [booth.id]: booth.capacity ?? 0 } })}>
            Fill {booth.label}
          </button>
        </div>
      )}
    </aside>
  );
}
