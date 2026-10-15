import logo from '../design/logo-white.webp';
import { useVenue } from './venue/VenueProvider.tsx';

const PHASE_LABEL = { closed: 'Doors closed', live: 'Live now', afterHours: 'After Hours' } as const;

// Placeholder shell until room screens land.
function App() {
  const { state } = useVenue();
  return (
    <main className="shell">
      <img className="logo" src={logo} alt="The Dorm" />
      <p className="tagline">Every campus. One night.</p>
      <p className="phase">{PHASE_LABEL[state.phase]}</p>
    </main>
  );
}

export default App;
