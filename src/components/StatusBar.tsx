import { useEffect, useState, useRef } from 'react';
import { Battery, Wifi, Activity, Palette, Check } from 'lucide-react';
import { Chip } from './ui';
import { THEMES, useTheme } from '../theme';
import type { ThemeId } from '../theme';
import { rosClient } from '../ros/rosClient';
import type { RosStatus } from '../ros/rosClient';

export default function StatusBar({ mode }: { mode: 'AUTO' | 'MANUAL' | 'ESTOP' }) {
  const [time, setTime] = useState(() => new Date());
  const [battery] = useState(87);
  const [latency, setLatency] = useState(42);
  const [open, setOpen] = useState(false);
  const [rosStatus, setRosStatus] = useState<RosStatus>('disconnected');
  const { theme, setTheme } = useTheme();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date());
      setLatency(38 + Math.round(Math.random() * 12));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => rosClient.onStatus(setRosStatus), []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const modeTone = mode === 'ESTOP' ? 'red' : mode === 'AUTO' ? 'purple' : 'amber';
  const statusTone: 'emerald' | 'amber' | 'red' =
    rosStatus === 'connected' ? 'emerald' :
    rosStatus === 'connecting' ? 'amber' : 'red';

  return (
    <div className="h-10 flex items-center justify-between px-3 border-b border-white/5 bg-ink-800/60 backdrop-blur-md shrink-0 z-30 relative">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full dot-emerald animate-pulse-dot" />
          <span className="font-display text-xs tracking-wider text-white">AIRONPROJECT · COMMAND CENTER</span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <Chip tone={modeTone as any}>MODE · {mode}</Chip>
        <Chip tone={statusTone}>
          <Wifi size={10} /> {rosStatus.toUpperCase()}
        </Chip>
        <Chip tone="default">
          <Activity size={10} /> {latency}ms
        </Chip>
      </div>

      <div className="flex items-center gap-3">
        <div ref={wrapRef} className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-white/10 text-dim hover:text-white hover:border-white/20 transition"
          >
            <Palette size={11} />
            <span className="font-mono text-[10px] tracking-wider uppercase">
              {THEMES.find((t) => t.id === theme)?.name}
            </span>
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-1 w-40 p-1 rounded-lg glass z-50">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setTheme(t.id as ThemeId); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 transition text-left"
                >
                  <span className="w-3 h-3 rounded-full border border-white/20" style={{ background: t.swatch }} />
                  <span className="font-mono text-[10px] text-white/90 flex-1">{t.name}</span>
                  {theme === t.id && <Check size={10} className="text-neon-cyan" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <Chip tone={battery < 30 ? 'amber' : 'emerald'}>
          <Battery size={10} /> {battery}%
        </Chip>
        <span className="font-mono text-xs text-dim tabular-nums">
          {time.toLocaleTimeString('en-GB')}
        </span>
      </div>
    </div>
  );
}