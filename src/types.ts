import Message from "./message";

export type ContactType = 'user' | 'channel';

export interface Contact {
    name: string;
    contactType: ContactType;
    lastMessage?: string;
    lastTime?: number;
    lastSender?: string;
    unread?: number;
    description?: string;
    memberCount?: number;
}

export interface UserProfile {
    description?: string;
    email?: string;
    realName?: string;
    birthday?: number;
}

export interface AppState {
    currentChat: string;
    currentUser: string;
    contacts: Map<string, Contact>;
    messageHistory: Map<string, Message[]>;
    userProfile: UserProfile;
}

export const MAX_STORED_MESSAGES = 50;
