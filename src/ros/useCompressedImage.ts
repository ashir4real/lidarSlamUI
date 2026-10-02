import { useEffect, useState } from 'react';
import { useRosTopic } from './useRosTopic';

interface CompressedImage {
  header: { stamp: { sec: number; nanosec: number }; frame_id: string };
  format: string;   // e.g. "jpeg"
  data: string;     // base64
}

export function useCompressedImage(topic: string) {
  const msg = useRosTopic<CompressedImage>(
    topic,
    'sensor_msgs/msg/CompressedImage',
    { throttle_rate: 100, queue_length: 1 }, // max 10 Hz to browser
  );
  const [url, setUrl] = useState<string | null>(null);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!msg?.data) return;
    // ROS2 rosbridge delivers data as base64 string
    const mime = msg.format?.includes('png') ? 'image/png' : 'image/jpeg';
    setUrl(`data:${mime};base64,${msg.data}`);
  }, [msg]);

  // fps counter
  useEffect(() => {
    if (!msg) return;
    let count = 0;
    const id = setInterval(() => { setFps(count); count = 0; }, 1000);
    count++;
    return () => clearInterval(id);
  }, [msg]);

  return { url, fps, frameId: msg?.header?.frame_id };
}