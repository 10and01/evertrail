import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from '@/components/Layout';
import Home from '@/pages/Home';
import Journal from '@/pages/Journal';
import MapPage from '@/pages/Map';
import Chapters from '@/pages/Chapters';
import Growth from '@/pages/Growth';
import Export from '@/pages/Export';
import { useGameStore } from '@/store/useGameStore';
import { loadState } from '@/lib/storage';

function AppInitializer() {
  const loadPersisted = useGameStore((s) => s.loadPersisted);
  const loaded = useGameStore((s) => s.loaded);

  useEffect(() => {
    let mounted = true;
    loadState().then((state) => {
      if (!mounted) return;
      if (state) {
        loadPersisted(state);
      } else {
        loadPersisted({});
      }
    });
    return () => {
      mounted = false;
    };
  }, [loadPersisted]);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-et-bg text-et-gold font-display text-xl">
        加载中...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="journal" element={<Journal />} />
        <Route path="journal/:id" element={<Journal />} />
        <Route path="map" element={<MapPage />} />
        <Route path="chapters" element={<Chapters />} />
        <Route path="chapters/:chapterId" element={<Chapters />} />
        <Route path="growth" element={<Growth />} />
        <Route path="export" element={<Export />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AppInitializer />
    </Router>
  );
}
