import Message from "./message";
import { PulsarClient } from "./client";
import { getCookie, deleteCookie, setCookie } from "./cookie";
import { PULSAR_URL } from "./config";
import { AppState, UserProfile, Contact, MAX_STORED_MESSAGES } from "./types";
import {
    loadContactsFromStorage,
    saveContactsToStorage,
    loadMessagesFromStorage,
    saveMessagesToStorage,
    pruneMessageHistory,
    addMessageToHistory
} from "./storage";
import {
    addContact,
    fetchContactsFromServer,
    addContactToServer,
    removeContactFromServer,
    updateContactLastMessage,
    incrementUnread,
    clearUnread
} from "./contacts";
import {
    fetchMessageHistoryFromServer,
    fetchUnreadMessagesFromServer,
    fetchMessageByIdFromServer
} from "./messages";
import {
    initUIElements,
    getUIElement,
    escapeHtml,
    displayMessage,
    updateChatTitle,
    clearMessagesUI,
    updateContactsListUI,
    openProfileModal,
    closeProfileModal,
    getProfileFormData,
    updateProfileName,
    focusTextarea,
    clearTextarea,
    getTextareaValue,
    getNewChatUsername,
    clearNewChatUsername,
    getContactSearchQuery
} from "./ui";
import {
    loadUserProfileFromServer,
    saveProfileToServer
} from "./profile";

initUIElements();

let currentChat: string = "@browser";
let currentUser: string = "@browser";
let cli: PulsarClient | null = null;
let contacts: Map<string, Contact> = new Map();
let messageHistory: Map<string, Message[]> = new Map();
let userProfile: UserProfile = {};
let savingTimeout: number | null = null;

function saveChatDataWithDelay(): void {
    if (savingTimeout) {
        clearTimeout(savingTimeout);
    }

    savingTimeout = setTimeout(() => {
        saveContactsToStorage(contacts);
        saveMessagesToStorage(messageHistory);
        pruneMessageHistory(messageHistory);
        savingTimeout = null;
    }, 1000);
}

function initClient(username: string, connectNow: boolean = true) {
    cli = new PulsarClient(username, PULSAR_URL);
    currentUser = username;

    cli.onOpen = async () => {
        console.log("Connected to server!");
        updateChatTitle("Подключено!");

        try {
            const rsp = await cli!.requestRaw("!ping");
            console.log(`Ping response: ${rsp}`);
        } catch (err) {
            console.warn('Ping failed:', err);
        }

        contacts = loadContactsFromStorage();
        messageHistory = loadMessagesFromStorage();

        await loadContacts();

        // Загружаем непрочитанные сообщения
        await handleUnreadMessages();

        if (cli) {
            userProfile = await loadUserProfileFromServer(cli);
        }
        updateProfileName(currentUser);

        if (contacts.size > 0) {
            const firstContact = Array.from(contacts.values())[0];
            await selectContact(firstContact.name);
        } else {
            updateChatTitle("Начните новый чат");
        }
    };

    cli.onClose = () => {
        updateChatTitle("Отключено");
        console.log("Disconnected from server");
    };

    cli.onError = (ev) => {
        console.error("Connection error:", ev);
        updateChatTitle("Ошибка подключения");
    };

    cli.onMessage = (msg: Message) => {
        const sender = msg.getSender();
        const receiver = msg.getReciever();
        const content = msg.getContent();

        if (sender === "!server.msg") {
            console.log("Server response:", content);
            return;
        }

        if (sender === "!server.error") {
            console.error("Server error:", content);
            updateChatTitle(`Ошибка: ${content}`);
            return;
        }

        const relevantChat = sender === currentUser ? receiver : sender;

        if (!contacts.has(relevantChat)) {
            addContact(contacts, relevantChat);
            console.log(`Added new contact: ${relevantChat}`);
        }

        addMessageToHistory(messageHistory, relevantChat, msg);

        updateContactLastMessage(contacts, relevantChat, content, msg.getTime());

        if (sender === currentChat || receiver === currentChat) {
            displayMessage(content, sender === currentUser);
            console.log(`Message from ${sender}: ${content}`);
        } else {
            incrementUnread(contacts, relevantChat);
        }

        updateContactsListUI(contacts, currentChat, selectContact);
        saveChatDataWithDelay();
    };

    if (connectNow) {
        cli.connect();
    }
}

async function loadContacts(): Promise<void> {
    if (!cli) return;

    try {
        const serverContacts = await fetchContactsFromServer(cli);

        for (const contactName of serverContacts) {
            if (!contacts.has(contactName)) {
                addContact(contacts, contactName);
            }
        }

        updateContactsListUI(contacts, currentChat, selectContact);
        saveChatDataWithDelay();
    } catch (err) {
        console.error('Failed to load contacts:', err);
    }
}

/**
 * Загружает непрочитанные сообщения и обновляет счетчики у контактов
 */
async function handleUnreadMessages(): Promise<void> {
    if (!cli) return;

    try {
        const unreadMessages = await fetchUnreadMessagesFromServer(cli);

        // Группируем по чатам
        const unreadByChat = new Map<string, number[]>();
        for (const unread of unreadMessages) {
            if (!unreadByChat.has(unread.chat)) {
                unreadByChat.set(unread.chat, []);
            }
            unreadByChat.get(unread.chat)!.push(unread.messageId);
        }

        // Обновляем счетчики для контактов
        for (const [chat, _] of unreadByChat) {
            incrementUnread(contacts, chat);
        }

        updateContactsListUI(contacts, currentChat, selectContact);
    } catch (err) {
        console.error('Failed to handle unread messages:', err);
    }
}

async function selectContact(contactName: string): Promise<void> {
    currentChat = contactName;

    clearMessagesUI();
    updateChatTitle(`Загрузка истории из ${contactName}...`);

    // Загружаем историю с сервера (последние 50 сообщений)
    if (cli) {
        try {
            const serverMessages = await fetchMessageHistoryFromServer(cli, contactName, 50);

            // Обновляем локального хранилища для кэширования
            if (serverMessages.length > 0) {
                messageHistory.set(contactName, serverMessages);
            }

            // Отображаем сообщения
            for (const msg of serverMessages) {
                const isOwn = msg.getSender() === currentUser;
                displayMessage(msg.getContent(), isOwn);
            }
        } catch (err) {
            console.error('Failed to load message history:', err);
            updateChatTitle(`Ошибка загрузки истории для ${contactName}`);
        }
    } else {
        // Если клиент не инициализирован, используем локальное кэширование
        const msgs = messageHistory.get(contactName) || [];
        // Разворачиваем для правильного порядка (старые сверху)
        const reversedMsgs = [...msgs].reverse();
        for (const msg of reversedMsgs) {
            const isOwn = msg.getSender() === currentUser;
            displayMessage(msg.getContent(), isOwn);
        }
    }

    clearUnread(contacts, contactName);

    updateContactsListUI(contacts, currentChat, selectContact);
    updateChatTitle(contactName);
    focusTextarea();
}

async function startNewChat(username: string): Promise<void> {
    if (!username || !username.startsWith('@')) {
        updateChatTitle('Имя должно начинаться с @');
        return;
    }

    if (username === currentUser) {
        updateChatTitle('Нельзя написать самому себе');
        return;
    }

    if (!contacts.has(username)) {
        addContact(contacts, username);
    }

    clearNewChatUsername();

    await selectContact(username);
    saveChatDataWithDelay();
}

async function addContactViaServer(username: string): Promise<void> {
    if (!cli) {
        updateChatTitle('Клиент не инициализирован');
        return;
    }

    if (!username || !username.startsWith('@')) {
        updateChatTitle('Имя должно начинаться с @');
        return;
    }

    if (username === currentUser) {
        updateChatTitle('Нельзя добавить самого себя');
        return;
    }

    try {
        const success = await addContactToServer(cli, username);
        if (success) {
            addContact(contacts, username);
            updateContactsListUI(contacts, currentChat, selectContact);
            saveChatDataWithDelay();
            updateChatTitle(`Контакт ${username} добавлен!`);
        } else {
            updateChatTitle(`Ошибка при добавлении контакта`);
        }
    } catch (err) {
        console.error('Failed to add contact:', err);
        updateChatTitle(`Ошибка: ${err}`);
    }
}

async function handleAutoLogin() {
    const cookieUser = getCookie('pulsar_user');
    const cookiePass = getCookie('pulsar_pass');

    if (cookieUser && cookiePass) {
        initClient(cookieUser, false);
        const originalOnOpen = cli!.onOpen;

        cli!.onOpen = async () => {
            try {
                const loginReq = `!login ${cookieUser} ${cookiePass}`;
                const loginRsp = await cli!.requestRaw(loginReq);

                if (loginRsp === 'success' || loginRsp === 'ok') {
                    console.log('Auto-login successful:', cookieUser);
                    updateProfileName(cookieUser);
                    updateChatTitle(cookieUser);
                    displayMessage("Автовход выполнен!", true);

                    if (originalOnOpen) {
                        await originalOnOpen();
                    }
                } else {
                    console.warn('Auto-login failed:', loginRsp);
                    deleteCookie('pulsar_user');
                    deleteCookie('pulsar_pass');
                    if (cli) cli.disconnect();
                    displayMessage("Сеанс истек. Пожалуйста, войдите снова.", false);
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                }
            } catch (err) {
                console.warn('Auto-login error:', err);
                deleteCookie('pulsar_user');
                deleteCookie('pulsar_pass');
                if (cli) cli.disconnect();
                window.location.href = '/login';
            }
        };

        cli!.connect();
    } else {
        window.location.href = '/login';
    }
}

async function handleSaveProfile() {
    if (!cli) return;

    const profileData = getProfileFormData();

    try {
        const success = await saveProfileToServer(cli, profileData);

        if (success) {
            userProfile.email = profileData.email;
            userProfile.realName = profileData.realName;
            userProfile.description = profileData.description;
            userProfile.birthday = profileData.birthday ? parseInt(profileData.birthday) : undefined;

            closeProfileModal();
            updateChatTitle('Профиль сохранен!');
        } else {
            console.error('Failed to save profile');
            updateChatTitle('Ошибка сохранения профиля');
        }
    } catch (err) {
        console.error('Profile save error:', err);
        updateChatTitle('Ошибка сохранения профиля');
    }
}

const sendBtn = getUIElement('sendBtn');
const textarea = getUIElement('textarea');

if (sendBtn && textarea) {
    sendBtn.addEventListener('click', async () => {
        const message = getTextareaValue();
        if (!message || !cli) return;

        try {
            cli.send(message, currentChat);

            const msg = new Message(
                0,
                message,
                currentChat,
                currentUser,
                Math.floor(Date.now() / 1000)
            );
            addMessageToHistory(messageHistory, currentChat, msg);

            displayMessage(message, true);
            clearTextarea();
            focusTextarea();

            saveChatDataWithDelay();
        } catch (err) {
            console.error('Send error:', err);
            displayMessage(`Ошибка: ${err}`, false);
        }
    });

    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendBtn.click();
        }
    });
}

const profileBtn = getUIElement('profileBtn');
const profileModalClose = getUIElement('profileModalClose');
const profileCancelBtn = getUIElement('profileCancelBtn');
const profileSaveBtn = getUIElement('profileSaveBtn');

if (profileBtn) {
    profileBtn.addEventListener('click', () => {
        openProfileModal(currentUser, userProfile);
    });
}

if (profileModalClose) {
    profileModalClose.addEventListener('click', closeProfileModal);
}

if (profileCancelBtn) {
    profileCancelBtn.addEventListener('click', closeProfileModal);
}

if (profileSaveBtn) {
    profileSaveBtn.addEventListener('click', handleSaveProfile);
}

const logoutBtn = getUIElement('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        deleteCookie('pulsar_user');
        deleteCookie('pulsar_pass');
        if (cli) {
            cli.disconnect();
        }
        window.location.href = '/login';
    });
}

const contactSearch = getUIElement('contactSearch');
if (contactSearch) {
    contactSearch.addEventListener('input', () => {
        updateContactsListUI(contacts, currentChat, selectContact);
    });
}

const newChatBtn = getUIElement('newChatBtn');
const newChatUsername = getUIElement('newChatUsername');

if (newChatBtn && newChatUsername) {
    newChatBtn.addEventListener('click', () => {
        const username = getNewChatUsername();
        if (username) {
            startNewChat(username);
        }
    });

    newChatUsername.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const username = getNewChatUsername();
            if (username) {
                startNewChat(username);
            }
        }
    });
}

const profileModal = getUIElement('profileModal');
if (profileModal) {
    profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) {
            closeProfileModal();
        }
    });
}

console.log("Pulsar Web Client initialized");
handleAutoLogin();
