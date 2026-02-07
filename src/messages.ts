import Message from "./message";
import { PulsarClient } from "./client";

/**
 * Запрашивает историю сообщений с сервера
 * Использует команду !chat contactName startId endId
 */
export async function fetchMessageHistoryFromServer(
    cli: PulsarClient,
    contactName: string,
    startId: number = 0,
    endId?: number
): Promise<Message[]> {
    try {
        const cmd = endId 
            ? `!chat ${contactName} ${startId} ${endId}`
            : `!chat ${contactName} ${startId}`;
        
        const rsp = await cli.requestRaw(cmd);
        
        if (!rsp || rsp === '-') {
            return [];
        }
        
        // Парсим ответ - может быть несколько сообщений, разделенных специальным разделителем
        const messages: Message[] = [];
        
        // TODO: Реализовать парсинг в зависимости от формата сервера
        // Текущий формат неизвестен, нужно уточнить с документацией
        
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
