import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ProcessingContext = createContext(null);

export function useProcessing() {
  return useContext(ProcessingContext);
}

export function ProcessingProvider({ children }) {
  const [jobs, setJobs] = useState(new Map());
  const listenersRef = useRef(new Set());

  const onJobDone = useCallback((cb) => {
    listenersRef.current.add(cb);
    return () => listenersRef.current.delete(cb);
  }, []);

  const notifyDone = useCallback((ep, success, msg) => {
    for (const cb of listenersRef.current) cb(ep, success, msg);
  }, []);

  const startProcess = useCallback((ep) => {
    setJobs(prev => {
      const next = new Map(prev);
      next.set(ep, { status: 'processing' });
      return next;
    });

    fetch(`/api/process/${ep}`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        const success = !!data.success;
        const msg = success ? `EP${ep} 處理完成` : `EP${ep} 處理失敗: ${data.error}`;
        setJobs(prev => {
          const next = new Map(prev);
          next.set(ep, { status: success ? 'done' : 'error', message: msg });
          return next;
        });
        notifyDone(ep, success, msg);
      })
      .catch(() => {
        const msg = `EP${ep} 處理失敗`;
        setJobs(prev => {
          const next = new Map(prev);
          next.set(ep, { status: 'error', message: msg });
          return next;
        });
        notifyDone(ep, false, msg);
      });
  }, [notifyDone]);

  const clearJob = useCallback((ep) => {
    setJobs(prev => {
      const next = new Map(prev);
      next.delete(ep);
      return next;
    });
  }, []);

  const clearFinished = useCallback(() => {
    setJobs(prev => {
      const next = new Map(prev);
      for (const [ep, job] of next) {
        if (job.status !== 'processing') next.delete(ep);
      }
      return next;
    });
  }, []);

  const activeCount = [...jobs.values()].filter(j => j.status === 'processing').length;

  return (
    <ProcessingContext.Provider value={{ jobs, activeCount, startProcess, clearJob, clearFinished, onJobDone }}>
      {children}
    </ProcessingContext.Provider>
  );
}
