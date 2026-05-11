import { useState, useEffect } from 'react';
import { C } from './constants.js';
import { Header } from './components/Header.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { ActionPage } from './pages/ActionPage.jsx';
import { AnalysisPage } from './pages/AnalysisPage.jsx';
import { EpisodesPage } from './pages/EpisodesPage.jsx';

const DEFAULT_CONFIG = {
  actionFollow: 'all',
  followOnly: 'all',
  capitalPerEpisode: 100000,
  entryDelay: 0,
};

export default function App() {
  const [market, setMarket] = useState('us');
  const [route, setRoute] = useState(() => localStorage.getItem('gooaye_route') || 'action');
  const [data, setData] = useState({ episodes: [], picks: [], stats: { us: {}, tw: {} } });
  const [dataLoading, setDataLoading] = useState(true);
  const [period, setPeriod] = useState('w1');
  const [selected, setSelected] = useState(null);
  const [activeEp, setActiveEp] = useState(null);

  useEffect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (d.episodes && d.episodes.length > 0) {
          setActiveEp(d.episodes[0].ep);
        }
        setDataLoading(false);
      })
      .catch(() => setDataLoading(false));
  }, []);

  useEffect(() => { localStorage.setItem('gooaye_route', route); }, [route]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar route={route} setRoute={setRoute} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header market={market} setMarket={setMarket} route={route}
          period={period} setPeriod={setPeriod} />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {dataLoading && route !== 'episodes' ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>載入中...</div>
          ) : route === 'action' ? (
            <ActionPage market={market} config={DEFAULT_CONFIG} data={data} />
          ) : route === 'analysis' ? (
            <AnalysisPage data={data} market={market} period={period}
              config={DEFAULT_CONFIG} selected={selected} setSelected={setSelected}
              activeEp={activeEp} setActiveEp={setActiveEp} />
          ) : route === 'episodes' ? (
            <EpisodesPage />
          ) : null}
        </div>
      </div>
    </div>
  );
}
