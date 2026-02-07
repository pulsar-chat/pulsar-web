import { Contact } from "./types";
import { PulsarClient } from "./client";

/**
 * Получает список контактов с сервера
 */
export async function fetchContactsFromServer(cli: PulsarClient): Promise<string[]> {
    try {
        const rsp = await cli.requestRaw("!contact list");
        
        if (rsp && rsp !== '-') {
            // Парсим список контактов (разделенные запятой)
            const contactNames = rsp.split(',')
                .map(n => n.trim())
                .filter(n => n && n.startsWith('@'));
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
export function addContact(contacts: Map<string, Contact>, contactName: string): void {
    if (!contacts.has(contactName)) {
        contacts.set(contactName, { name: contactName });
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
        const rsp = await cli.requestRaw(`!contact add ${contactName}`);
        return rsp === 'success' || rsp === 'ok';
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
        const rsp = await cli.requestRaw(`!contact remove ${contactName}`);
        return rsp === 'success' || rsp === 'ok';
    } catch (err) {
        console.error('Failed to remove contact from server:', err);
        return false;
    }
}

/**
 * Обновляет информацию о последнем сообщении контакта
 */
export function updateContactLastMessage(
    contacts: Map<string, Contact>,
    contactName: string,
    message: string,
    timestamp: number
): void {
    if (contacts.has(contactName)) {
        const contact = contacts.get(contactName)!;
        contact.lastMessage = message;
        contact.lastTime = timestamp;
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
