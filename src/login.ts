import { PulsarClient } from "./client";
import { PULSAR_URL } from "./config";
import { setCookie } from "./cookie";

async function sha256Hex(message: string): Promise<string> {
    const enc = new TextEncoder();
    const data = enc.encode(message);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const arr = Array.from(new Uint8Array(hash));
    return arr.map(b => b.toString(16).padStart(2, '0')).join('');
}

function showMessage(msg: string, isError = false) {
    const el = document.getElementById('login-message');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? 'crimson' : 'green';
}

window.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form') as HTMLFormElement | null;
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showMessage('Вход...');

        const uname = (document.getElementById('login-username') as HTMLInputElement).value.trim();
        const pass = (document.getElementById('login-password') as HTMLInputElement).value;

        if (!uname || !pass) {
            showMessage('Заполните все поля', true);
            return;
        }

        try {
            const h = await sha256Hex(pass);
            const client = new PulsarClient('@browser', PULSAR_URL);
            client.connect();

            await new Promise<void>((res, rej) => {
                const t = setTimeout(() => rej(new Error('timeout')), 3000);
                client.onOpen = () => {
                    clearTimeout(t);
                    res();
                };
                client.onError = () => {
                    clearTimeout(t);
                    rej(new Error('WebSocket error'));
                };
            });

            const req = `!login ${uname} ${h}`;
            const rsp = await client.requestRaw(req);

            if (rsp === 'success') {
                setCookie('pulsar_user', uname, 30);
                setCookie('pulsar_pass', h, 30);
                showMessage('Вход успешен. Переадресация...');
                setTimeout(() => {
                    window.location.href = '/client';
                }, 800);
            } else {
                showMessage(`Ошибка входа: ${rsp}`, true);
            }
        } catch (err: any) {
            showMessage('Не удалось войти: ' + (err?.message || err), true);
        }
    });
});