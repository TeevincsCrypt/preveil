import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import { Layout } from '@/components/Layout';
import { WalletProvider } from '@/wallet/wallet';
import { seedDemo } from '@/engine/seed';
import { store, useStore } from '@/engine/store';
import { Landing } from '@/pages/Landing';
import { Rounds } from '@/pages/Rounds';
import { CreateRound } from '@/pages/CreateRound';
import { RoundPage } from '@/pages/RoundPage';
import { ProposalPage } from '@/pages/ProposalPage';
import { SubmitProposal } from '@/pages/SubmitProposal';
import { Privacy } from '@/pages/Privacy';
import { Network } from '@/pages/Network';
import { Logo } from '@/components/Layout';

function Gate({ children }: { children: React.ReactNode }) {
  const s = useStore();
  if (!s.ready)
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-sm text-muted">
        <Logo className="size-10 animate-pulse" />
        Executing the PRIVEIL contract to build the demo rounds…
      </div>
    );
  return <>{children}</>;
}

void seedDemo().catch((e) => {
  console.error(e);
  store.toast(false, 'Demo seed failed', String(e));
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Landing />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="network" element={<Network />} />
            <Route path="rounds" element={<Gate><Rounds /></Gate>} />
            <Route path="rounds/new" element={<Gate><CreateRound /></Gate>} />
            <Route path="rounds/:id" element={<Gate><RoundPage /></Gate>} />
            <Route path="rounds/:id/:tab" element={<Gate><RoundPage /></Gate>} />
            <Route path="rounds/:id/submit" element={<Gate><SubmitProposal /></Gate>} />
            <Route path="rounds/:id/p/:pid" element={<Gate><ProposalPage /></Gate>} />
          </Route>
        </Routes>
      </HashRouter>
    </WalletProvider>
  </StrictMode>,
);
