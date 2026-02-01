import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import PulsarWebSocket from '../src/websocket/pulsar';

describe('PulsarWebSocket', () => {
  let originalWS: any;

  beforeEach(() => {
    originalWS = (global as any).WebSocket;
  });

  afterEach(() => {
    (global as any).WebSocket = originalWS;
  });

  it('connects and triggers events', () => {
    class FakeWS {
      static OPEN = 1;
      static CONNECTING = 0;
      readyState = 1;
      binaryType = '';
      listeners: Record<string, any[]> = {};
      constructor(url: string) { this.url = url; }
      addEventListener(ev:string, cb: any) { this.listeners[ev] = this.listeners[ev] || []; this.listeners[ev].push(cb); if (ev==='open') cb(); }
      send(data: any) { this._lastSend = data; }
      close(code?:number, reason?:string) { this.readyState = 3; if (this.listeners['close']) this.listeners['close'].forEach((cb:any)=>cb({})); }
    }

    (global as any).WebSocket = FakeWS;
    const pws = new PulsarWebSocket('ws://x');
    let opened=false;
    pws.onOpen = ()=> opened=true;
    pws.connect();
    expect(opened).toBe(true);
    expect(() => pws.send('x')).not.toThrow();
    pws.disconnect();
  });

  it('send throws when not open', () => {
    (global as any).WebSocket = undefined;
    const pws = new PulsarWebSocket('ws://x');
    expect(() => pws.send('x')).toThrow();
  });
});
