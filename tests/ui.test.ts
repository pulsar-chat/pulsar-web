import { describe, it, expect, beforeEach } from 'vitest';
import { displayMessage, initUIElements } from '../src/ui';

// setup a simple DOM container before each test
beforeEach(() => {
    document.body.innerHTML = '<div id="messages"></div>';
    initUIElements();
});

describe('UI message rendering', () => {
    it('renders plain text without modification', () => {
        displayMessage('hello world', 1600000000, false);
        const container = document.getElementById('messages')!;
        expect(container.textContent).toContain('hello world');
    });

    it('converts image file tags into <img> preview', () => {
        displayMessage('[FILE:http://example.com/photo.png]hi', 1600000000, false);
        const container = document.getElementById('messages')!;
        const img = container.querySelector('img') as HTMLImageElement;
        expect(img).toBeTruthy();
        expect(img.src).toBe('http://example.com/photo.png');
        expect(container.textContent).toContain('hi');
    });

    it('converts video file tags into <video> preview', () => {
        displayMessage('[FILE:http://example.com/movie.mp4]', 1600000000, false);
        const container = document.getElementById('messages')!;
        const vid = container.querySelector('video') as HTMLVideoElement;
        expect(vid).toBeTruthy();
        expect(vid.src).toBe('http://example.com/movie.mp4');
    });

    it('renders download link for unknown file types', () => {
        displayMessage('[FILE:http://example.com/archive.zip]', 1600000000, false);
        const container = document.getElementById('messages')!;
        const link = container.querySelector('a') as HTMLAnchorElement;
        expect(link).toBeTruthy();
        expect(link.getAttribute('href')).toBe('http://example.com/archive.zip');
    });
});