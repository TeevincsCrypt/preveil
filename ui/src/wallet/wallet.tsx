// Midnight wallet connection via the official DApp Connector API
// (@midnight-ntwrk/dapp-connector-api 4.0.1). Wallets such as Lace inject an
// InitialAPI into `window.midnight`; connect(networkId) asks the user to
// authorise this site. Detection follows the official UI template in
// midnightntwrk/midnight-examples.
//
// This is a REAL connection when a wallet is installed. PRIVEIL never claims
// a wallet is connected unless connect() resolved.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import '@midnight-ntwrk/dapp-connector-api';

export const NETWORK_IDS = ['preprod', 'preview', 'undeployed'] as const;
export type NetworkId = (typeof NETWORK_IDS)[number];

export type DetectedWallet = { key: string; name: string; api: InitialAPI };

export function detectWallets(): DetectedWallet[] {
  if (typeof window === 'undefined' || !window.midnight) return [];
  const seen = new Set<InitialAPI>();
  const out: DetectedWallet[] = [];
  for (const [key, api] of Object.entries(window.midnight)) {
    if (api == null || typeof api.connect !== 'function' || seen.has(api)) continue;
    seen.add(api);
    out.push({ key, name: api.name || key, api });
  }
  return out;
}

type WalletState = {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  api: ConnectedAPI | null;
  walletName: string | null;
  shieldedAddress: string | null;
  networkId: string | null;
  indexerUri: string | null;
  error: string | null;
};

type Ctx = WalletState & {
  wallets: DetectedWallet[];
  requestedNetwork: NetworkId;
  setRequestedNetwork: (n: NetworkId) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const DISCONNECTED: WalletState = { status: 'disconnected', api: null, walletName: null, shieldedAddress: null, networkId: null, indexerUri: null, error: null };
const WalletContext = createContext<Ctx | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>(DISCONNECTED);
  const [wallets, setWallets] = useState<DetectedWallet[]>(detectWallets);
  const [requestedNetwork, setRequestedNetwork] = useState<NetworkId>('preprod');

  // Extensions can inject after the page loads: re-scan briefly.
  useEffect(() => {
    let tries = 0;
    const id = window.setInterval(() => {
      const found = detectWallets();
      setWallets((prev) => (prev.length === found.length ? prev : found));
      if (++tries >= 10) window.clearInterval(id);
    }, 300);
    return () => window.clearInterval(id);
  }, []);

  const connect = useCallback(async () => {
    const found = detectWallets();
    const w = found[0];
    if (!w) {
      setState({ ...DISCONNECTED, status: 'error', error: 'No Midnight wallet found. Install the Lace wallet extension (with Midnight enabled) to connect.' });
      return;
    }
    setState((s) => ({ ...s, status: 'connecting', error: null }));
    try {
      const api = await w.api.connect(requestedNetwork);
      const config = await api.getConfiguration();
      const { shieldedAddress } = await api.getShieldedAddresses();
      setState({ status: 'connected', api, walletName: w.name, shieldedAddress, networkId: config.networkId, indexerUri: config.indexerUri, error: null });
    } catch (e) {
      setState({ ...DISCONNECTED, status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  }, [requestedNetwork]);

  const disconnect = useCallback(() => setState(DISCONNECTED), []);

  return (
    <WalletContext.Provider value={{ ...state, wallets, requestedNetwork, setRequestedNetwork, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const c = useContext(WalletContext);
  if (!c) throw new Error('useWallet outside WalletProvider');
  return c;
}
