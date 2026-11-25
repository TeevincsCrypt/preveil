// Live-mode plumbing: builds midnight-js providers from the connected wallet
// (once per connection + proving mode), and runs one transaction at a time
// with a visible status.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useWallet } from '@/wallet/wallet';
import type { PriveilProviders, ProvingMode } from '@/midnight/network';

type TxState = { label: string; phase: 'running' | 'done' | 'failed'; detail?: string } | null;

type Ctx = {
  providers: PriveilProviders | null;
  providersError: string | null;
  proving: ProvingMode;
  setProving: (m: ProvingMode) => void;
  tx: TxState;
  busy: boolean;
  /** Runs fn as one transaction; resolves to its result, or null on failure (error shown). */
  run: <T>(label: string, fn: (p: PriveilProviders) => Promise<T>, done?: (r: T) => string) => Promise<T | null>;
  clearTx: () => void;
};

const LiveContext = createContext<Ctx | null>(null);

export const errorText = (e: unknown): string => {
  if (e instanceof Error) {
    const cause = (e as Error & { cause?: unknown }).cause;
    return cause instanceof Error && cause.message && !e.message.includes(cause.message) ? `${e.message} — ${cause.message}` : e.message;
  }
  return String(e);
};

export function LiveProvider({ children }: { children: ReactNode }) {
  const w = useWallet();
  const [proving, setProving] = useState<ProvingMode>('wallet');
  const [providers, setProviders] = useState<PriveilProviders | null>(null);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [tx, setTx] = useState<TxState>(null);

  useEffect(() => {
    setProviders(null);
    setProvidersError(null);
    if (!w.api) return;
    let live = true;
    void import('@/midnight/network')
      .then((net) => net.createProviders(w.api!, proving))
      .then((p) => live && setProviders(p))
      .catch((e) => live && setProvidersError(errorText(e)));
    return () => {
      live = false;
    };
  }, [w.api, proving]);

  const run = useCallback(
    async <T,>(label: string, fn: (p: PriveilProviders) => Promise<T>, done?: (r: T) => string): Promise<T | null> => {
      if (!providers) return null;
      setTx({ label, phase: 'running' });
      try {
        const r = await fn(providers);
        setTx({ label, phase: 'done', detail: done?.(r) });
        return r;
      } catch (e) {
        console.error(e);
        setTx({ label, phase: 'failed', detail: errorText(e) });
        return null;
      }
    },
    [providers],
  );

  return (
    <LiveContext.Provider
      value={{ providers, providersError, proving, setProving, tx, busy: tx?.phase === 'running', run, clearTx: () => setTx(null) }}
    >
      {children}
    </LiveContext.Provider>
  );
}

export function useLive() {
  const c = useContext(LiveContext);
  if (!c) throw new Error('useLive outside LiveProvider');
  return c;
}
