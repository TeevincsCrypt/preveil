import { useState, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { Check, Copy, Eye, EyeOff, Lock, Globe } from 'lucide-react';
import { toHex } from '@contract/crypto';

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export function Card({ children, className, tone }: { children: ReactNode; className?: string; tone?: 'private' | 'public' }) {
  return (
    <div
      className={cx(
        'rounded-2xl border bg-surface',
        tone === 'private' ? 'border-private/25' : tone === 'public' ? 'border-public/20' : 'border-line',
        className,
      )}
    >
      {children}
    </div>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  variant = 'primary',
  className,
  children,
  busy,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-private',
        variant === 'primary' && 'bg-fg text-bg hover:bg-white',
        variant === 'secondary' && 'border border-line-strong bg-raised text-fg hover:border-white/25',
        variant === 'ghost' && 'text-muted hover:bg-white/5 hover:text-fg',
        variant === 'danger' && 'border border-bad/30 bg-bad/10 text-bad hover:bg-bad/15',
        className,
      )}
    >
      {busy && <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'private' | 'public' | 'ok' | 'bad' | 'warn' | 'live'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        tone === 'neutral' && 'bg-white/6 text-muted',
        tone === 'private' && 'bg-private-dim text-private',
        tone === 'public' && 'bg-public-dim text-public',
        tone === 'ok' && 'bg-ok/10 text-ok',
        tone === 'bad' && 'bg-bad/10 text-bad',
        tone === 'warn' && 'bg-warn/10 text-warn',
        tone === 'live' && 'bg-ok/10 text-ok',
        className,
      )}
    >
      {tone === 'live' && <span className="pulse-dot size-1.5 rounded-full bg-ok" />}
      {children}
    </span>
  );
}

export function PrivateTag({ className }: { className?: string }) {
  return (
    <Badge tone="private" className={className}>
      <Lock className="size-3" /> Private
    </Badge>
  );
}
export function PublicTag({ className }: { className?: string }) {
  return (
    <Badge tone="public" className={className}>
      <Globe className="size-3" /> Public
    </Badge>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'private' | 'public' }) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-[0.14em] text-faint">{label}</div>
      <div className={cx('mt-1.5 truncate text-xl font-medium tabular-nums tracking-tight sm:text-2xl', tone === 'private' && 'text-private', tone === 'public' && 'text-public')}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Hash({ value, n = 10, className, secret }: { value: Uint8Array | string; n?: number; className?: string; secret?: boolean }) {
  const hex = typeof value === 'string' ? value : toHex(value);
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(!secret);
  const text = shown ? `0x${hex.slice(0, n)}…${hex.slice(-6)}` : '0x' + '•'.repeat(n + 4);
  return (
    <span className={cx('inline-flex min-w-0 items-center gap-1 font-mono text-[12.5px]', className)}>
      <span className="truncate">{text}</span>
      {secret && (
        <button aria-label={shown ? 'Hide' : 'Show'} onClick={() => setShown(!shown)} className="text-faint hover:text-fg">
          {shown ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      )}
      {shown && (
        <button
          aria-label="Copy"
          className="text-faint hover:text-fg"
          onClick={() => {
            void navigator.clipboard?.writeText('0x' + hex);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
        </button>
      )}
    </span>
  );
}

export function Field({ label, hint, children, error }: { label: string; hint?: string; children: ReactNode; error?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-fg">{label}</span>
      {hint && <span className="ml-2 text-xs text-faint">{hint}</span>}
      <div className="mt-1.5">{children}</div>
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  );
}

export const inputCls =
  'w-full rounded-xl border border-line-strong bg-bg px-3.5 py-2.5 text-sm text-fg placeholder:text-faint focus:border-private/60 focus:outline-none';

export function SectionHeader({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <div className="text-xs font-medium uppercase tracking-[0.18em] text-private">{eyebrow}</div>}
      <h2 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight text-fg sm:text-5xl">{title}</h2>
      {children && <p className="mt-4 text-base leading-relaxed text-muted">{children}</p>}
    </div>
  );
}

export function KV({ k, children, tone }: { k: string; children: ReactNode; tone?: 'private' | 'public' }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className={cx('shrink-0 text-muted', tone === 'private' && 'text-private/80', tone === 'public' && 'text-public/80')}>{k}</span>
      <span className="min-w-0 truncate text-right text-fg">{children}</span>
    </div>
  );
}

export function Meter({ value, max, tone = 'public' }: { value: number; max: number; tone?: 'public' | 'private' | 'ok' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/6">
      <div
        className={cx('h-full rounded-full transition-[width] duration-500', tone === 'public' && 'bg-public', tone === 'private' && 'bg-private', tone === 'ok' && 'bg-ok')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
