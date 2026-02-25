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
    clearUnread,
    getContactType,
    createChannelOnServer,
    joinChannelOnServer,
    leaveChannelOnServer
} from "./contacts";
import {
    fetchMessageHistoryFromServer,
    fetchUnreadMessagesFromServer,
    fetchMessageByIdFromServer,
    fetchLastMessageFromServer
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
    getContactSearchQuery,
    openViewProfileModal,
    closeViewProfileModal,
    optimizeMessagesDisplay
} from "./ui";
import { uploadFile } from './files';
import {
    loadUserProfileFromServer,
    saveProfileToServer,
    loadOtherUserProfileFromServer
} from "./profile";

initUIElements();

let currentChat: string = "@browser";
let currentUser: string = "@browser";
let cli: PulsarClient | null = null;
let contacts: Map<string, Contact> = new Map();
let messageHistory: Map<string, Message[]> = new Map();
let userProfile: UserProfile = {};
let savingTimeout: NodeJS.Timeout | null = null;

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

        updateChatTitle("Начните новый чат");
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
        const timestamp = msg.getTime();

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

        updateContactLastMessage(contacts, relevantChat, content, timestamp, sender);

        if (sender === currentChat || receiver === currentChat) {
            displayMessage(content, timestamp, sender === currentUser, sender);
            console.log(`Message from ${sender}: ${content}`);
        } else {
            incrementUnread(contacts, relevantChat);
        }

        updateContactsListUI(contacts, currentChat, selectContact, viewProfile);
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
                const type = getContactType(contactName);
                addContact(contacts, contactName, type);
            }

            // Загружаем последнее сообщение для каждого контакта
            try {
                const lastMsg = await fetchLastMessageFromServer(cli, contactName);
                if (lastMsg) {
                    updateContactLastMessage(contacts, contactName, lastMsg.getContent(), lastMsg.getTime(), lastMsg.getSender());
                }
            } catch (err) {
                console.warn(`Failed to load last message for ${contactName}:`, err);
            }
        }

        updateContactsListUI(contacts, currentChat, selectContact, viewProfile);
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

        updateContactsListUI(contacts, currentChat, selectContact, viewProfile);
    } catch (err) {
        console.error('Failed to handle unread messages:', err);
    }
}

function updateChatContactInfo(contactName: string): void {
    const contactInfoEl = document.getElementById('chat-contact-info');
    if (!contactInfoEl) return;

    const avatar = contactInfoEl.querySelector('.chat__contact-avatar') as HTMLElement;
    const name = contactInfoEl.querySelector('.chat__contact-name') as HTMLElement;

    if (avatar) {
        // Для каналов показываем #, для пользователей - вторую букву имени
        if (contactName.startsWith(':')) {
            avatar.textContent = '#';
        } else {
            avatar.textContent = contactName.charAt(1) || '@';
        }
    }
    if (name) {
        name.textContent = contactName;
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
                displayMessage(msg.getContent(), msg.getTime(), isOwn, msg.getSender());
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
            displayMessage(msg.getContent(), msg.getTime(), isOwn, msg.getSender());
        }
    }

    clearUnread(contacts, contactName);

    updateContactsListUI(contacts, currentChat, selectContact, viewProfile);
    updateChatTitle(contactName);
    updateChatContactInfo(contactName);
    focusTextarea();
    
    // Оптимизируем отображение на мобильных устройствах
    optimizeMessagesDisplay();
}

async function viewProfile(contactName: string): Promise<void> {
    if (!cli) return;

    try {
        const profile = await loadOtherUserProfileFromServer(cli, contactName);
        openViewProfileModal(contactName, profile);
    } catch (err) {
        console.error('Failed to load profile:', err);
        updateChatTitle('Ошибка загрузки профиля');
    }
}

async function startNewChat(username: string): Promise<void> {
    if (!username || (!username.startsWith('@') && !username.startsWith(':'))) {
        updateChatTitle('Имя должно начинаться с @ или :');
        return;
    }

    if (username === currentUser) {
        updateChatTitle('Нельзя написать самому себе');
        return;
    }

    if (!contacts.has(username)) {
        const type = getContactType(username);
        addContact(contacts, username, type);

        // Пытаемся загрузить последнее сообщение
        if (cli) {
            try {
                const lastMsg = await fetchLastMessageFromServer(cli, username);
                if (lastMsg) {
                    updateContactLastMessage(contacts, username, lastMsg.getContent(), lastMsg.getTime(), lastMsg.getSender());
                }
            } catch (err) {
                console.warn(`Failed to load last message for ${username}:`, err);
            }
        }
    }

    clearNewChatUsername();

    await selectContact(username);
    saveChatDataWithDelay();
}

async function addContactViaServer(contactName: string): Promise<void> {
    if (!cli) {
        updateChatTitle('Клиент не инициализирован');
        return;
    }

    if (!contactName || (!contactName.startsWith('@') && !contactName.startsWith(':'))) {
        updateChatTitle('Имя должно начинаться с @ или :');
        return;
    }

    if (contactName === currentUser) {
        updateChatTitle('Нельзя добавить самого себя');
        return;
    }

    try {
        const isChannel = contactName.startsWith(':');
        let success = false;

        if (isChannel) {
            // Для каналов: присоединяемся к каналу
            success = await joinChannelOnServer(cli, contactName);
        } else {
            // Для пользователей: добавляем контакт
            success = await addContactToServer(cli, contactName);
        }

        if (success) {
            const type = getContactType(contactName);
            addContact(contacts, contactName, type);

            // Загружаем последнее сообщение
            try {
                const lastMsg = await fetchLastMessageFromServer(cli, contactName);
                if (lastMsg) {
                    updateContactLastMessage(contacts, contactName, lastMsg.getContent(), lastMsg.getTime(), lastMsg.getSender());
                }
            } catch (err) {
                console.warn(`Failed to load last message for ${contactName}:`, err);
            }

            updateContactsListUI(contacts, currentChat, selectContact, viewProfile);
            saveChatDataWithDelay();
            updateChatTitle(`${isChannel ? 'Канал' : 'Контакт'} ${contactName} добавлен!`);
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
                    displayMessage("Автовход выполнен!", Math.floor(Date.now() / 1000), true);

                    // Open menu on mobile devices
                    if (window.innerWidth <= 768) {
                        openMobileMenu();
                    }

                    if (originalOnOpen) {
                        await originalOnOpen();
                    }
                } else {
                    console.warn('Auto-login failed:', loginRsp);
                    deleteCookie('pulsar_user');
                    deleteCookie('pulsar_pass');
                    if (cli) cli.disconnect();
                    displayMessage("Сеанс истек. Пожалуйста, войдите снова.", Math.floor(Date.now() / 1000), false);
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

// when the user picks files we adjust the input placeholder so they know attachments are pending
const fileInputElement = document.getElementById('fileInput') as HTMLInputElement | null;
if (fileInputElement && textarea) {
    fileInputElement.addEventListener('change', () => {
        const count = fileInputElement.files ? fileInputElement.files.length : 0;
        textarea.placeholder = count > 0 ? `Прикреплено файлов: ${count}` : 'Напишите сообщение...';
    });
}

// exposed for testing
export async function buildMessageWithFiles(text: string, files: File[]): Promise<string> {
    let prefix = '';
    for (const file of files) {
        const result = await uploadFile(file);
        if (result && typeof result.url === 'string') {
            prefix += `[FILE:${result.url}]`;
        }
    }
    // make sure we don't exceed 1023 characters total; trim the text portion if necessary
    const maxMsgLen = 1023;
    if (prefix.length + text.length > maxMsgLen) {
        text = text.slice(0, maxMsgLen - prefix.length);
    }
    return prefix + text;
}

if (sendBtn && textarea) {
    sendBtn.addEventListener('click', async () => {
        const raw = getTextareaValue().trim().slice(0, 1023);
        const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;
        const files: File[] = fileInput && fileInput.files ? Array.from(fileInput.files) : [];
        // don't send empty message unless there are files attached
        if (!raw && files.length === 0) return;
        if (!cli) return;

        try {
            const message = await buildMessageWithFiles(raw, files);
            cli.send(message, currentChat);

            const msg = new Message(
                0,
                message,
                currentChat,
                currentUser,
                Math.floor(Date.now() / 1000)
            );
            addMessageToHistory(messageHistory, currentChat, msg);

            displayMessage(message, Math.floor(Date.now() / 1000), true);
            clearTextarea();
            focusTextarea();
            if (fileInput) {
                fileInput.value = '';
                // restore textarea placeholder after attachments cleared
                if (textarea) textarea.placeholder = 'Напишите сообщение...';
            }

            saveChatDataWithDelay();
        } catch (err) {
            console.error('Send error:', err);
            displayMessage(`Ошибка: ${err}`, Math.floor(Date.now() / 1000), false);
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
        updateContactsListUI(contacts, currentChat, selectContact, viewProfile);
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

const viewProfileModal = getUIElement('viewProfileModal');
const viewProfileModalClose = getUIElement('viewProfileModalClose');
const viewProfileCloseBtn = getUIElement('viewProfileCloseBtn');

if (viewProfileModalClose) {
    viewProfileModalClose.addEventListener('click', closeViewProfileModal);
}

if (viewProfileCloseBtn) {
    viewProfileCloseBtn.addEventListener('click', closeViewProfileModal);
}

if (viewProfileModal) {
    viewProfileModal.addEventListener('click', (e) => {
        if (e.target === viewProfileModal) {
            closeViewProfileModal();
        }
    });
}

const clockModule = getUIElement('clockModule');

function updateClocks() {
    const helper = () => {
        if (!clockModule) return;

        clockModule.innerText = new Date().toLocaleTimeString();
    };

    helper();

    setInterval(helper, 1000);
}

// Mobile menu toggle functionality
function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (sidebar && overlay) {
        const isActive = sidebar.classList.contains('sidebar--active');
        if (isActive) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    }
}

function openMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (sidebar) sidebar.classList.add('sidebar--active');
    if (overlay) overlay.classList.add('sidebar__overlay--active');
    document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (sidebar) sidebar.classList.remove('sidebar--active');
    if (overlay) overlay.classList.remove('sidebar__overlay--active');
    document.body.style.overflow = '';
}

const menuToggle = document.getElementById('menu-toggle');
const sidebarOverlay = document.getElementById('sidebar-overlay');

if (menuToggle) {
    menuToggle.addEventListener('click', toggleMobileMenu);
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeMobileMenu);
}

// Close menu when a contact is clicked or action buttons are used
document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    
    // Close menu when selecting a contact
    const contact = target.closest('.contact');
    if (contact) {
        closeMobileMenu();
        return;
    }
    
    // Close menu when logout button is clicked
    if (target.id === 'logout-btn') {
        closeMobileMenu();
        return;
    }

    // Open profile when clicking on chat contact info in header
    const chatContactInfo = target.closest('#chat-contact-info');
    if (chatContactInfo && currentChat) {
        viewProfile(currentChat);
        return;
    }
});

console.log("Pulsar Web Client initialized");
handleAutoLogin();
updateClocks();