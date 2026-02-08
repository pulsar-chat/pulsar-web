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

function validateUsername(name: string): string | null {
    if (!name.startsWith('@')) return "Имя должно начинаться с @";
    if (name.length > 32) return "Имя не должно быть длиннее 32 символов";
    const forbidden = /[\s!#\$%\^&\*\(\)\-=\+\[\]{}`~'"<>\?,\.\/\\\|:;]/;
    if (forbidden.test(name)) return "Имя содержит недопустимые символы";
    const reserved = ['@admin', '@browser', '@server', '@all'];
    if (reserved.includes(name)) return "Это системное имя, выберите другое";
    return null;
}

function showMessage(msg: string, isError = false) {
    const el = document.getElementById('reg-message');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? 'crimson' : 'green';
}

window.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('reg-form') as HTMLFormElement | null;
    if (!form) return;

    const uname_html = document.getElementById('username') as HTMLInputElement;
    uname_html.addEventListener("input", () => {
        if (uname_html.value[0] !== '@') uname_html.value = `@${uname_html.value}`;
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showMessage('Регистрация...');

        const uname = (document.getElementById('username') as HTMLInputElement).value.trim();
        const pass = (document.getElementById('password') as HTMLInputElement).value;
        const pass2 = (document.getElementById('password2') as HTMLInputElement).value;

        const v = validateUsername(uname);
        if (v) {
            showMessage(v, true);
            return;
        }

        if (pass.length < 2) {
            showMessage('Пароль должен быть не менее 2 символов', true);
            return;
        }

        if (pass !== pass2) {
            showMessage('Пароли не совпадают', true);
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
                client.onError = (ev) => {
                    clearTimeout(t);
                    rej(new Error('WebSocket error'));
                };
            });

            const req = `!register ${uname} ${h}`;
            const rsp = await client.requestRaw(req);

            if (rsp === 'success') {
                setCookie('pulsar_user', uname, 30);
                setCookie('pulsar_pass', h, 30);
                showMessage('Регистрация успешна. Переадресация...');
                setTimeout(() => {
                    window.location.href = '/client';
                }, 800);
            } else {
                showMessage(`Ошибка регистрации: ${rsp}`, true);
            }
        } catch (err: any) {
            showMessage('Не удалось зарегистрироваться: ' + (err?.message || err), true);
        }
    });
});
