// One menu, used at The Bar and The Suite. Display only: no ordering or prices
// in V1. Alcohol-identified items come only through visibleMenu (canSeeAlcohol),
// so an under-21 member at The Bar sees the zero-proof list and nothing else.

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { visibleMenu } from '../venue/machine.ts';
import { inSuite } from './art.ts';
import { getRoom, type RoomId } from '../venue/rooms.ts';
import { useVenue } from '../venue/VenueProvider.tsx';

export function MenuSheet({ roomId, onClose }: { roomId: RoomId; onClose: () => void }) {
  const { state } = useVenue();
  const room = getRoom(roomId);
  // visibleMenu is the only gate: it already dropped alcohol items for anyone
  // canSeeAlcohol says no to. Splitting what's left needs no second check.
  const items = visibleMenu(state, roomId);
  const zeroProof = items.filter((i) => !i.alcohol);
  const withAlcohol = items.filter((i) => i.alcohol);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  // Rendered at <body>, above the bottom nav: the room screen is its own
  // stacking context, so a sheet inside it would sit under the nav.
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={`sheet menu-sheet${inSuite(roomId) ? ' menu-sheet--suite' : ''}`} role="dialog" aria-modal="true" aria-label={`${room.label} menu`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden="true" />
        <div className="menu-head">
          <h2>{room.label} menu</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close menu">
            ✕
          </button>
        </div>
        <MenuSection title="Zero-proof" items={zeroProof} />
        {withAlcohol.length > 0 && <MenuSection title="21+" items={withAlcohol} />}
      </div>
    </div>,
    document.body,
  );
}

function MenuSection({ title, items }: { title: string; items: { id: string; name: string; detail: string }[] }) {
  if (items.length === 0) return null;
  return (
    <section className="menu-section" aria-label={title}>
      <h3>{title}</h3>
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            <span className="menu-name">{i.name}</span>
            <span className="menu-detail">{i.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
