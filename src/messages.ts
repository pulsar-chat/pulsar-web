import Message from "./message";
import { PulsarClient } from "./client";

/**
 * Запрашивает историю сообщений с сервера
 * Использует команду !chat <chat> <lines>
 */
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

        // Сервер возвращает сообщения разделённые Unit-separator (ascii 31 = "\u001F")
        // или Unit/Record separators — пытаемся аккуратно распарсить
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

        return messages;
    } catch (err) {
        console.error('Failed to fetch message history:', err);
        return [];
    }
}

/**
 * Добавляет сообщение в локальную историю
 */
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

/**
 * Получает историю сообщений для контакта
 */
export function getMessageHistory(
    messageHistory: Map<string, Message[]>,
    contactName: string
): Message[] {
    return messageHistory.get(contactName) || [];
}

/**
 * Удаляет старые сообщения если превышен лимит
 */
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

/**
 * Очищает историю сообщений для контакта
 */
export function clearContactHistory(
    messageHistory: Map<string, Message[]>,
    contactName: string
): void {
    messageHistory.delete(contactName);
}

/**
 * Очищает всю историю сообщений
 */
export function clearAllHistory(messageHistory: Map<string, Message[]>): void {
    messageHistory.clear();
}
