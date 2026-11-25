import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { CheckCircle2, Cpu, Menu, Wallet, X, XCircle } from 'lucide-react';
import { useStore } from '@/engine/store';
import { useWallet } from '@/wallet/wallet';
import { cx } from './ui';
import { useEffect } from 'react';

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.5" />
      <path d="M16 3a13 13 0 0 1 0 26z" fill="#a594f9" />
      <path d="M16 9a7 7 0 0 0 0 14" fill="none" stroke="#5fd4c4" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ModeBanner() {
  return (
    <div className="border-b border-line bg-[#0b0b11] text-[12.5px] text-muted">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 sm:px-6">
        <Cpu className="size-3.5 shrink-0 text-warn" />
        <span className="shrink-0 font-medium whitespace-nowrap text-warn">Local Simulation</span>
        <span className="hidden truncate sm:inline">
          — the compiled PRIVEIL Compact contract executes in your browser on compact-runtime. ZK proving and network submission are skipped. All rounds and projects are fictional demo data.
        </span>
        <Link to="/network" className="ml-auto shrink-0 text-fg underline decoration-white/20 underline-offset-4 hover:decoration-white/60">
          Modes & wallet
        </Link>
      </div>
    </div>
  );
}

function WalletButton() {
  const w = useWallet();
  if (w.status === 'connected')
    return (
      <Link to="/network" className="hidden items-center gap-2 rounded-xl border border-line-strong bg-raised px-3 py-2 text-xs sm:flex">
        <span className="size-1.5 rounded-full bg-ok" />
        <span className="text-muted">{w.networkId}</span>
        <span className="font-mono">{w.shieldedAddress?.slice(0, 12)}…</span>
      </Link>
    );
  return (
    <Link to="/network" className="hidden items-center gap-2 rounded-xl border border-line-strong bg-raised px-3 py-2 text-xs text-muted hover:text-fg sm:flex">
      <Wallet className="size-3.5" />
      {w.wallets.length ? 'Connect wallet' : 'No wallet'}
    </Link>
  );
}

const links = [
  { to: '/rounds', label: 'Grant rounds' },
  { to: '/privacy', label: 'How privacy works' },
  { to: '/rounds/new', label: 'Create round' },
];

function Toasts() {
  const s = useStore();
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {s.toasts.map((t) => (
        <div key={t.id} className="rise pointer-events-auto rounded-xl border border-line-strong bg-raised/95 p-3.5 shadow-2xl backdrop-blur">
          <div className="flex items-start gap-2.5">
            {t.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-bad" />}
            <div className="min-w-0">
              <div className="text-sm font-medium">{t.title}</div>
              {t.body && <div className={cx('mt-0.5 text-xs leading-relaxed', t.ok ? 'text-muted' : 'font-mono text-bad/90')}>{t.body}</div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Layout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <ModeBanner />
      <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-15 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="size-7" />
            <span className="text-[15px] font-semibold tracking-[0.2em]">PRIVEIL</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end
                className={({ isActive }) => cx('rounded-lg px-3 py-1.5 text-sm transition-colors', isActive ? 'bg-white/6 text-fg' : 'text-muted hover:text-fg')}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <WalletButton />
            <button className="rounded-lg p-2 text-muted md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-line px-4 py-2 md:hidden">
            {[...links, { to: '/network', label: 'Modes & wallet' }].map((l) => (
              <NavLink key={l.to} to={l.to} className="block rounded-lg px-3 py-2.5 text-sm text-muted hover:text-fg">
                {l.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <Toasts />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-xs text-faint sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-center gap-2">
          <Logo className="size-5" />
          <span>PRIVEIL — Fund builders. Protect voters.</span>
        </div>
        <div className="sm:ml-auto">Built on Midnight · Compact 0.28 · Apache-2.0 · Midnight Buildathon</div>
      </div>
    </footer>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14', className)}>{children}</div>;
}
