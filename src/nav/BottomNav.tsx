// Exactly four tabs (V1 scope). Venue discovery is the Explore overlay, never a tab.

export type Tab = 'home' | 'people' | 'messages' | 'me';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'M4 11 12 4l8 7v9h-5v-6H9v6H4z' },
  { id: 'people', label: 'People', icon: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.3a3.5 3.5 0 0 1 0 6.4M17.5 14c2.1.6 3.5 2.6 3.5 5' },
  { id: 'messages', label: 'Messages', icon: 'M4 5h16v11H9l-5 4z' },
  { id: 'me', label: 'Me', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c0-3.9 3.1-7 7-7s7 3.1 7 7' },
];

// eslint-disable-next-line react/only-export-components -- the label belongs with the tab list
export function tabLabel(tab: Tab): string {
  return TABS.find((t) => t.id === tab)!.label;
}

/**
 * `hidden` is set while a chat sheet or conversation is open, so the composer
 * owns the bottom of the screen. `dots` marks a tab, e.g. unread messages; the
 * text is what screen readers hear as the tab's description.
 */
export function BottomNav({
  active,
  onSelect,
  hidden = false,
  dots = {},
}: {
  active: Tab;
  onSelect: (tab: Tab) => void;
  hidden?: boolean;
  dots?: Partial<Record<Tab, string>>;
}) {
  if (hidden) return null;
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map((t) => (
        <button
          key={t.id}
          className="bottom-nav-tab"
          aria-current={active === t.id ? 'page' : undefined}
          aria-describedby={dots[t.id] ? `nav-dot-${t.id}` : undefined}
          onClick={() => onSelect(t.id)}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d={t.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <span>{t.label}</span>
          {dots[t.id] && <span className="nav-dot" aria-hidden="true" />}
        </button>
      ))}
      {TABS.map(
        (t) =>
          dots[t.id] && (
            <span key={t.id} id={`nav-dot-${t.id}`} hidden>
              {dots[t.id]}
            </span>
          ),
      )}
    </nav>
  );
}
