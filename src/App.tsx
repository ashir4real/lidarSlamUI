import { useState, useEffect } from 'react';
import { Gamepad2, Map as MapIcon } from 'lucide-react';
import StatusBar from './components/StatusBar';
import CameraViewports from './components/CameraViewports';
import TeleopPanel from './components/TeleopPanel';
import type { Cmd, Mode } from './components/TeleopPanel';
import MapPanel from './components/MapPanel';
import { ThemeContext } from './theme';
import type { ThemeId } from './theme';
import { rosClient } from './ros/rosClient';

type Tab = 'teleop' | 'map';

export default function App() {
  const [theme, setTheme] = useState<ThemeId>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('airon-theme') : null;
    return (saved as ThemeId) || 'cyber';
  });
  const [tab, setTab] = useState<Tab>('teleop');
  const [mode, setMode] = useState<Mode>('MANUAL');
  const [cmd, setCmd] = useState<Cmd>({ lx: 0, az: 0, speed: 0.6 });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('airon-theme', theme);
  }, [theme]);

  // Connect to rosbridge on mount, disconnect on unmount
  useEffect(() => {
    const url = (import.meta as any).env?.VITE_ROSBRIDGE_URL ?? 'ws://localhost:9090';
    rosClient.connect(url);
    return () => rosClient.disconnect();
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div className="h-screen w-screen flex flex-col bg-ink text-white overflow-hidden">
        <StatusBar mode={mode} />

        <div className="flex-1 grid grid-cols-12 gap-2.5 p-2.5 min-h-0">
          {/* LEFT: cameras */}
          <div className="col-span-7 min-h-0">
            <CameraViewports />
          </div>

          {/* RIGHT: tabbed teleop / map */}
          <div className="col-span-5 flex flex-col gap-2 min-h-0">
            <div className="shrink-0 flex items-center gap-1 p-1 rounded-lg glass w-fit">
              <button
                onClick={() => setTab('teleop')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-display text-[11px] tracking-wider transition
                  ${tab === 'teleop'
                    ? 'bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/40'
                    : 'text-dim hover:text-white/80 border border-transparent'}`}
              >
                <Gamepad2 size={12} /> TELEOP
              </button>
              <button
                onClick={() => setTab('map')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-display text-[11px] tracking-wider transition
                  ${tab === 'map'
                    ? 'bg-neon-purple/15 text-neon-purple border border-neon-purple/40'
                    : 'text-dim hover:text-white/80 border border-transparent'}`}
              >
                <MapIcon size={12} /> MAP
              </button>
            </div>

            <div className="flex-1 min-h-0">
              {tab === 'teleop'
                ? <TeleopPanel mode={mode} setMode={setMode} cmd={cmd} setCmd={setCmd} />
                : <MapPanel />}
            </div>
          </div>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}