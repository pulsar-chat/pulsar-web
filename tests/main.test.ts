import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildMessageWithFiles } from '../src/main';
import * as filesMod from '../src/files';
import {
    addFilesToAttachments,
    removeAttachment,
    updateTextareaPlaceholder,
    getAttachments,
    clearAttachments
} from '../src/main';

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

// --- attachment management tests ---

// helper to setup minimal DOM environment for attachment tests
function setupDom() {
    document.body.innerHTML = `
        <textarea class="chat__textarea"></textarea>
        <div id="chat-attachments"></div>
    `;
    const ui = require('../src/ui');
    ui.initUIElements();
}

describe('attachment management', () => {
    beforeEach(() => {
        setupDom();
        clearAttachments();
    });

    it('adding files updates placeholder and container', () => {
        const f1 = createFile('a.txt', 'x');
        addFilesToAttachments([f1]);
        expect(getAttachments().length).toBe(1);
        const textarea = document.querySelector('.chat__textarea') as HTMLTextAreaElement;
        expect(textarea.placeholder).toContain('Прикреплено файлов');
        const container = document.getElementById('chat-attachments');
        expect(container?.children.length).toBe(1);
    });

    it('removing files works correctly', () => {
        const f1 = createFile('a.txt', 'x');
        const f2 = createFile('b.txt', 'y');
        addFilesToAttachments([f1, f2]);
        expect(getAttachments().length).toBe(2);
        removeAttachment(0);
        expect(getAttachments().length).toBe(1);
        const textarea = document.querySelector('.chat__textarea') as HTMLTextAreaElement;
        expect(textarea.placeholder).toContain('Прикреплено файлов: 1');
        const container = document.getElementById('chat-attachments');
        expect(container?.children.length).toBe(1);
    });
});

