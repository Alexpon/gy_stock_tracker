import { useState, useEffect } from 'react';
import { C } from '../constants.js';
import { StatCard } from '../components/shared/StatCard.jsx';

export function EpisodesPage() {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const fetchEpisodes = async () => {
    try {
      const res = await fetch('/api/episodes');
      const data = await res.json();
      setEpisodes(data.episodes);
      setError(null);
    } catch {
      setError('無法連線到 API server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEpisodes(); }, []);

  const handleScan = async () => {
    setScanning(true);
    setMessage(null);
    try {
      const res = await fetch('/api/scan', { method: 'POST' });
      const data = await res.json();
      setMessage(data.total_new > 0
        ? `找到 ${data.total_new} 個新集數`
        : '沒有找到新集數');
      await fetchEpisodes();
    } catch {
      setMessage('掃描失敗');
    } finally {
      setScanning(false);
    }
  };

  const handleProcess = async (ep) => {
    setProcessing(ep);
    setMessage(null);
    try {
      const res = await fetch(`/api/process/${ep}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMessage(`EP${ep} 處理完成`);
      } else {
        setMessage(`EP${ep} 處理失敗: ${data.error}`);
      }
      await fetchEpisodes();
    } catch {
      setMessage(`EP${ep} 處理失敗`);
    } finally {
      setProcessing(null);
    }
  };

  const completed = episodes.filter(e => e.status === 'completed').length;
  const pending = episodes.length - completed;

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>{error}</div>
        <button onClick={fetchEpisodes} style={{
          border: `1px solid ${C.border}`, background: C.surface, padding: '6px 16px',
          borderRadius: 6, cursor: 'pointer', fontSize: 12, color: C.text,
        }}>重試</button>
      </div>
    );
  }

  return (
    <div>
      {/* Top action bar */}
      <div style={{
        padding: '16px 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {message && (
            <span style={{
              fontSize: 12, color: message.includes('失敗') ? C.down : C.up,
              background: message.includes('失敗') ? C.downBg : C.upBg,
              padding: '4px 10px', borderRadius: 4,
            }}>{message}</span>
          )}
        </div>
        <button onClick={handleScan} disabled={scanning} style={{
          border: 'none', background: C.text, color: '#fff',
          padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
          cursor: scanning ? 'default' : 'pointer', opacity: scanning ? 0.6 : 1,
          fontFamily: 'var(--font-sans)',
        }}>
          {scanning ? '掃描中...' : '掃描新集數'}
        </button>
      </div>

      {/* Stats bar */}
      <div style={{
        display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.surface,
      }}>
        <StatCard label="總集數" value={loading ? '—' : episodes.length} />
        <StatCard label="已完成" value={loading ? '—' : completed} />
        <StatCard label="待處理" value={loading ? '—' : pending}
          sub={pending > 0 ? '需要處理' : null} subKind={pending > 0 ? 'down' : null} />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
          載入中...
        </div>
      ) : (
        <div style={{ background: C.surface }}>
          {/* Table header */}
          <div style={{
            display: 'flex', padding: '10px 24px', background: C.surfaceAlt,
            borderBottom: `1px solid ${C.border}`,
            fontSize: 10.5, fontWeight: 600, color: C.textSubtle,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            <div style={{ width: 70 }}>集數</div>
            <div style={{ flex: 1 }}>標題</div>
            <div style={{ width: 80, textAlign: 'center' }}>日期</div>
            <div style={{ width: 50, textAlign: 'center' }}>STT</div>
            <div style={{ width: 50, textAlign: 'center' }}>股票</div>
            <div style={{ width: 50, textAlign: 'center' }}>績效</div>
            <div style={{ width: 80, textAlign: 'center' }}>操作</div>
          </div>

          {/* Table rows */}
          {episodes.map((ep, i) => (
            <div key={ep.ep} style={{
              display: 'flex', padding: '12px 24px', alignItems: 'center',
              borderBottom: `1px solid ${C.border}`,
              background: i % 2 === 0 ? C.surface : C.surfaceAlt,
            }}>
              <div style={{
                width: 70, fontWeight: 700, fontFamily: 'var(--font-mono)',
                color: C.text, fontSize: 13,
              }}>EP{ep.ep}</div>
              <div style={{
                flex: 1, fontSize: 12, color: C.textMuted,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                paddingRight: 12,
              }}>{ep.title}</div>
              <div style={{
                width: 80, textAlign: 'center', fontSize: 11,
                fontFamily: 'var(--font-mono)', color: C.textSubtle,
              }}>{ep.date?.slice(5)}</div>
              <div style={{ width: 50, textAlign: 'center', fontSize: 13 }}>
                {ep.has_transcript
                  ? <span style={{ color: C.up }}>✓</span>
                  : <span style={{ color: C.warn }}>✗</span>}
              </div>
              <div style={{ width: 50, textAlign: 'center', fontSize: 13 }}>
                {ep.picks_count > 0
                  ? <span style={{ color: C.up }}>{ep.picks_count}</span>
                  : ep.has_transcript
                    ? <span style={{ color: C.warn }}>✗</span>
                    : <span style={{ color: C.textSubtle }}>—</span>}
              </div>
              <div style={{ width: 50, textAlign: 'center', fontSize: 13 }}>
                {ep.has_prices
                  ? <span style={{ color: C.up }}>✓</span>
                  : ep.picks_count > 0
                    ? <span style={{ color: C.warn }}>✗</span>
                    : <span style={{ color: C.textSubtle }}>—</span>}
              </div>
              <div style={{ width: 80, textAlign: 'center' }}>
                {ep.status === 'completed' ? (
                  <span style={{ color: C.up, fontSize: 11, fontWeight: 600 }}>完成</span>
                ) : (
                  <button
                    onClick={() => handleProcess(ep.ep)}
                    disabled={processing !== null}
                    style={{
                      border: 'none', borderRadius: 4, padding: '4px 12px',
                      fontSize: 11, fontWeight: 600, cursor: processing !== null ? 'default' : 'pointer',
                      background: processing === ep.ep ? C.surfaceAlt : C.accent,
                      color: processing === ep.ep ? C.textMuted : '#fff',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {processing === ep.ep ? '處理中...' : '處理'}
                  </button>
                )}
              </div>
            </div>
          ))}

          {episodes.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
              尚無集數資料，請先掃描新集數
            </div>
          )}
        </div>
      )}
    </div>
  );
}
