import { describe, it, expect, vi } from 'vitest';
import { PulsarClient } from '../src/client';
import Message from '../src/message';

vi.mock('../src/websocket/pulsar', () => {
  return {
    default: class MockPulsarWebSocket {
      url: string;
      onOpen: any = null;
      onClose: any = null;
      onError: any = null;
      onMessage: any = null;
      constructor(url: string) { this.url = url; }
      connect() { if (this.onOpen) this.onOpen(); }
      disconnect() { if (this.onClose) this.onClose({} as CloseEvent); }
      send(raw: string) {
        const m = Message.fromPayload(raw);
        if (m.getReciever() === '!server.req') {
          const req = m.getContent();
          const rspContent = 'REQ:' + req + '\x1eRSP:PONG';
          const serverMsg = new Message(0, rspContent, m.getSender(), '!server.msg', Math.floor(Date.now()/1000));
          if (this.onMessage) this.onMessage(serverMsg.toPayload());
        }
      }
    }
  };
});

describe('PulsarClient', () => {
  it('parseAns various formats', () => {
    const cli = new PulsarClient('me', 'ws://x');
    const p: any = (cli as any).parseAns;
    expect((cli as any).parseAns('REQ:foo\x1eRSP:bar').req).toBe('foo');
    expect((cli as any).parseAns('REQ:foo').rsp).toBe('');
    expect((cli as any).parseAns('left RSP:bar').req).toBe('left');
    expect((cli as any).parseAns(' justleft ').req).toBe('justleft');
  });

  it('requestRaw resolves with server response', async () => {
    const cli = new PulsarClient('me', 'ws://x');
    cli.connect();
    const res = await cli.requestRaw('!ping');
    expect(res).toBe('PONG');
  });
});
