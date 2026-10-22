import { useCallback, useRef, useState } from 'react';

import type { DrawerSize } from './chat/ChatDrawer.tsx';
import { useKeyboardInset } from './chat/useKeyboardInset.ts';
import { DmScreen } from './dm/DmScreen.tsx';
import { BottomNav, tabLabel, type Tab } from './nav/BottomNav.tsx';
import { PersonSheetProvider } from './people/PersonSheet.tsx';
import { anyUnread, isBlocked } from './social/social.ts';
import { useSocial } from './social/SocialProvider.tsx';
import { HomeTab, MeTab, MessagesTab, PeopleTab } from './tabs/Tabs.tsx';
import { homeRoom } from './venue/machine.ts';
import { getRoom, type RoomId } from './venue/rooms.ts';
import { useVenue } from './venue/VenueProvider.tsx';

function App() {
  const { state } = useVenue();
  const { state: social } = useSocial();
  const [tab, setTab] = useState<Tab>('home');
  // The open conversation sits over the tab it was opened from; Back returns there.
  const [dm, setDm] = useState<string | null>(null);
  const closeDm = useCallback(() => setDm(null), []);
  // The chat drawer belongs to one room; moving rooms or tabs drops it back to peek.
  const [chat, setChat] = useState<{ roomId: RoomId; size: Exclude<DrawerSize, 'peek'> } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useKeyboardInset(root);

  const room = homeRoom(state);
  const chatSize: DrawerSize = tab === 'home' && chat && chat.roomId === room ? chat.size : 'peek';
  const onChat = (size: DrawerSize) => setChat(size === 'peek' || room === null ? null : { roomId: room, size });
  const selectTab = (next: Tab) => {
    setChat(null);
    setDm(null);
    setTab(next);
  };
  // Blocking them closes the conversation; Undo puts you back in it.
  const dmWith = dm !== null && !isBlocked(social, dm) ? dm : null;

  return (
    <PersonSheetProvider onMessage={setDm}>
      <div className="app" ref={root}>
        <NoticeBar onGo={() => selectTab('home')} />
        <main className="app-body">
          {dmWith !== null ? (
            <DmScreen key={dmWith} memberId={dmWith} backLabel={tabLabel(tab)} onBack={closeDm} />
          ) : (
            <>
              {tab === 'home' && <HomeTab chat={chatSize} onChat={onChat} />}
              {tab === 'people' && <PeopleTab />}
              {tab === 'messages' && <MessagesTab onOpen={setDm} />}
              {tab === 'me' && <MeTab />}
            </>
          )}
        </main>
        <BottomNav
          active={tab}
          onSelect={selectTab}
          hidden={chatSize !== 'peek' || dmWith !== null}
          dots={anyUnread(social) ? { messages: 'Unread messages' } : {}}
        />
      </div>
    </PersonSheetProvider>
  );
}

/** A reminder fired: the room you asked about is open. Mock for a push notification. */
function NoticeBar({ onGo }: { onGo: () => void }) {
  const { state, dispatch } = useVenue();
  const notice = state.notices[0];
  if (!notice) return null;
  const room = getRoom(notice.roomId);
  return (
    <div className="notice-bar" role="status">
      <span className="notice-text">{room.label} is open</span>
      <button
        className="notice-go"
        onClick={() => {
          dispatch({ type: 'enter', roomId: notice.roomId });
          dispatch({ type: 'dismissNotice', id: notice.id });
          onGo();
        }}
      >
        {room.lobby ?? 'Go'}
      </button>
      <button className="notice-dismiss" aria-label="Dismiss" onClick={() => dispatch({ type: 'dismissNotice', id: notice.id })}>
        ✕
      </button>
    </div>
  );
}

export default App;
