import { useRef, useState, useEffect } from 'react';
import { Panel, Chip } from './ui';
import {
  Power, Zap, AlertOctagon,
  Send, Square, Radar, Play, Pause,
} from 'lucide-react';
import { useCmdVel } from '../ros/useCmdVel';
import { useManualCmdVel } from '../ros/useManualCmdVel';
import { useOdom } from '../ros/useOdom';
import { useLidarToggle } from '../ros/useLidarToggle';

export type Cmd = { lx: number; az: number; speed: number };
export type Mode = 'AUTO' | 'MANUAL' | 'ESTOP';

// ---------------- Joystick ----------------
function Joystick({
  onChange, disabled,
}: {
  onChange: (x: number, y: number) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const [trail, setTrail] = useState<{ x: number; y: number; id: number }[]>([]);

  const handle = (e: React.PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const r = rect.width / 2 - 20;
    const dist = Math.hypot(dx, dy);
    if (dist > r) { dx = (dx / dist) * r; dy = (dy / dist) * r; }
    setPos({ x: dx, y: dy });
    setTrail((t) => [...t.slice(-8), { x: dx, y: dy, id: Date.now() + Math.random() }]);
    onChange(dx / r, -dy / r);
  };

  const release = () => {
    setActive(false);
    setPos({ x: 0, y: 0 });
    setTrail([]);
    onChange(0, 0);
  };

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        if (disabled) return;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        setActive(true);
        handle(e);
      }}
      onPointerMove={(e) => active && handle(e)}
      onPointerUp={release}
      onPointerCancel={release}
      className={`relative w-full h-full rounded-full select-none touch-none
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
    >
      <div
        className="absolute inset-0 rounded-full border-2 border-white/10"
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03), rgba(0,0,0,0) 70%)' }}
      />
      <div className="absolute inset-[18%] rounded-full border border-white/5" />
      <div className="absolute inset-[36%] rounded-full border border-white/5" />
      <div className="absolute top-1/2 left-4 right-4 h-px bg-white/5" />
      <div className="absolute left-1/2 top-4 bottom-4 w-px bg-white/5" />

      {trail.map((p, i) => (
        <div
          key={p.id}
          className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full bg-neon-cyan pointer-events-none"
          style={{
            transform: `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px))`,
            opacity: ((i + 1) / (trail.length + 2)) * 0.4,
          }}
        />
      ))}

      <div
        className={`absolute top-1/2 left-1/2 w-14 h-14 rounded-full pointer-events-none
          ${active ? 'bg-neon-cyan/20 border-2 border-neon-cyan glow-cyan' : 'bg-white/5 border-2 border-white/20'}`}
        style={{
          transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
          transitionProperty: active ? 'box-shadow' : 'transform, box-shadow',
          transitionDuration: active ? '150ms' : '220ms',
          transitionTimingFunction: 'cubic-bezier(0.2, 0.9, 0.3, 1.2)',
        }}
      >
        <div className={`absolute inset-4 rounded-full ${active ? 'bg-neon-cyan shadow-[0_0_14px_rgb(var(--neon-cyan))]' : 'bg-white/30'}`} />
      </div>
    </div>
  );
}

// ---------------- Velocity bar ----------------
function VelBar({ label, value, unit }: { label: string; value: number; unit: string }) {
  const pct = Math.max(0, Math.min(1, (value + 1) / 2)) * 100;
  const toneClass =
    Math.abs(value) > 0.66 ? 'bg-neon-red' :
    Math.abs(value) > 0.33 ? 'bg-neon-amber' :
    'bg-neon-cyan';
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="font-mono text-[10px] text-dim uppercase tracking-wider">{label}</span>
        <span className="font-mono text-[11px] text-white tabular-nums">
          {value >= 0 ? '+' : ''}{value.toFixed(2)} <span className="text-dim-dark">{unit}</span>
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`absolute top-0 bottom-0 ${toneClass}`}
          style={{
            left: `${Math.min(50, pct)}%`,
            width: `${Math.abs(pct - 50)}%`,
            boxShadow: '0 0 8px currentColor',
          }}
        />
        <div className="absolute top-0 bottom-0 w-px bg-white/30" style={{ left: '50%' }} />
      </div>
    </div>
  );
}

// ---------------- Odometry readout ----------------
function OdometryBlock({ topic = '/odom' }: { topic?: string }) {
  const odom = useOdom(topic);
  const fmt = (n: number, d = 2) => (n >= 0 ? ' ' : '') + n.toFixed(d);

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${odom ? 'dot-cyan animate-pulse-dot' : 'bg-white/15'}`} />
          <span className="font-display text-[10px] uppercase tracking-[0.18em] text-dim">Odometry</span>
        </div>
        <Chip tone={odom ? 'cyan' : 'default'}>{topic}</Chip>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'X',   value: odom ? fmt(odom.x) : '—',     unit: 'm' },
          { label: 'Y',   value: odom ? fmt(odom.y) : '—',     unit: 'm' },
          { label: 'Z',   value: odom ? fmt(odom.z) : '—',     unit: 'm' },
          { label: 'YAW', value: odom ? fmt(odom.yawDeg, 1) : '—', unit: '°' },
        ].map((v) => (
          <div key={v.label} className="rounded-md border border-white/5 bg-black/20 px-2 py-1.5">
            <div className="font-mono text-[9px] text-dim tracking-wider">{v.label}</div>
            <div className="font-mono text-[14px] text-white tabular-nums leading-tight">
              {v.value}
            </div>
            <div className="font-mono text-[9px] text-dim-dark">{v.unit}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/[0.03] border border-white/5">
          <span className="font-mono text-[10px] text-dim">vx</span>
          <span className="ml-auto font-mono text-[10px] text-white tabular-nums">
            {odom ? odom.vx.toFixed(3) : '—'} <span className="text-dim-dark">m/s</span>
          </span>
        </div>
        <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/[0.03] border border-white/5">
          <span className="font-mono text-[10px] text-dim">wz</span>
          <span className="ml-auto font-mono text-[10px] text-white tabular-nums">
            {odom ? odom.wz.toFixed(3) : '—'} <span className="text-dim-dark">rad/s</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------- Manual cmd_vel block ----------------
function ManualCmdBlock({
  active, setActive, lxStr, setLxStr, azStr, setAzStr, disabled,
}: {
  active: boolean;
  setActive: (b: boolean) => void;
  lxStr: string; setLxStr: (s: string) => void;
  azStr: string; setAzStr: (s: string) => void;
  disabled?: boolean;
}) {
  const { on: lidarOn, toggle: toggleLidar } = useLidarToggle('/lidar/enable', true);

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${active ? 'dot-amber animate-pulse-dot' : 'bg-white/15'}`} />
          <span className="font-display text-[10px] uppercase tracking-[0.18em] text-dim">Manual /cmd_vel</span>
        </div>

        {/* Lidar toggle */}
        <button
          onClick={toggleLidar}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[10px] tracking-wider border transition
            ${lidarOn
              ? 'bg-neon-emerald/10 text-neon-emerald border-neon-emerald/40'
              : 'bg-white/5 text-dim border-white/10 hover:text-white/80'}`}
          title="Toggle lidar on/off"
        >
          <Radar size={11} />
          LIDAR
          <span className={`w-1.5 h-1.5 rounded-full ${lidarOn ? 'dot-emerald' : 'bg-white/30'}`} />
          <span className="font-display">{lidarOn ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <label className="block">
          <span className="font-mono text-[9px] text-dim tracking-wider uppercase">
            Linear <span className="text-dim-dark">m/s</span>
          </span>
          <input
            type="number"
            step="0.05"
            min={-2}
            max={2}
            value={lxStr}
            disabled={disabled}
            onChange={(e) => setLxStr(e.target.value)}
            className="mt-0.5 w-full px-2 py-1.5 rounded-md bg-black/30 border border-white/10 focus:border-neon-cyan/60 focus:outline-none
              font-mono text-[13px] text-white tabular-nums disabled:opacity-40 transition"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[9px] text-dim tracking-wider uppercase">
            Angular <span className="text-dim-dark">rad/s</span>
          </span>
          <input
            type="number"
            step="0.05"
            min={-3}
            max={3}
            value={azStr}
            disabled={disabled}
            onChange={(e) => setAzStr(e.target.value)}
            className="mt-0.5 w-full px-2 py-1.5 rounded-md bg-black/30 border border-white/10 focus:border-neon-cyan/60 focus:outline-none
              font-mono text-[13px] text-white tabular-nums disabled:opacity-40 transition"
          />
        </label>
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setActive(true)}
          disabled={disabled || active}
          className={`flex items-center justify-center gap-2 py-2 rounded-md font-display text-[11px] tracking-wider border transition
            ${active
              ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/50 cursor-default'
              : disabled
                ? 'bg-white/5 text-dim border-white/10 cursor-not-allowed'
                : 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/40 hover:bg-neon-cyan/20 hover:glow-cyan'}`}
        >
          {active ? <Play size={12} className="fill-current" /> : <Send size={12} />}
          {active ? 'STREAMING' : 'SEND 10Hz'}
        </button>
        <button
          onClick={() => {
            setActive(false);
            setLxStr('0.0');
            setAzStr('0.0');
          }}
          disabled={disabled}
          className={`flex items-center justify-center gap-2 py-2 rounded-md font-display text-[11px] tracking-wider border transition
            ${disabled
              ? 'bg-white/5 text-dim border-white/10 cursor-not-allowed'
              : 'bg-neon-red/10 text-neon-red border-neon-red/40 hover:bg-neon-red/20 hover:glow-red'}`}
        >
          <Square size={12} className="fill-current" /> STOP
        </button>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-[9px] font-mono text-dim-dark">
        <Pause size={9} />
        <span>Streams continuously; zero Twist sent on STOP or disconnect.</span>
      </div>
    </div>
  );
}

// ---------------- Main ----------------
export default function TeleopPanel({
  mode, setMode, cmd, setCmd,
}: {
  mode: Mode; setMode: (m: Mode) => void;
  cmd: Cmd; setCmd: (c: Cmd) => void;
}) {
  const [key, setKey] = useState<string | null>(null);
  const manual = mode === 'MANUAL';

  // Manual cmd_vel state
  const [manualActive, setManualActive] = useState(false);
  const [lxStr, setLxStr] = useState('0.30');
  const [azStr, setAzStr] = useState('0.00');
  const manualLx = parseFloat(lxStr) || 0;
  const manualAz = parseFloat(azStr) || 0;

  // Joystick publisher — disabled while manual streaming is active
  useCmdVel(
    { lx: cmd.lx, az: cmd.az },
    {
      topic: '/cmd_vel',
      hz: 20,
      timeoutMs: 500,
      enabled: manual && !manualActive,
    },
  );

  // Manual stream publisher — 10 Hz
  useManualCmdVel(
    { lx: manualLx, az: manualAz },
    manual && manualActive,
    { topic: '/cmd_vel', hz: 10 },
  );

  // If we leave MANUAL mode, deactivate manual stream
  useEffect(() => {
    if (!manual) setManualActive(false);
  }, [manual]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode === 'ESTOP') return;
      setKey(e.key.toUpperCase());
      setTimeout(() => setKey(null), 120);
      if (e.key === ' ') {
        e.preventDefault();
        setMode('ESTOP');
        setCmd({ ...cmd, lx: 0, az: 0 });
        setManualActive(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, cmd, setCmd, setMode]);

  const KeyCap = ({ k, label }: { k: string; label?: string }) => (
    <div
      className={`w-7 h-7 rounded-md border flex items-center justify-center font-mono text-[10px] transition
        ${key === k
          ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/10 shadow-[0_0_10px_rgb(var(--neon-cyan)/0.6)]'
          : 'border-white/10 text-dim bg-white/5'}`}
    >
      {label || k}
    </div>
  );

  return (
    <Panel
      title="Teleoperation"
      accent={manual ? 'amber' : 'purple'}
      className="h-full"
      actions={
        <>
          <Chip tone="default">/cmd_vel</Chip>
          <Chip tone={manual ? 'amber' : mode === 'ESTOP' ? 'red' : 'purple'}>{mode}</Chip>
        </>
      }
    >
      {/* Top: mode selector — pinned */}
      <div className="shrink-0 p-2 border-b border-white/5">
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-black/30 border border-white/5">
          {(['AUTO', 'MANUAL', 'ESTOP'] as const).map((m) => {
            const active = mode === m;
            const cls = active
              ? m === 'ESTOP'
                ? 'bg-neon-red/20 text-neon-red border border-neon-red/40 glow-red animate-glow'
                : m === 'AUTO'
                  ? 'bg-neon-purple/15 text-neon-purple border border-neon-purple/40'
                  : 'bg-neon-amber/15 text-neon-amber border border-neon-amber/40'
              : 'text-dim hover:text-white/80 border border-transparent';
            return (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  if (m === 'ESTOP') {
                    setCmd({ ...cmd, lx: 0, az: 0 });
                    setManualActive(false);
                  }
                }}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md font-display text-[10px] tracking-wider transition ${cls}`}
              >
                {m === 'ESTOP' ? <AlertOctagon size={11} /> : m === 'AUTO' ? <Zap size={11} /> : <Power size={11} />}
                {m}
              </button>
            );
          })}
        </div>
      </div>

      {/* Middle: scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
        <div className="p-3 space-y-3">
          {/* Joystick + telemetry */}
          <div className="flex gap-3 items-start">
            {/* Joystick column */}
            <div className="flex-1 min-w-0 flex flex-col items-center">
              <div className="w-full max-w-[240px] aspect-square">
                <Joystick
                  disabled={!manual || manualActive}
                  onChange={(x, y) => {
                    if (!manual || manualActive) return;
                    setCmd({
                      ...cmd,
                      lx: +(y * cmd.speed).toFixed(3),
                      az: +(x * cmd.speed * 1.8).toFixed(3),
                    });
                  }}
                />
              </div>
              <div className="flex gap-1 mt-2 justify-center">
                <KeyCap k="W" />
                <KeyCap k="A" />
                <KeyCap k="S" />
                <KeyCap k="D" />
                <KeyCap k=" " label="⏹" />
              </div>
            </div>

            {/* Telemetry column */}
            <div className="flex-1 min-w-0 space-y-3">
              <VelBar label="Linear X" value={cmd.lx} unit="m/s" />
              <VelBar label="Angular Z" value={cmd.az} unit="rad/s" />
              <VelBar label="Linear Y" value={0} unit="m/s" />

              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-mono text-[10px] text-dim uppercase tracking-wider">Speed Limit</span>
                  <span className="font-mono text-[11px] text-neon-cyan">{Math.round(cmd.speed * 100)}%</span>
                </div>
                <input
                  type="range" min={0.1} max={1} step={0.05}
                  value={cmd.speed}
                  onChange={(e) => setCmd({ ...cmd, speed: +e.target.value })}
                  className="w-full h-1 appearance-none bg-white/10 rounded-full outline-none
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-neon-cyan
                    [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgb(var(--neon-cyan))]"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'X', v: cmd.lx, ok: cmd.lx !== 0 },
                  { label: 'Y', v: 0, ok: false },
                  { label: 'Z', v: 0, ok: false },
                  { label: 'YAW', v: cmd.az, ok: cmd.az !== 0 },
                ].map((a) => (
                  <div key={a.label} className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/[0.03] border border-white/5">
                    <div className={`w-1.5 h-1.5 rounded-full ${a.ok ? 'dot-cyan' : 'bg-white/15'}`} />
                    <span className="font-mono text-[10px] text-dim">{a.label}</span>
                    <span className="ml-auto font-mono text-[10px] text-white tabular-nums">{a.v.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Odometry block */}
          <OdometryBlock topic="/odom" />

          {/* Manual cmd block + lidar */}
          <ManualCmdBlock
            active={manualActive}
            setActive={setManualActive}
            lxStr={lxStr} setLxStr={setLxStr}
            azStr={azStr} setAzStr={setAzStr}
            disabled={!manual}
          />
        </div>
      </div>

      {/* Bottom: E-STOP — pinned */}
      <div className="shrink-0 p-2 border-t border-white/5">
        <button
          onClick={() => {
            setMode('ESTOP');
            setCmd({ ...cmd, lx: 0, az: 0 });
            setManualActive(false);
          }}
          className={`relative w-full py-2.5 rounded-lg font-display text-xs tracking-[0.2em] transition
            ${mode === 'ESTOP'
              ? 'bg-neon-red text-white glow-red animate-glow'
              : 'bg-neon-red/15 text-neon-red border border-neon-red/40 hover:bg-neon-red/25 hover:glow-red'}`}
        >
          <span className="inline-flex items-center gap-2">
            <AlertOctagon size={14} /> EMERGENCY STOP
          </span>
        </button>
      </div>
    </Panel>
  );
}