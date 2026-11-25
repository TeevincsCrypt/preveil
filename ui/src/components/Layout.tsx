import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { CheckCircle2, Menu, X, XCircle } from 'lucide-react';
import { useStore } from '@/engine/store';
import { useWallet } from '@/wallet/wallet';
import { cx } from './ui';

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M4 9 16 3l12 6-12 6z" fill="#111" />
      <path d="M4 15.5 16 21.5l12-6" fill="none" stroke="#f08a4b" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M4 22 16 28l12-6" fill="none" stroke="#111" strokeWidth="2.6" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx('flex items-center gap-2.5', className)}>
      <Logo className="size-7" />
      <span className="font-display text-[22px] leading-none">priveil</span>
    </span>
  );
}

function ModeBanner() {
  const live = useLocation().pathname.startsWith('/live');
  if (live)
    return (
      <div className="bg-ink text-[12px] text-ink-fg/70">
        <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-4 py-1.5 sm:px-8">
          <span className="pulse-dot size-1.5 shrink-0 rounded-full bg-[#7fd6a2]" />
          <span className="shrink-0 font-medium whitespace-nowrap text-ink-fg">Live mode</span>
          <span className="hidden truncate sm:inline">— real transactions on a Midnight test network, with zero-knowledge proofs made by your wallet.</span>
          <Link to="/rounds" className="ml-auto shrink-0 text-ink-fg underline decoration-ink-fg/30 underline-offset-4 hover:decoration-ink-fg">
            Back to the demo
          </Link>
        </div>
      </div>
    );
  return (
    <div className="bg-ink text-[12px] text-ink-fg/70">
      <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-4 py-1.5 sm:px-8">
        <span className="size-1.5 shrink-0 rounded-full bg-flame" />
        <span className="shrink-0 font-medium whitespace-nowrap text-ink-fg">Local Simulation</span>
        <span className="hidden truncate sm:inline">— the compiled PRIVEIL Compact contract runs in your browser. Proving and network submission are skipped. All rounds and projects are fictional demo data.</span>
        <Link to="/network" className="ml-auto shrink-0 text-ink-fg underline decoration-ink-fg/30 underline-offset-4 hover:decoration-ink-fg">
          Details
        </Link>
      </div>
    </div>
  );
}

function WalletLink() {
  const w = useWallet();
  return (
    <Link to="/network" className="hidden items-center gap-2 text-sm text-fg hover:text-muted sm:flex">
      <span className={cx('size-1.5 rounded-full', w.status === 'connected' ? 'bg-ok' : 'bg-[#d9442b]')} />
      {w.status === 'connected' ? <span className="font-mono text-xs">{w.shieldedAddress?.slice(0, 12)}…</span> : 'Wallet'}
    </Link>
  );
}

const links = [
  { to: '/rounds', label: 'Grant rounds' },
  { to: '/privacy', label: 'How privacy works' },
  { to: '/rounds/new', label: 'Create round' },
  { to: '/live', label: 'Live on Midnight' },
];

function Toasts() {
  const s = useStore();
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {s.toasts.map((t) => (
        <div key={t.id} className="rise pointer-events-auto rounded-md bg-ink p-3.5 text-ink-fg shadow-2xl">
          <div className="flex items-start gap-2.5">
            {t.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#7fd6a2]" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-[#ff8f86]" />}
            <div className="min-w-0">
              <div className="text-sm font-medium">{t.title}</div>
              {t.body && <div className={cx('mt-0.5 text-xs leading-relaxed', t.ok ? 'text-ink-fg/65' : 'font-mono text-[#ffb1aa]')}>{t.body}</div>}
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
  const landing = loc.pathname === '/';
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <ModeBanner />
      <div className={cx('flex flex-1 flex-col', landing && 'glow-flame')}>
        <header className={cx('z-40 border-b border-fg/70', landing ? 'relative' : 'sticky top-0 bg-bg/85 backdrop-blur-xl')}>
          <div className="mx-auto flex h-16 max-w-[1400px] items-stretch px-4 sm:px-8">
            <Link to="/" className="flex items-center border-r border-fg/70 pr-6 sm:pr-10">
              <Wordmark />
            </Link>
            <nav className="hidden items-center gap-1 pl-6 md:flex">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end
                  className={({ isActive }) => cx('rounded-[3px] px-3 py-1.5 text-sm transition-colors', isActive ? 'bg-fg/8 text-fg' : 'text-fg/70 hover:text-fg')}
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-6">
              <WalletLink />
              <Link to="/rounds" className="hidden items-center gap-2 rounded-[3px] bg-ink px-4 py-2.5 text-sm font-medium text-ink-fg hover:bg-black sm:flex">
                <span className="size-1.5 rounded-full bg-flame" /> Launch app
              </Link>
              <button className="rounded p-2 text-fg md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
                {open ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </div>
          </div>
          {open && (
            <nav className="border-t border-line bg-bg px-4 py-2 md:hidden">
              {[...links, { to: '/network', label: 'Modes & wallet' }].map((l) => (
                <NavLink key={l.to} to={l.to} className="block px-3 py-2.5 text-sm text-fg/80 hover:text-fg">
                  {l.label}
                </NavLink>
              ))}
            </nav>
          )}
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
      <Footer />
      <Toasts />
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-ink text-ink-fg">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <span className="flex items-center gap-2.5">
            <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
              <path d="M4 9 16 3l12 6-12 6z" fill="#ecebe6" />
              <path d="M4 15.5 16 21.5l12-6" fill="none" stroke="#f08a4b" strokeWidth="2.6" strokeLinejoin="round" />
              <path d="M4 22 16 28l12-6" fill="none" stroke="#ecebe6" strokeWidth="2.6" strokeLinejoin="round" />
            </svg>
            <span className="font-display text-[22px] leading-none">priveil</span>
          </span>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-fg/60">Fund builders. Protect voters. Privacy-preserving grant allocation, enforced by a Compact contract on Midnight.</p>
        </div>
        <div className="text-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-fg/45">Product</div>
          <div className="mt-4 flex flex-col gap-2.5 text-ink-fg/80">
            <Link to="/rounds" className="hover:text-ink-fg">Grant rounds</Link>
            <Link to="/rounds/new" className="hover:text-ink-fg">Create a round</Link>
            <Link to="/privacy" className="hover:text-ink-fg">How privacy works</Link>
            <Link to="/live" className="hover:text-ink-fg">Live on Midnight</Link>
            <Link to="/network" className="hover:text-ink-fg">Modes & wallet</Link>
          </div>
        </div>
        <div className="text-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-fg/45">Built with</div>
          <div className="mt-4 flex flex-col gap-2.5 text-ink-fg/80">
            <span>Midnight · Compact 0.28</span>
            <span>compactc 0.36.1</span>
            <span>Apache-2.0 · Midnight Buildathon</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  const width = className?.includes('max-w-') ? null : 'max-w-[1400px]';
  return <div className={cx('mx-auto px-4 py-10 sm:px-8 sm:py-14', width, className)}>{children}</div>;
}
