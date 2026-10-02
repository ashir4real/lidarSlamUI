import { useEffect, useRef, useState } from 'react';
import { useRosTopic } from './useRosTopic';

export interface OccupancyGrid {
  header: { stamp: { sec: number; nanosec: number }; frame_id: string };
  info: {
    resolution: number;   // m/cell
    width: number;        // cells
    height: number;       // cells
    origin: {
      position: { x: number; y: number; z: number };
      orientation: { x: number; y: number; z: number; w: number };
    };
  };
  data: number[];          // int8, flattened [height * width], row-major from bottom-left
}

export interface PoseWithCovariance {
  header: { stamp: { sec: number; nanosec: number }; frame_id: string };
  pose: {
    pose: {
      position: { x: number; y: number; z: number };
      orientation: { x: number; y: number; z: number; w: number };
    };
  };
}

/** Compute yaw from quaternion */
function yawFromQuat(x: number, y: number, z: number, w: number) {
  return Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
}

export function useMap(mapTopic = '/map', poseTopic = '/amcl_pose') {
  const grid = useRosTopic<OccupancyGrid>(mapTopic, 'nav_msgs/msg/OccupancyGrid');
  const pose = useRosTopic<PoseWithCovariance>(poseTopic, 'geometry_msgs/msg/PoseWithCovarianceStamped');

  const [robotPose, setRobotPose] = useState<{ x: number; y: number; yaw: number } | null>(null);

  useEffect(() => {
    if (!pose?.pose?.pose) return;
    const p = pose.pose.pose.position;
    const q = pose.pose.pose.orientation;
    setRobotPose({ x: p.x, y: p.y, yaw: yawFromQuat(q.x, q.y, q.z, q.w) });
  }, [pose]);

  return { grid, robotPose };
}