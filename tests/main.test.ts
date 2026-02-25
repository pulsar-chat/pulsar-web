import { describe, it, expect, vi } from 'vitest';
import { buildMessageWithFiles } from '../src/main';
import * as filesMod from '../src/files';

// simple File constructor should work in JSDOM
function createFile(name: string, data: string, type: string = 'text/plain'): File {
    return new File([data], name, { type });
}

describe('message building helpers', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('returns plain text when there are no files', async () => {
        const res = await buildMessageWithFiles('hello', []);
        expect(res).toBe('hello');
    });

    it('prepends file tags for each uploaded file', async () => {
        const spy = vi.spyOn(filesMod, 'uploadFile');
        spy.mockResolvedValueOnce({ url: 'http://a' });
        spy.mockResolvedValueOnce({ url: 'http://b' });

        const files = [createFile('a.txt', 'x'), createFile('b.txt', 'y')];
        const res = await buildMessageWithFiles('world', files);

        expect(spy).toHaveBeenCalledTimes(2);
        expect(res).toBe('[FILE:http://a][FILE:http://b]world');
    });

    it('trims text if prefix would make message too long', async () => {
        const spy = vi.spyOn(filesMod, 'uploadFile');
        spy.mockResolvedValue({ url: 'u' });
        const longText = 'a'.repeat(2000);
        const files = [createFile('a', 'x')];
        const res = await buildMessageWithFiles(longText, files);
        expect(res.length).toBeLessThanOrEqual(1023);
        expect(res.startsWith('[FILE:u]')).toBe(true);
    });
});