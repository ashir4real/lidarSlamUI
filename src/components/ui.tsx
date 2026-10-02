import { ReactNode } from 'react';

export function Panel({
  title, actions, children, className = '', accent = 'cyan',
}: {
  title?: string; actions?: ReactNode; children: ReactNode;
  className?: string; accent?: 'cyan' | 'purple' | 'amber' | 'red';
}) {
  const dot = {
    cyan: 'dot-cyan',
    purple: 'dot-purple',
    amber: 'dot-amber',
    red: 'dot-red',
  }[accent];
  return (
    <div className={`relative flex flex-col rounded-xl glass overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            <span className="font-display text-[10px] uppercase tracking-[0.18em] text-dim">{title}</span>
          </div>
          <div className="flex items-center gap-1.5">{actions}</div>
        </div>
      )}
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}

export function Chip({
  children, tone = 'default', className = '',
}: {
  children: ReactNode;
  tone?: 'default' | 'cyan' | 'amber' | 'red' | 'purple' | 'emerald';
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: 'bg-white/5 text-dim border-white/10',
    cyan:    'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30',
    amber:   'bg-neon-amber/10 text-neon-amber border-neon-amber/30',
    red:     'bg-neon-red/10 text-neon-red border-neon-red/30',
    purple:  'bg-neon-purple/10 text-neon-purple border-neon-purple/30',
    emerald: 'bg-neon-emerald/10 text-neon-emerald border-neon-emerald/30',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono uppercase tracking-wider ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}