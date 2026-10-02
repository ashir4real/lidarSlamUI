import { useEffect, useRef } from 'react';
import { rosClient } from './rosClient';

export interface ManualCmd { lx: number; az: number; }

export function useManualCmdVel(
  values: ManualCmd,
  enabled: boolean,
  opts: { topic?: string; hz?: number } = {},
) {
  const { topic = '/cmd_vel', hz = 10 } = opts;
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const publish = (lx: number, az: number) => {
      try {
        const t = rosClient.topic<any>(topic, 'geometry_msgs/msg/Twist');
        if (!t) return;
        t.publish({
          linear: { x: lx, y: 0, z: 0 },
          angular: { x: 0, y: 0, z: az },
        });
      } catch { /* ROS offline */ }
    };

    const id = setInterval(() => {
      if (!enabledRef.current) return;
      const v = valuesRef.current;
      publish(v.lx, v.az);
    }, 1000 / hz);

    // If ROS disconnects mid-stream, try to zero (best effort)
    const off = rosClient.onStatus((s) => {
      if (s !== 'connected') publish(0, 0);
    });

    return () => {
      clearInterval(id);
      off();
      // send a final zero on disable/unmount
      publish(0, 0);
    };
  }, [topic, hz, enabled]);
}