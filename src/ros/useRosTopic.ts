import { useEffect, useState } from 'react';
import { rosClient } from './rosClient';

export function useRosTopic<T = any>(
  name: string,
  messageType: string,
  opts: { throttle_rate?: number; queue_length?: number } = {},
) {
  const [message, setMessage] = useState<T | null>(null);

  useEffect(() => {
    let cancelled = false;
    let currentTopic: any = null;

    const handler = (msg: T) => {
      if (!cancelled) setMessage(msg);
    };

    const trySubscribe = () => {
      // Only attempt when we're actually connected
      if (rosClient.getStatus() !== 'connected') return;

      try {
        const topic = rosClient.topic<T>(name, messageType);
        if (!topic) return;                 // <— guards the crash
        if (currentTopic === topic) return; // already subscribed

        // If we had a previous topic (e.g. after reconnect), drop it
        if (currentTopic) {
          try { currentTopic.unsubscribe(handler); } catch { /* ignore */ }
        }

        if (opts.throttle_rate) topic.throttle_rate = opts.throttle_rate;
        if (opts.queue_length)   topic.queue_length   = opts.queue_length;

        topic.subscribe(handler);
        currentTopic = topic;
      } catch {
        /* ROS hiccup — will retry on next status event */
      }
    };

    // Try now (no-op if not connected yet)
    trySubscribe();

    // Retry whenever the connection state changes to 'connected'
    const off = rosClient.onStatus((s) => {
      if (s === 'connected') trySubscribe();
    });

    return () => {
      cancelled = true;
      off();
      if (currentTopic) {
        try { currentTopic.unsubscribe(handler); } catch { /* ignore */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, messageType]);

  return message;
}