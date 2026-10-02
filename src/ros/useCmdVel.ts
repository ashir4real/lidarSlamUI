import { useEffect, useRef } from 'react';
import { rosClient } from './rosClient';

export interface Cmd {
  lx: number;   // linear.x  (m/s)
  az: number;   // angular.z (rad/s)
}

export function useCmdVel(
  cmd: Cmd,
  opts: {
    topic?: string;
    hz?: number;             // publish rate
    timeoutMs?: number;      // if no update in this window, send zero
    enabled?: boolean;       // false => send zero + skip
  } = {},
) {
  const { topic = '/cmd_vel', hz = 20, timeoutMs = 500, enabled = true } = opts;
  const lastUpdateRef = useRef(Date.now());
  const lastSentRef = useRef<Cmd>({ lx: 0, az: 0 });

  // track when cmd last changed
  useEffect(() => { lastUpdateRef.current = Date.now(); }, [cmd.lx, cmd.az]);

  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const silent = Date.now() - lastUpdateRef.current > timeoutMs;
      const stale = !enabled || silent;

      const out: Cmd = stale ? { lx: 0, az: 0 } : cmd;

      // skip if unchanged AND we already sent it
      if (
        out.lx === lastSentRef.current.lx &&
        out.az === lastSentRef.current.az &&
        !stale
      ) return;

      try {
        const t = rosClient.topic<any>(topic, 'geometry_msgs/msg/Twist');
        t.publish({
          linear: { x: out.lx, y: 0, z: 0 },
          angular: { x: 0, y: 0, z: out.az },
        } as any);
        lastSentRef.current = out;
      } catch {
        /* ros not connected — skip */
      }
    };

    const id = setInterval(tick, 1000 / hz);

    // On disconnect or unload, send a final zero (best effort)
    const zero = () => {
      try {
        const t = rosClient.topic<any>(topic, 'geometry_msgs/msg/Twist');
        t.publish({
          linear: { x: 0, y: 0, z: 0 },
          angular: { x: 0, y: 0, z: 0 },
        } as any);
      } catch { /* */ }
    };
    const off = rosClient.onStatus((s) => { if (s !== 'connected') zero(); });
    window.addEventListener('beforeunload', zero);

    return () => {
      cancelled = true;
      clearInterval(id);
      off();
      window.removeEventListener('beforeunload', zero);
      zero();
    };
  }, [topic, hz, timeoutMs, enabled, cmd.lx, cmd.az]);
}