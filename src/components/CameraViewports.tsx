import { useEffect, useRef } from 'react';
import { Panel, Chip } from './ui';
import { Circle, Layers, Crosshair, Maximize2, Camera as CamIcon } from 'lucide-react';
import { getThemeColors, useTheme } from '../theme';
import { useCompressedImage } from '../ros/useCompressedImage';

type FeedVariant = 'primary' | 'rear' | 'depth' | 'detect';

// ---------- Fallback procedural canvas ----------
function CameraCanvas({ variant }: { variant: FeedVariant }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const colorsRef = useRef(getThemeColors());
  useEffect(() => { colorsRef.current = getThemeColors(); }, [theme]);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let t = 0;

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const c = colorsRef.current;
      const isDepth = variant === 'depth';

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, `rgb(${c.bgSecondary})`);
      bg.addColorStop(1, `rgb(${c.bgPrimary})`);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const horizon = h * 0.45;
      const vpx = w / 2;
      const vpy = horizon;

      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, `rgb(${c.bgPrimary})`);
      sky.addColorStop(1, isDepth ? `rgb(${c.blue} / 0.25)` : `rgb(${c.bgSecondary})`);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, horizon);

      const hg = ctx.createRadialGradient(vpx, vpy, 0, vpx, vpy, w * 0.6);
      hg.addColorStop(0, isDepth ? `rgb(${c.blue} / 0.35)` : `rgb(${c.cyan} / 0.18)`);
      hg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(0, horizon - 40, w, 100);

      const numHoriz = 14;
      for (let i = 0; i < numHoriz; i++) {
        const prog = ((i / numHoriz) + (t * 0.35) % 1) % 1;
        const y = horizon + (h - horizon) * Math.pow(prog, 2.4);
        const alpha = Math.pow(prog, 1.4);
        ctx.strokeStyle = isDepth
          ? `rgb(${c.blue} / ${alpha * 0.6})`
          : `rgb(${c.cyan} / ${alpha * 0.5})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const radial = 10;
      for (let i = -radial; i <= radial; i++) {
        const angle = (i / radial) * Math.PI * 0.35;
        const x2 = vpx + Math.tan(angle) * w * 1.4;
        ctx.strokeStyle = isDepth ? `rgb(${c.blue} / 0.15)` : `rgb(${c.cyan} / 0.10)`;
        ctx.beginPath();
        ctx.moveTo(vpx, vpy);
        ctx.lineTo(x2, h);
        ctx.stroke();
      }

      if (isDepth) {
        for (let i = 0; i < 5; i++) {
          const r = (h * 0.9) * ((i + 1) / 5);
          const g = ctx.createRadialGradient(vpx, h * 0.7, 0, vpx, h * 0.7, r);
          g.addColorStop(0, `rgb(${c.red} / 0.05)`);
          g.addColorStop(0.5, `rgb(${c.amber} / 0.04)`);
          g.addColorStop(1, `rgb(${c.blue} / 0)`);
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        }
      }

      for (let i = 0; i < 60; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
        ctx.fillRect(x, y, 1, 1);
      }

      t += 0.016;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [variant]);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

// ---------- HUD overlay ----------
function HudOverlay({ label, fps }: { label: string; fps?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
        <div
          key={c}
          className="absolute w-7 h-7 border-neon-cyan/70"
          style={{
            top: c.startsWith('t') ? 8 : undefined,
            bottom: c.startsWith('b') ? 8 : undefined,
            left: c.endsWith('l') ? 8 : undefined,
            right: c.endsWith('r') ? 8 : undefined,
            borderTopWidth: c.startsWith('t') ? 2 : 0,
            borderBottomWidth: c.startsWith('b') ? 2 : 0,
            borderLeftWidth: c.endsWith('l') ? 2 : 0,
            borderRightWidth: c.endsWith('r') ? 2 : 0,
            filter: 'drop-shadow(0 0 4px rgb(var(--neon-cyan) / 0.7))',
          }}
        />
      ))}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-neon-red animate-blink" />
        <span className="font-mono text-[10px] tracking-widest text-white/90">REC</span>
      </div>
      <div className="absolute top-3 right-3">
        <span className="font-mono text-[10px] tracking-wider text-neon-cyan/90 bg-black/40 px-2 py-0.5 rounded">
          {label}{fps !== undefined ? ` · ${fps}fps` : ''}
        </span>
      </div>
      <div className="absolute bottom-3 left-3 font-mono text-[10px] text-white/60">
        1280×720
      </div>
      <div className="absolute bottom-3 right-3 text-neon-cyan/70">
        <Crosshair size={14} />
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-8 h-8 relative">
          <div className="absolute top-1/2 left-0 w-2 h-px bg-neon-cyan/70" />
          <div className="absolute top-1/2 right-0 w-2 h-px bg-neon-cyan/70" />
          <div className="absolute left-1/2 top-0 h-2 w-px bg-neon-cyan/70" />
          <div className="absolute left-1/2 bottom-0 h-2 w-px bg-neon-cyan/70" />
        </div>
      </div>
      <div className="absolute inset-0 overflow-hidden opacity-[0.06]">
        <div className="w-full h-16 bg-gradient-to-b from-transparent via-neon-cyan to-transparent animate-scan" />
      </div>
    </div>
  );
}

// ---------- Detection overlay ----------
function DetectionBoxes() {
  const boxes = [
    { top: '32%', left: '44%', w: '18%', h: '24%', label: 'person', conf: 0.94, border: 'border-neon-cyan/80',  glow: '0 0 12px rgb(var(--neon-cyan) / 0.4)'  },
    { top: '58%', left: '20%', w: '14%', h: '16%', label: 'chair',  conf: 0.78, border: 'border-neon-amber/80', glow: '0 0 12px rgb(var(--neon-amber) / 0.4)' },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none">
      {boxes.map((b, i) => (
        <div
          key={i}
          className={`absolute ${b.border} rounded-sm`}
          style={{ top: b.top, left: b.left, width: b.w, height: b.h, borderWidth: 2, boxShadow: b.glow }}
        >
          <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[9px] font-mono bg-black/60 border border-white/10 text-white whitespace-nowrap">
            {b.label} {b.conf}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------- Main component ----------
export default function CameraViewports() {
  const { url: primaryImg, fps: primaryFps } = useCompressedImage('/camera/image_raw/compressed');
  const { url: rearImg,    fps: rearFps    } = useCompressedImage('/camera/rear/image_raw/compressed');
  const { url: depthImg                    } = useCompressedImage('/camera/depth/image_raw/compressed');

  return (
    <Panel
      title="Camera Array"
      className="h-full"
      actions={
        <>
          <Chip tone={primaryImg ? 'emerald' : 'cyan'}>
            <Circle size={8} className="fill-current" /> {primaryImg ? 'LIVE' : 'SIM'}
          </Chip>
          <button className="p-1 rounded hover:bg-white/5 text-dim hover:text-white transition">
            <Maximize2 size={12} />
          </button>
        </>
      }
    >
      <div className="h-full grid grid-cols-3 grid-rows-3 gap-2 p-2 min-h-0">
        {/* Primary */}
        <div className="relative col-span-2 row-span-3 rounded-lg overflow-hidden border border-neon-cyan/20">
          {primaryImg ? (
            <img
              src={primaryImg}
              className="absolute inset-0 w-full h-full object-cover"
              alt="primary camera"
              draggable={false}
            />
          ) : (
            <CameraCanvas variant="primary" />
          )}
          <HudOverlay label="FRONT · RGB" fps={primaryImg ? primaryFps : undefined} />
        </div>

        {/* Rear */}
        <div className="relative row-span-1 rounded-lg overflow-hidden border border-white/5">
          {rearImg ? (
            <img
              src={rearImg}
              className="absolute inset-0 w-full h-full object-cover"
              alt="rear camera"
              draggable={false}
            />
          ) : (
            <CameraCanvas variant="rear" />
          )}
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-neon-red/80 animate-blink" />
            <span className="font-mono text-[9px] text-white/80 tracking-widest">REAR</span>
          </div>
          <div className="absolute bottom-2 right-2 text-neon-cyan/50">
            <CamIcon size={11} />
          </div>
          {rearImg && (
            <div className="absolute bottom-2 left-2 font-mono text-[9px] text-white/70">
              {rearFps}fps
            </div>
          )}
        </div>

        {/* Depth */}
        <div className="relative row-span-1 rounded-lg overflow-hidden border border-neon-blue/20">
          {depthImg ? (
            <img
              src={depthImg}
              className="absolute inset-0 w-full h-full object-cover"
              alt="depth camera"
              draggable={false}
            />
          ) : (
            <CameraCanvas variant="depth" />
          )}
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <Layers size={9} className="text-neon-blue" />
            <span className="font-mono text-[9px] text-neon-blue/90 tracking-widest">DEPTH</span>
          </div>
          <div
            className="absolute bottom-2 left-2 right-2 h-1 rounded-full overflow-hidden"
            style={{ background: 'linear-gradient(90deg, rgb(var(--neon-blue)), rgb(var(--neon-cyan)), rgb(var(--neon-amber)), rgb(var(--neon-red)))' }}
          />
        </div>

        {/* Detection */}
        <div className="relative row-span-1 rounded-lg overflow-hidden border border-neon-purple/20">
          {primaryImg ? (
            <img
              src={primaryImg}
              className="absolute inset-0 w-full h-full object-cover"
              alt="detection"
              draggable={false}
            />
          ) : (
            <CameraCanvas variant="detect" />
          )}
          <DetectionBoxes />
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full dot-purple" />
            <span className="font-mono text-[9px] text-neon-purple tracking-widest">YOLO</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}