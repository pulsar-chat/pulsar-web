import Message from "./message";
import { Contact, MAX_STORED_MESSAGES } from "./types";

export function saveContactsToStorage(contacts: Map<string, Contact>): void {
    const contactsData = Array.from(contacts.entries()).map(([name, contact]) => ({
        name,
        lastMessage: contact.lastMessage,
        lastTime: contact.lastTime,
        unread: contact.unread
    }));
    localStorage.setItem('pulsar_contacts', JSON.stringify(contactsData));
}

export function loadContactsFromStorage(): Map<string, Contact> {
    const contacts = new Map<string, Contact>();
    const contactsJson = localStorage.getItem('pulsar_contacts');
    
    if (contactsJson) {
        try {
            const contactsData = JSON.parse(contactsJson);
            for (const contact of contactsData) {
                contacts.set(contact.name, {
                    name: contact.name,
                    lastMessage: contact.lastMessage,
                    lastTime: contact.lastTime,
                    unread: contact.unread
                });
            }
        } catch (e) {
            console.error('Failed to load contacts from storage:', e);
        }
    }
    
    return contacts;
}

export function saveMessagesToStorage(messageHistory: Map<string, Message[]>): void {
    const historyData = Array.from(messageHistory.entries()).map(([chat, messages]) => ({
        chat,
        messages: messages.slice(-MAX_STORED_MESSAGES).map(msg => ({
            content: msg.getContent(),
            receiver: msg.getReciever(),
            sender: msg.getSender(),
            timestamp: msg.getTime()
        }))
    }));
    localStorage.setItem('pulsar_message_history', JSON.stringify(historyData));
}

export function loadMessagesFromStorage(): Map<string, Message[]> {
    const messageHistory = new Map<string, Message[]>();
    const historyJson = localStorage.getItem('pulsar_message_history');
    
    if (historyJson) {
        try {
            const historyData = JSON.parse(historyJson);
            for (const item of historyData) {
                const messages: Message[] = [];
                for (const msgData of item.messages) {
                    const msg = new Message(
                        0,
                        msgData.content,
                        msgData.receiver,
                        msgData.sender,
                        msgData.timestamp /*|| Math.floor(Date.now() / 1000)*/
                    );
                    messages.push(msg);
                }
                messageHistory.set(item.chat, messages);
            }
        } catch (e) {
            console.error('Failed to load message history from storage:', e);
        }
    }
    
    return messageHistory;
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

export function pruneMessageHistory(messageHistory: Map<string, Message[]>): void {
    for (const [chat, messages] of messageHistory) {
        if (messages.length > MAX_STORED_MESSAGES) {
            messageHistory.set(chat, messages.slice(-MAX_STORED_MESSAGES));
        }
    }
}
