export function setCookie(name: string, value: string, days = 30) {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = "expires=" + d.toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; ${expires}; path=/`;
}

export function getCookie(name: string): string | null {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let c of ca) {
        c = c.trim();
        if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length));
    }
    return null;
}

export function deleteCookie(name: string) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
}

export const f = () => {}