import { useEffect, useRef, useState, useMemo } from 'react';
import { Panel, Chip } from './ui';
import { Layers, Plus, ZoomIn, ZoomOut, Crosshair, Navigation, Trash2, Compass } from 'lucide-react';
import { getThemeColors, useTheme } from '../theme';
import { useMap } from '../ros/useMap';

type WP = { id: number; x: number; y: number; name: string };

export default function MapPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 55 });
  const viewRef = useRef(view);
  viewRef.current = view;

  const [wps, setWps] = useState<WP[]>([
    { id: 1, x: 2.5, y: 1.2, name: 'Dock A' },
    { id: 2, x: -2.0, y: 2.4, name: 'Dock B' },
    { id: 3, x: 3.1, y: -2.0, name: 'Charger' },
  ]);
  const wpsRef = useRef(wps);
  wpsRef.current = wps;

  const [layers, setLayers] = useState({ occupancy: true, costmap: true, path: true, sensors: false });
  const layersRef = useRef(layers);
  layersRef.current = layers;

  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  // ---- ROS data ----
  const { grid, robotPose } = useMap('/map', '/amcl_pose');
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const robotPoseRef = useRef(robotPose);
  robotPoseRef.current = robotPose;

  // ---- Theme colors ----
  const { theme } = useTheme();
  const colorsRef = useRef(getThemeColors());
  useEffect(() => { colorsRef.current = getThemeColors(); }, [theme]);

  const layerStyles = useMemo(() => ({
    occupancy: { on: 'bg-neon-red/30 border-neon-red',    off: 'border-white/20', dot: 'bg-neon-red'   },
    costmap:   { on: 'bg-neon-amber/30 border-neon-amber', off: 'border-white/20', dot: 'bg-neon-amber' },
    path:      { on: 'bg-neon-cyan/30 border-neon-cyan',   off: 'border-white/20', dot: 'bg-neon-cyan'  },
    sensors:   { on: 'bg-neon-blue/30 border-neon-blue',   off: 'border-white/20', dot: 'bg-neon-blue'  },
  }), []);

  // ---- Build offscreen texture when grid changes ----
  const mapTextureRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!grid) { mapTextureRef.current = null; return; }
    const { width, height } = grid.info;
    const off = document.createElement('canvas');
    off.width = width;
    off.height = height;
    const octx = off.getContext('2d')!;
    const img = octx.createImageData(width, height);

    for (let i = 0; i < width * height; i++) {
      const v = grid.data[i];   // -1 unknown, 0 free, 100 occupied
      const px = i * 4;
      if (v < 0)        { img.data[px+0]=10;  img.data[px+1]=12;  img.data[px+2]=20;  img.data[px+3]=0;   }
      else if (v > 65)  { img.data[px+0]=180; img.data[px+1]=40;  img.data[px+2]=40;  img.data[px+3]=220; }
      else if (v > 20)  { img.data[px+0]=160; img.data[px+1]=120; img.data[px+2]=40;  img.data[px+3]=150; }
      else              { img.data[px+0]=40;  img.data[px+1]=90;  img.data[px+2]=80;  img.data[px+3]=120; }
    }
    octx.putImageData(img, 0, 0);
    mapTextureRef.current = off;
  }, [grid]);

  // ---- Draw loop ----
  useEffect(() => {
    const canvas = canvasRef.current!;
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
      const { x: vx, y: vy, zoom: z } = viewRef.current;
      const cx = w / 2 + vx;
      const cy = h / 2 + vy;
      const ws = (wx: number, wy: number) => ({ x: cx + wx * z, y: cy - wy * z });

      // background
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h));
      bg.addColorStop(0, `rgb(${c.bgSecondary})`);
      bg.addColorStop(1, `rgb(${c.bgPrimary})`);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const minWx = Math.floor(-cx / z) - 1;
      const maxWx = Math.ceil((w - cx) / z) + 1;
      const minWy = Math.floor((cy - h) / z) - 1;
      const maxWy = Math.ceil(cy / z) + 1;

      // grid
      ctx.lineWidth = 1;
      for (let i = minWx; i <= maxWx; i++) {
        const p = ws(i, 0);
        ctx.strokeStyle = i === 0 ? `rgb(${c.cyan} / 0.35)` : `rgb(${c.cyan} / 0.07)`;
        ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, h); ctx.stroke();
      }
      for (let j = minWy; j <= maxWy; j++) {
        const p = ws(0, j);
        ctx.strokeStyle = j === 0 ? `rgb(${c.cyan} / 0.35)` : `rgb(${c.cyan} / 0.07)`;
        ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(w, p.y); ctx.stroke();
      }

      // ---- Real occupancy grid ----
      const currentGrid = gridRef.current;
      if (layersRef.current.occupancy && mapTextureRef.current && currentGrid) {
        const { resolution, width, height, origin } = currentGrid.info;
        const originPx = ws(origin.position.x, origin.position.y);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 0.78;
        ctx.drawImage(
          mapTextureRef.current,
          originPx.x,
          originPx.y - height * resolution * z,
          width * resolution * z,
          height * resolution * z,
        );
        ctx.restore();
      } else if (layersRef.current.occupancy) {
        // fallback procedural occupancy when no /map is available
        for (let i = minWx; i <= maxWx; i++) {
          for (let j = minWy; j <= maxWy; j++) {
            const n = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
            const f = n - Math.floor(n);
            if (f > 0.78 && Math.hypot(i, j) > 3) {
              const p = ws(i, j);
              const grad = ctx.createLinearGradient(p.x, p.y - z, p.x, p.y);
              grad.addColorStop(0, `rgb(${c.red} / 0.35)`);
              grad.addColorStop(1, `rgb(${c.red} / 0.12)`);
              ctx.fillStyle = grad;
              ctx.fillRect(p.x + 1, p.y - z + 1, z - 2, z - 2);
            }
          }
        }
      }

      // ---- Costmap glow ----
      if (layersRef.current.costmap) {
        for (let i = minWx; i <= maxWx; i++) {
          for (let j = minWy; j <= maxWy; j++) {
            const n = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
            const f = n - Math.floor(n);
            if (f > 0.78 && Math.hypot(i, j) > 3) {
              const p = ws(i, j);
              const g = ctx.createRadialGradient(p.x + z / 2, p.y - z / 2, 0, p.x + z / 2, p.y - z / 2, z * 2);
              g.addColorStop(0, `rgb(${c.amber} / 0.15)`);
              g.addColorStop(1, `rgb(${c.amber} / 0)`);
              ctx.fillStyle = g;
              ctx.fillRect(p.x - z, p.y - z * 2, z * 3, z * 3);
            }
          }
        }
      }

      // ---- Planned path ----
      if (layersRef.current.path && wpsRef.current.length) {
        const pts = [{ x: 0, y: 0 }, ...wpsRef.current];
        ctx.save();
        ctx.strokeStyle = `rgb(${c.cyan} / 0.85)`;
        ctx.lineWidth = 2;
        ctx.setLineDash([9, 6]);
        ctx.lineDashOffset = -t * 40;
        ctx.shadowColor = `rgb(${c.cyan} / 0.8)`;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        pts.forEach((p, i) => {
          const s = ws(p.x, p.y);
          if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
        });
        ctx.stroke();
        ctx.restore();
      }

      // ---- Robot marker (real pose if available, else origin) ----
      const pose = robotPoseRef.current ?? { x: 0, y: 0, yaw: -Math.PI / 3 + Math.sin(t * 0.6) * 0.5 };
      const rp = ws(pose.x, pose.y);
      const pulse = 1 + Math.sin(t * 3) * 0.12;
      const halo = ctx.createRadialGradient(rp.x, rp.y, 0, rp.x, rp.y, 46 * pulse);
      halo.addColorStop(0, `rgb(${c.cyan} / 0.5)`);
      halo.addColorStop(1, `rgb(${c.cyan} / 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(rp.x, rp.y, 46 * pulse, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = `rgb(${c.bgPrimary})`;
      ctx.strokeStyle = `rgb(${c.cyan})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(rp.x, rp.y, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      // heading: ROS yaw is CCW from +X, canvas y is flipped
      const heading = -pose.yaw;
      const hx = Math.cos(heading), hy = Math.sin(heading);
      ctx.beginPath();
      ctx.moveTo(rp.x, rp.y);
      ctx.arc(rp.x, rp.y, 22 * pulse, heading - 0.35, heading + 0.35);
      ctx.closePath();
      ctx.fillStyle = `rgb(${c.cyan} / 0.3)`;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(rp.x + hx * 8, rp.y + hy * 8);
      ctx.lineTo(rp.x + hx * 20, rp.y + hy * 20);
      ctx.strokeStyle = `rgb(${c.cyan})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // ---- Waypoints ----
      wpsRef.current.forEach((wp, i) => {
        const p = ws(wp.x, wp.y);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 22);
        g.addColorStop(0, `rgb(${c.purple} / 0.6)`);
        g.addColorStop(1, `rgb(${c.purple} / 0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = `rgb(${c.purple})`;
        ctx.strokeStyle = `rgb(${c.purple} / 0.4)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 9, 9, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x - 6, p.y - 4);
        ctx.lineTo(p.x, p.y + 5);
        ctx.lineTo(p.x + 6, p.y - 4);
        ctx.closePath();
        ctx.fillStyle = `rgb(${c.purple})`;
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), p.x, p.y - 9);

        ctx.font = '10px Inter';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.textBaseline = 'top';
        ctx.fillText(wp.name, p.x, p.y + 10);
      });

      t += 0.016;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  // wheel zoom
  useEffect(() => {
    const el = wrapRef.current!;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.88 : 1.12;
      setView((v) => {
        const newZoom = Math.max(18, Math.min(320, v.zoom * factor));
        const cx = rect.width / 2 + v.x;
        const cy = rect.height / 2 + v.y;
        const wx = (px - cx) / v.zoom;
        const wy = (cy - py) / v.zoom;
        return {
          zoom: newZoom,
          x: px - wx * newZoom - rect.width / 2,
          y: py + wy * newZoom - rect.height / 2,
        };
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    d.x = e.clientX;
    d.y = e.clientY;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (d && !d.moved) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const cx = rect.width / 2 + view.x;
      const cy = rect.height / 2 + view.y;
      const wx = (px - cx) / view.zoom;
      const wy = (cy - py) / view.zoom;
      setWps((w) => [...w, { id: Date.now(), x: +wx.toFixed(2), y: +wy.toFixed(2), name: `WP ${w.length + 1}` }]);
    }
    dragRef.current = null;
  };

  const resetCenter = () => setView((v) => ({ ...v, x: 0, y: 0 }));
  const zoom = (f: number) => setView((v) => ({ ...v, zoom: Math.max(18, Math.min(320, v.zoom * f)) }));

  return (
    <Panel
      title="Spatial Map"
      accent="purple"
      className="h-full"
      actions={<><Chip tone="cyan">map</Chip><Chip tone="purple">/plan</Chip></>}
    >
      <div ref={wrapRef} className="relative w-full h-full overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing touch-none"
        />

        {/* layers */}
        <div className="absolute top-2 left-2 w-36 rounded-lg glass p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Layers size={10} className="text-neon-cyan" />
            <span className="font-display text-[9px] uppercase tracking-widest text-dim">Layers</span>
          </div>
          {(['occupancy', 'costmap', 'path', 'sensors'] as const).map((k) => {
            const labels: Record<string, string> = { occupancy: 'Occupancy', costmap: 'Costmap', path: 'Path', sensors: 'Sensors' };
            const s = layerStyles[k];
            return (
              <label key={k} className="flex items-center gap-2 py-0.5 cursor-pointer group">
                <span
                  onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}
                  className={`w-3 h-3 rounded-[3px] border flex items-center justify-center transition
                    ${layers[k] ? s.on : s.off}`}
                >
                  {layers[k] && <span className={`w-1.5 h-1.5 rounded-sm ${s.dot}`} />}
                </span>
                <span className="font-mono text-[10px] text-dim group-hover:text-white transition">{labels[k]}</span>
              </label>
            );
          })}
        </div>

        {/* waypoints */}
        <div className="absolute top-2 right-2 w-40 rounded-lg glass p-2 max-h-[55%] flex flex-col">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-display text-[9px] uppercase tracking-widest text-dim">Waypoints</span>
            <button
              className="p-0.5 rounded hover:bg-white/10 text-neon-cyan"
              onClick={() =>
                setWps((w) => [...w, {
                  id: Date.now(),
                  x: +(Math.random() * 6 - 3).toFixed(2),
                  y: +(Math.random() * 6 - 3).toFixed(2),
                  name: `WP ${w.length + 1}`,
                }])
              }
              title="Add waypoint"
            >
              <Plus size={11} />
            </button>
          </div>
          <div className="space-y-0.5 overflow-y-auto scroll-thin pr-0.5">
            {wps.map((w, i) => (
              <div key={w.id} className="group flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-white/5">
                <span className="w-4 h-4 rounded-full bg-neon-purple/20 border border-neon-purple/60 text-neon-purple text-[9px] font-mono flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[10px] text-white/90 truncate">{w.name}</div>
                  <div className="font-mono text-[9px] text-dim-dark">{w.x.toFixed(1)}, {w.y.toFixed(1)}</div>
                </div>
                <button
                  onClick={() => setWps((arr) => arr.filter((x) => x.id !== w.id))}
                  className="opacity-0 group-hover:opacity-100 text-dim hover:text-neon-red transition"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* compass */}
        <div className="absolute bottom-3 left-3 w-16 h-16 rounded-full glass flex items-center justify-center">
          <Compass size={28} className="text-neon-cyan/60" strokeWidth={1.2} />
          <span className="absolute top-1 font-display text-[9px] text-neon-cyan tracking-widest">N</span>
        </div>

        {/* zoom */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1">
          <button onClick={() => zoom(1.2)} className="w-7 h-7 rounded-md glass flex items-center justify-center text-dim hover:text-neon-cyan transition">
            <ZoomIn size={12} />
          </button>
          <button onClick={() => zoom(0.83)} className="w-7 h-7 rounded-md glass flex items-center justify-center text-dim hover:text-neon-cyan transition">
            <ZoomOut size={12} />
          </button>
          <button onClick={resetCenter} className="w-7 h-7 rounded-md glass flex items-center justify-center text-dim hover:text-neon-cyan transition">
            <Crosshair size={12} />
          </button>
        </div>

        {/* status strip */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-2 py-1 rounded-md glass">
          <Chip tone="cyan">zoom {view.zoom.toFixed(0)}px/m</Chip>
          <Chip tone={robotPose ? 'emerald' : 'default'}>
            <Navigation size={9} /> {robotPose ? 'amcl' : 'origin'}
          </Chip>
          <Chip tone={grid ? 'emerald' : 'default'}>
            {grid ? `${grid.info.width}×${grid.info.height}` : 'no map'}
          </Chip>
        </div>
      </div>
    </Panel>
  );
}