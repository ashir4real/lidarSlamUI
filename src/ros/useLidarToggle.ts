import { useEffect, useState } from 'react';
import { rosClient } from './rosClient';

export function useLidarToggle(topic = '/lidar/enable', initial = true) {
  const [on, setOn] = useState(initial);

  const publish = (value: boolean) => {
    try {
      const t = rosClient.topic<any>(topic, 'std_msgs/msg/Bool');
      if (t) t.publish({ data: value });
    } catch { /* ROS offline */ }
    setOn(value);
  };

  // Re-publish state when ROS (re)connects so the robot catches up
  useEffect(() => {
    const off = rosClient.onStatus((s) => {
      if (s === 'connected') publish(on);
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, topic]);

  return { on, set: publish, toggle: () => publish(!on) };
}