import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import PulsarWebSocket from '../src/websocket/pulsar';

describe('PulsarWebSocket', () => {
    let pws: PulsarWebSocket;

    beforeEach(() => {
        pws = new PulsarWebSocket('ws://localhost:8080');
    });

    afterEach(() => {
        pws.disconnect();
    });

    it('should create instance', () => {
        expect(pws).toBeDefined();
    });
});