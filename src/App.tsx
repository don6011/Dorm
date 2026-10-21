import { useState } from 'react';

import { BottomNav, type Tab } from './nav/BottomNav.tsx';
import { PersonSheetProvider } from './people/PersonSheet.tsx';
import { HomeTab, MeTab, MessagesTab, PeopleTab } from './tabs/Tabs.tsx';

function App() {
  const [tab, setTab] = useState<Tab>('home');

  return (
    <PersonSheetProvider onMessage={() => setTab('messages')}>
      <div className="app">
        <main className="app-body">
          {tab === 'home' && <HomeTab />}
          {tab === 'people' && <PeopleTab />}
          {tab === 'messages' && <MessagesTab />}
          {tab === 'me' && <MeTab />}
        </main>
        <BottomNav active={tab} onSelect={setTab} />
      </div>
    </PersonSheetProvider>
  );
}

export default App;
