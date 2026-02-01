import { describe, it, expect } from 'vitest';
import Message from '../src/message';
import * as def from '../src/defines';

describe('Message', () => {
  it('roundtrip payload', () => {
    const msg = new Message(42, 'hello', 'bob', 'alice', 1620000000);
    const payload = msg.toPayload();
    const parsed = Message.fromPayload(payload);
    expect(parsed.getId()).toBe(42);
    expect(parsed.getContent()).toBe('hello');
    expect(parsed.getReciever()).toBe('bob');
    expect(parsed.getSender()).toBe('alice');
    expect(parsed.getTime()).toBe(1620000000);
  });

  it('pads fields correctly', () => {
    const msg = new Message(1, '', 'r', 's', 2);
    const payload = msg.toPayload();
    expect(payload.slice(0, def.PULSAR_ID_SIZE)).toBe('00000000000000000001');
    expect(payload.slice(def.PULSAR_ID_SIZE, def.PULSAR_ID_SIZE+def.PULSAR_TIME_SIZE)).toBe('0000000002');
    expect(payload.slice(def.PULSAR_ID_SIZE+def.PULSAR_TIME_SIZE, def.PULSAR_ID_SIZE+def.PULSAR_TIME_SIZE+def.PULSAR_SRC_SIZE).trim()).toBe('s');
    expect(payload.slice(def.PULSAR_ID_SIZE+def.PULSAR_TIME_SIZE+def.PULSAR_SRC_SIZE, def.PULSAR_ID_SIZE+def.PULSAR_TIME_SIZE+def.PULSAR_SRC_SIZE+def.PULSAR_DST_SIZE).trim()).toBe('r');
  });
});
