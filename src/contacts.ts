import { Contact } from "./types";
import { PulsarClient } from "./client";
import { getCookie } from "./cookie";

export async function fetchContactsFromServer(cli: PulsarClient): Promise<string[]> {
    try {
        const cookieUser = getCookie('pulsar_user') || '';
        const rsp = await cli.requestRaw(`!contact lst get`);

        if (rsp && rsp !== '-') {
            const parts = rsp.indexOf(' ') !== -1 ? rsp.split(' ') : [rsp];
            const contactNames = parts
                .map(n => n.trim())
                .filter(n => n && n.endsWith('.chat'))
                .map(n => n.slice(0, -5))
                .map(n => `@${n}`);
            return contactNames;
        }

        return [];
    } catch (err) {
        console.error('Failed to load contacts from server:', err);
        return [];
    }
}

/**
 * Добавляет новый контакт к списку контактов
 */
export function addContact(contacts: Map<string, Contact>, contactName: string, contactType: 'user' | 'channel' = 'user'): void {
    if (!contacts.has(contactName)) {
        contacts.set(contactName, { name: contactName, contactType });
    }
}

/**
 * Добавляет контакт на сервере
 */
export async function addContactToServer(
    cli: PulsarClient,
    contactName: string
): Promise<boolean> {
    try {
        // Второй аргумент — отображаемое имя контакта, передаём то же имя по умолчанию
        const rsp = await cli.requestRaw(`!contact add ${contactName} ${contactName}`);
        return rsp === 'success' || rsp === 'ok' || rsp === '+';
    } catch (err) {
        console.error('Failed to add contact to server:', err);
        return false;
    }
}

/**
 * Удаляет контакт с сервера
 */
export async function removeContactFromServer(
    cli: PulsarClient,
    contactName: string
): Promise<boolean> {
    try {
        // Используем короткую форму action `rem` согласно документации
        const rsp = await cli.requestRaw(`!contact rem ${contactName}`);
        return rsp === 'success' || rsp === 'ok' || rsp === '+';
    } catch (err) {
        console.error('Failed to remove contact from server:', err);
        return false;
    }
}

/**
 * Обновляет информацию о последнем сообщении контакта
 */
// strip out any [FILE:url] system tags so the contact list shows a readable summary
function sanitizeLastMessage(message: string): string {
    const stripped = message.replace(/\[FILE:[^\]]+\]/g, '').trim();
    return stripped || '📎 файл';
}

export function updateContactLastMessage(
    contacts: Map<string, Contact>,
    contactName: string,
    message: string,
    timestamp: number,
    sender?: string
): void {
    if (contacts.has(contactName)) {
        const contact = contacts.get(contactName)!;
        contact.lastMessage = sanitizeLastMessage(message);
        contact.lastTime = timestamp;
        if (sender) {
            contact.lastSender = sender;
        }
    }
}

/**
 * Увеличивает счетчик непрочитанных сообщений
 */
export function incrementUnread(
    contacts: Map<string, Contact>,
    contactName: string
): void {
    if (contacts.has(contactName)) {
        const contact = contacts.get(contactName)!;
        contact.unread = (contact.unread || 0) + 1;
    }
}

/**
 * Очищает счетчик непрочитанных сообщений
 */
export function clearUnread(
    contacts: Map<string, Contact>,
    contactName: string
): void {
    if (contacts.has(contactName)) {
        const contact = contacts.get(contactName)!;
        contact.unread = 0;
    }
}

/**
 * Сортирует контакты по времени последнего сообщения
 */
export function getSortedContacts(
    contacts: Map<string, Contact>,
    searchQuery: string = ''
): Contact[] {
    const query = searchQuery.toLowerCase();
    
    return Array.from(contacts.values())
        .filter(c => c.name.toLowerCase().includes(query))
        .sort((a, b) => (b.lastTime || 0) - (a.lastTime || 0));
}

/**
 * Определяет тип контакта по имени
 */
export function getContactType(contactName: string): 'user' | 'channel' {
    return contactName.startsWith(':') ? 'channel' : 'user';
}

/**
 * Создает канал на сервере
 */
export async function createChannelOnServer(
    cli: PulsarClient,
    channelName: string
): Promise<boolean> {
    try {
        const rsp = await cli.requestRaw(`!create ${channelName}`);
        return rsp === '+';
    } catch (err) {
        console.error('Failed to create channel:', err);
        return false;
    }
}

/**
 * Присоединяется к каналу на сервере
 */
export async function joinChannelOnServer(
    cli: PulsarClient,
    channelName: string
): Promise<boolean> {
    try {
        const rsp = await cli.requestRaw(`!join ${channelName}`);
        return rsp === '+';
    } catch (err) {
        console.error('Failed to join channel:', err);
        return false;
    }
}

/**
 * Выходит из канала на сервере
 */
export async function leaveChannelOnServer(
    cli: PulsarClient,
    channelName: string
): Promise<boolean> {
    try {
        const rsp = await cli.requestRaw(`!leave ${channelName}`);
        return rsp === '+';
    } catch (err) {
        console.error('Failed to leave channel:', err);
        return false;
    }
}

