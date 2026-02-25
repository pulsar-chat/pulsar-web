import { describe, it, expect } from 'vitest';
import { updateContactLastMessage } from '../src/contacts';
import { Contact } from '../src/types';

describe('contacts utilities', () => {
    it('sanitizes file tags when updating last message', () => {
        const map = new Map<string, Contact>();
        map.set('@bob', { name: '@bob' });
        updateContactLastMessage(map, '@bob', '[FILE:http://x/1.png] hello', 123, '@alice');
        const c = map.get('@bob')!;
        expect(c.lastMessage).toBe('hello');
    });

    it('replaces empty sanitized message with a placeholder', () => {
        const map = new Map<string, Contact>();
        map.set('@bob', { name: '@bob' });
        updateContactLastMessage(map, '@bob', '[FILE:http://x/1.png]', 123);
        expect(map.get('@bob')!.lastMessage).toBe('📎 файл');
    });
});