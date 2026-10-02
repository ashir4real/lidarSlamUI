// Lazy-loaded — never crashes if roslib is missing. Uses namespace import
// because roslib is ESM without a default export.
export type RosStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'unavailable';

type Listener = (status: RosStatus) => void;

class RosClient {
  ros: any = null;
  private ROSLIB: any = null;
  private url = 'ws://localhost:9090';
  private status: RosStatus = 'disconnected';
  private listeners = new Set<Listener>();
  private topics = new Map<string, any>();
  private retryMs = 2000;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private deliberatelyClosed = false;

  async connect(url?: string) {
    if (url) this.url = url;
    this.deliberatelyClosed = false;

    if (!this.ROSLIB) {
      try {
        const mod: any = await import('roslib');
        // Handle both shapes: namespace object (ESM) or default-wrapped (CJS interop)
        this.ROSLIB = mod?.default ?? mod;
        if (!this.ROSLIB?.Ros) {
          // Some bundlers give us { default: { Ros, Topic, ... } }
          this.ROSLIB = mod?.default?.default ?? mod;
        }
      } catch (err) {
        console.warn('[rosClient] roslib not installed — offline mode.', err);
        this.setStatus('unavailable');
        return;
      }
    }

    if (!this.ROSLIB?.Ros) {
      console.warn('[rosClient] roslib loaded but Ros not found — offline mode.');
      this.setStatus('unavailable');
      return;
    }

    if (this.ros) {
      try { this.ros.close(); } catch { /* ignore */ }
      this.ros = null;
    }

    this.setStatus('connecting');
    try {
      const ros = new this.ROSLIB.Ros({ url: this.url });
      this.ros = ros;

      ros.on('connection', () => {
		  this.setStatus('connected');
		  this.retryMs = 2000;
		  // No resubscribe loop here — useRosTopic handles it via onStatus('connected').
		});

      ros.on('error', () => this.setStatus('error'));
      ros.on('close', () => {
		  this.setStatus('disconnected');

		  // ⚠️ Topic objects hold a reference to the old Ros. Clear them so
		  // useRosTopic recreates fresh ones against the new Ros on reconnect.
		  this.topics.clear();
		  this.ros = null;

		  if (!this.deliberatelyClosed) {
			if (this.retryTimer) clearTimeout(this.retryTimer);
			this.retryTimer = setTimeout(() => this.connect(), this.retryMs);
			this.retryMs = Math.min(this.retryMs * 1.5, 15000);
		  }
		});
    } catch (err) {
      console.warn('[rosClient] failed to create ROS connection', err);
      this.setStatus('unavailable');
    }
  }

  disconnect() {
    this.deliberatelyClosed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    try { this.ros?.close(); } catch { /* ignore */ }
    this.setStatus('disconnected');
  }

  topic<T = any>(name: string, messageType: string): any | null {
    if (!this.ros || !this.ROSLIB?.Topic) return null;
    const key = `${name}|${messageType}`;
    if (!this.topics.has(key)) {
      try {
        this.topics.set(key, new this.ROSLIB.Topic({
          ros: this.ros, name, messageType,
        }));
      } catch {
        return null;
      }
    }
    return this.topics.get(key);
  }

  setStatus(s: RosStatus) {
    if (this.status === s) return;
    this.status = s;
    this.listeners.forEach((l) => l(s));
  }

  getStatus() { return this.status; }

  onStatus(fn: Listener) {
    this.listeners.add(fn);
    fn(this.status);
    return () => { this.listeners.delete(fn); };
  }
}

export const rosClient = new RosClient();