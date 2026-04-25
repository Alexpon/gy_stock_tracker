import { useState, useEffect } from 'react';
import { C, DEFAULT_CONFIG } from './constants.js';
import { Header } from './components/Header.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { DetailPanel } from './components/DetailPanel.jsx';
import { TweaksPanel } from './components/TweaksPanel.jsx';
import { ActionPage } from './pages/ActionPage.jsx';
import { AnalysisPage } from './pages/AnalysisPage.jsx';
import { EpisodesPage } from './pages/EpisodesPage.jsx';

export default function App() {
  const [market, setMarket] = useState('us');
  const [period, setPeriod] = useState('q1');
  const [selected, setSelected] = useState(null);
  const [activeEp, setActiveEp] = useState(null);
  const [tweaksVisible, setTweaksVisible] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
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

  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'gooaye-tweaks') setTweaksVisible(v => !v);
      if (e.data?.type === 'gooaye-set-config') setConfig(c => ({ ...c, ...e.data.payload }));
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'O') {
        e.preventDefault();
        setTweaksVisible(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const episodes = data.episodes || [];
  const allPicks = data.picks || [];
  const selectedPick = selected ? allPicks.find(p => p.ticker === selected && p.market === market) : null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar route={route} setRoute={setRoute} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header market={market} setMarket={setMarket} period={period} setPeriod={setPeriod} route={route} />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {dataLoading && route !== 'episodes' ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>載入中...</div>
          ) : route === 'action' ? (
            <ActionPage market={market} config={config} data={data} />
          ) : route === 'analysis' ? (
            <AnalysisPage
              data={data} market={market} period={period} config={config}
              selected={selected} setSelected={setSelected}
              activeEp={activeEp} setActiveEp={setActiveEp}
            />
          ) : route === 'episodes' ? (
            <EpisodesPage />
          ) : null}
        </div>
      </div>
      {selectedPick && (
        <DetailPanel pick={selectedPick} episodes={episodes} onClose={() => setSelected(null)} />
      )}
      <TweaksPanel config={config} setConfig={setConfig} visible={tweaksVisible} />
    </div>
  );
}
