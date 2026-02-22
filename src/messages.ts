import Message from "./message";
import { PulsarClient } from "./client";

export interface UnreadMessage {
    chat: string;
    messageId: number;
}

export async function fetchMessageHistoryFromServer(
    cli: PulsarClient,
    contactName: string,
    lines: number = 50
): Promise<Message[]> {
    try {
        const cmd = `!chat ${contactName} ${lines}`;
        const rsp = await cli.requestRaw(cmd);

        if (!rsp || rsp === '-') {
            return [];
        }

        const parts = rsp.split('\u001F');
        const messages: Message[] = [];

        for (const p of parts) {
            const trimmed = p.trim();
            if (!trimmed) continue;
            try {
                messages.push(Message.fromPayload(trimmed));
            } catch (e) {
                console.warn('Failed to parse message payload from server part:', e);
            }
        }

        // Разворачиваем сообщения (старые сверху, новые снизу)
        return messages.reverse();
    } catch (err) {
        console.error('Failed to fetch message history:', err);
        return [];
    }
}

/**
 * Получить список непрочитанных сообщений с сервера
 */
export async function fetchUnreadMessagesFromServer(
    cli: PulsarClient
): Promise<UnreadMessage[]> {
    try {
        const rsp = await cli.requestRaw('!getUnread');

        if (!rsp || rsp === '-') {
            return [];
        }

        const unreadMessages: UnreadMessage[] = [];
        const records = rsp.split(';');

        for (const record of records) {
            const trimmed = record.trim();
            if (!trimmed) continue;

            const parts = trimmed.split('|');
            if (parts.length === 2) {
                const chat = parts[0].trim();
                const messageId = parseInt(parts[1], 10);

                if (!isNaN(messageId)) {
                    unreadMessages.push({ chat, messageId });
                }
            }
        }

        return unreadMessages;
    } catch (err) {
        console.error('Failed to fetch unread messages:', err);
        return [];
    }
}

/**
 * Получить отдельное сообщение по ID
 */
export async function fetchMessageByIdFromServer(
    cli: PulsarClient,
    chat: string,
    messageId: number
): Promise<Message | null> {
    try {
        const cmd = `!msg ${chat} ${messageId}`;
        const rsp = await cli.requestRaw(cmd);

        if (!rsp || rsp === '-') {
            return null;
        }

        const msg = Message.fromPayload(rsp);
        return msg;
    } catch (err) {
        console.error('Failed to fetch message by ID:', err);
        return null;
    }
}
export function addMessageToHistory(
    messageHistory: Map<string, Message[]>,
    contactName: string,
    message: Message
): void {
    if (!messageHistory.has(contactName)) {
        messageHistory.set(contactName, []);
    }

    const messages = messageHistory.get(contactName)!;
    messages.push(message);
}

export function getMessageHistory(
    messageHistory: Map<string, Message[]>,
    contactName: string
): Message[] {
    return messageHistory.get(contactName) || [];
}

export function pruneOldMessages(
    messageHistory: Map<string, Message[]>,
    maxMessages: number = 50
): void {
    for (const [contactName, messages] of messageHistory) {
        if (messages.length > maxMessages) {
            messageHistory.set(contactName, messages.slice(-maxMessages));
        }
    }
}

export function clearContactHistory(
    messageHistory: Map<string, Message[]>,
    contactName: string
): void {
    messageHistory.delete(contactName);
}

export function clearAllHistory(messageHistory: Map<string, Message[]>): void {
    messageHistory.clear();
}

/**
 * Загружает только последнее сообщение у контакта
 */
export async function fetchLastMessageFromServer(
    cli: PulsarClient,
    contactName: string
): Promise<Message | null> {
    try {
        const cmd = `!chat ${contactName} 1`;
        const rsp = await cli.requestRaw(cmd);

        if (!rsp || rsp === '-') {
            return null;
        }

        const trimmed = rsp.trim();
        if (!trimmed) return null;

        const message = Message.fromPayload(trimmed);
        return message;
    } catch (err) {
        console.warn(`Failed to fetch last message for ${contactName}:`, err);
        return null;
    }
}
