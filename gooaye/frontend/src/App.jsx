import { useState, useEffect } from 'react';
import { C } from './constants.js';
import { Header } from './components/Header.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { ActionPage } from './pages/ActionPage.jsx';
import { AnalysisPage } from './pages/AnalysisPage.jsx';
import { EpisodesPage } from './pages/EpisodesPage.jsx';

export default function App() {
  const [market, setMarket] = useState('us');
  const [route, setRoute] = useState(() => localStorage.getItem('gooaye_route') || 'action');
  const [data, setData] = useState({ episodes: [], picks: [], stats: { us: {}, tw: {} } });
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then(d => { setData(d); setDataLoading(false); })
      .catch(() => setDataLoading(false));
  }, []);

  useEffect(() => { localStorage.setItem('gooaye_route', route); }, [route]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar route={route} setRoute={setRoute} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header market={market} setMarket={setMarket} route={route} />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {dataLoading && route !== 'episodes' ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>載入中...</div>
          ) : route === 'action' ? (
            <ActionPage market={market} data={data} />
          ) : route === 'analysis' ? (
            <AnalysisPage data={data} market={market} />
          ) : route === 'episodes' ? (
            <EpisodesPage />
          ) : null}
        </div>
      </div>
    </div>
  );
}
