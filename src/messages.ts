import Message from "./message";
import { PulsarClient } from "./client";

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

        return messages;
    } catch (err) {
        console.error('Failed to fetch message history:', err);
        return [];
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
