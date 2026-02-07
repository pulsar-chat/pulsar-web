import Message from "./message";

export interface Contact {
    name: string;
    lastMessage?: string;
    lastTime?: number;
    unread?: number;
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
