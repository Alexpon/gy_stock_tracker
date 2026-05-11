import { useState, useEffect, useCallback } from 'react';
import { C } from '../constants.js';
import { StatCard } from '../components/shared/StatCard.jsx';
import { useProcessing } from '../ProcessingContext.jsx';

export function EpisodesPage() {
  const [episodes, setEpisodes] = useState([]);
  const [total, setTotal] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  const { jobs, activeCount, startProcess, clearFinished, onJobDone } = useProcessing();

  const fetchEpisodes = useCallback(async () => {
    try {
      const res = await fetch('/api/episodes');
      const data = await res.json();
      setEpisodes(data.episodes);
      setTotal(data.total ?? data.episodes.length);
      setCompleted(data.completed ?? 0);
      setError(null);
    } catch {
      setError('無法連線到 API server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEpisodes(); }, [fetchEpisodes]);

  useEffect(() => {
    return onJobDone((_ep, _success, msg) => {
      setMessages(prev => [{ id: Date.now(), text: msg, isError: !_success }, ...prev].slice(0, 5));
      fetchEpisodes();
    });
  }, [onJobDone, fetchEpisodes]);

  const handleScan = async () => {
    setScanning(true);
    setMessages([]);
    try {
      const res = await fetch('/api/scan', { method: 'POST' });
      const data = await res.json();
      const text = data.total_new > 0 ? `找到 ${data.total_new} 個新集數` : '沒有找到新集數';
      setMessages([{ id: Date.now(), text, isError: false }]);
      await fetchEpisodes();
    } catch {
      setMessages([{ id: Date.now(), text: '掃描失敗', isError: true }]);
    } finally {
      setScanning(false);
    }
  };

  const handleProcess = (ep) => {
    startProcess(ep);
    setMessages(prev => [{ id: Date.now(), text: `EP${ep} 開始處理...`, isError: false }, ...prev].slice(0, 5));
  };

  const dismissMessage = (id) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  const pending = total - completed;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
          {activeCount > 0 && (
            <span style={{
              fontSize: 12, color: C.accent, background: C.accentBg,
              padding: '4px 10px', borderRadius: 4, fontWeight: 600,
            }}>
              {activeCount} 個處理中...
            </span>
          )}
          {messages.map(m => (
            <span key={m.id} onClick={() => dismissMessage(m.id)} style={{
              fontSize: 12, cursor: 'pointer',
              color: m.isError ? C.down : C.up,
              background: m.isError ? C.downBg : C.upBg,
              padding: '4px 10px', borderRadius: 4,
            }}>
              {m.text} ✕
            </span>
          ))}
        </div>
        <button onClick={handleScan} disabled={scanning} style={{
          border: 'none', background: C.text, color: '#fff',
          padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
          cursor: scanning ? 'default' : 'pointer', opacity: scanning ? 0.6 : 1,
          fontFamily: 'var(--font-sans)', flexShrink: 0,
        }}>
          {scanning ? '掃描中...' : '掃描新集數'}
        </button>
      </div>

      {/* Stats bar */}
      <div style={{
        display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.surface,
      }}>
        <StatCard label="總集數" value={loading ? '—' : total} />
        <StatCard label="已完成" value={loading ? '—' : completed} />
        <StatCard label="待處理" value={loading ? '—' : pending}
          sub={pending > 0 ? '需要處理' : null} subKind={pending > 0 ? 'down' : null} />
        {activeCount > 0 && (
          <StatCard label="處理中" value={activeCount} sub="平行處理" subKind="accent" />
        )}
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
            <div style={{ width: 50, textAlign: 'center' }}>族群</div>
            <div style={{ width: 50, textAlign: 'center' }}>績效</div>
            <div style={{ width: 80, textAlign: 'center' }}>操作</div>
          </div>

          {/* Table rows */}
          {episodes.map((ep, i) => {
            const job = jobs.get(ep.ep);
            const isProcessing = job?.status === 'processing';
            const isDone = job?.status === 'done';
            const isError = job?.status === 'error';

            return (
              <div key={ep.ep} style={{
                display: 'flex', padding: '12px 24px', alignItems: 'center',
                borderBottom: `1px solid ${C.border}`,
                background: isProcessing ? C.accentBg
                  : isDone ? C.upBg
                  : isError ? C.downBg
                  : i % 2 === 0 ? C.surface : C.surfaceAlt,
                transition: 'background 0.3s',
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
                  {ep.sectors_count > 0
                    ? <span style={{ color: C.up }}>{ep.sectors_count}</span>
                    : ep.picks_count > 0
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
                  {isProcessing ? (
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: C.accent,
                      animation: 'pulse 1.5s infinite',
                    }}>處理中...</span>
                  ) : (ep.status === 'completed' && ep.sectors_count > 0 && !isDone && !isError) ? (
                    <span style={{ color: C.up, fontSize: 11, fontWeight: 600 }}>完成</span>
                  ) : (
                    <button
                      onClick={() => handleProcess(ep.ep)}
                      disabled={isProcessing}
                      style={{
                        border: 'none', borderRadius: 4, padding: '4px 12px',
                        fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        background: ep.status === 'completed' ? C.warn : C.accent,
                        color: '#fff',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {ep.status === 'completed' ? '補族群' : '處理'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

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
