import { useEffect, useState } from 'react';
import { useRosTopic } from './useRosTopic';

export interface OdomMsg {
  header: { stamp: { sec: number; nanosec: number }; frame_id: string };
  child_frame_id: string;
  pose: {
    pose: {
      position: { x: number; y: number; z: number };
      orientation: { x: number; y: number; z: number; w: number };
    };
  };
  twist: {
    linear: { x: number; y: number; z: number };
    angular: { x: number; y: number; z: number };
  };
}

function yawFromQuat(x: number, y: number, z: number, w: number) {
  return Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
}

export interface OdomReading {
  x: number;
  y: number;
  z: number;
  yaw: number;      // radians
  yawDeg: number;   // degrees
  vx: number;       // linear.x from odom twist
  wz: number;       // angular.z from odom twist
}

export function useOdom(topic = '/odom') {
  const msg = useRosTopic<OdomMsg>(topic, 'nav_msgs/msg/Odometry');
  const [reading, setReading] = useState<OdomReading | null>(null);

  useEffect(() => {
    if (!msg?.pose?.pose) return;
    const p = msg.pose.pose.position;
    const q = msg.pose.pose.orientation;
    const yaw = yawFromQuat(q.x, q.y, q.z, q.w);
    setReading({
      x: p.x, y: p.y, z: p.z,
      yaw, yawDeg: (yaw * 180) / Math.PI,
      vx: msg.twist?.linear?.x ?? 0,
      wz: msg.twist?.angular?.z ?? 0,
    });
  }, [msg]);

  return reading;
}