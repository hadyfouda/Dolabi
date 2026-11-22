import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomNav, type Tab } from './components/BottomNav';
import { InstallPwaBanner } from './components/InstallPwaBanner';
import { ToastProvider } from './components/Toast';
import { GetDressedScreen, type StyleAnchor } from './screens/GetDressedScreen';
import { SavedScreen } from './screens/SavedScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { WardrobeScreen } from './screens/WardrobeScreen';
import type { StoredItem } from './types';

export default function App() {
  const [tab, setTab] = useState<Tab>('wardrobe');
  const [anchor, setAnchor] = useState<StyleAnchor | null>(null);

  const go = useCallback((t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  }, []);

  const styleAround = useCallback(
    (item: StoredItem) => {
      setAnchor({ itemId: item.id, nonce: Date.now() });
      go('dress');
    },
    [go],
  );

  // Android hardware back: return to the wardrobe tab instead of leaving the app.
  const pushedRef = useRef(false);
  useEffect(() => {
    const onPop = () => {
      pushedRef.current = false;
      setTab('wardrobe');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (tab !== 'wardrobe' && !pushedRef.current) {
      history.pushState({ dolabiTab: true }, '');
      pushedRef.current = true;
    } else if (tab === 'wardrobe' && pushedRef.current) {
      pushedRef.current = false;
      history.back();
    }
  }, [tab]);

  return (
    <ToastProvider>
      <div className="min-h-dvh">
        {tab === 'wardrobe' && <WardrobeScreen onStyleAround={styleAround} />}
        {tab === 'dress' && <GetDressedScreen anchor={anchor} onGoWardrobe={() => go('wardrobe')} />}
        {tab === 'saved' && <SavedScreen onGoDress={() => go('dress')} />}
        {tab === 'settings' && <SettingsScreen />}
      </div>
      <InstallPwaBanner />
      <BottomNav tab={tab} onChange={go} />
    </ToastProvider>
  );
}
