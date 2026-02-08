import Message from "./message";
import { PulsarClient } from "./client";
import { getCookie, deleteCookie, setCookie } from "./cookie";
import { PULSAR_URL } from "./config";

// Import new modules
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

// Initialize UI first
initUIElements();

// Global state
let currentChat: string = "@browser";
let currentUser: string = "@browser";
let cli: PulsarClient | null = null;
let contacts: Map<string, Contact> = new Map();
let messageHistory: Map<string, Message[]> = new Map();
let userProfile: UserProfile = {};
let savingTimeout: number | null = null;

/**
 * Сохраняет данные чата с задержкой (избегает частого сохранения)
 */
function saveChatDataWithDelay(): void {
    if (savingTimeout) {
        clearTimeout(savingTimeout);
    }
    
    savingTimeout = setTimeout(() => {
        saveContactsToStorage(contacts);
        saveMessagesToStorage(messageHistory);
        pruneMessageHistory(messageHistory);
        savingTimeout = null;
    }, 1000); // Сохраняем через 1 секунду после последнего изменения
}

/**
 * Инициализирует клиент Pulsar
 */
function initClient(username: string, connectNow: boolean = true) {
    cli = new PulsarClient(username, PULSAR_URL);
    currentUser = username;

    // Assign client event handlers BEFORE connecting to avoid race conditions
    cli.onOpen = async () => {
        console.log("Connected to server!");
        updateChatTitle("Подключено!");

        try {
            const rsp = await cli!.requestRaw("!ping");
            console.log(`Ping response: ${rsp}`);
        } catch (err) {
            console.warn('Ping failed:', err);
        }

        // Загружаем сохраненные данные чата
        contacts = loadContactsFromStorage();
        messageHistory = loadMessagesFromStorage();

        // Загружаем список контактов с сервера
        await loadContacts();

        // Загружаем профиль пользователя
        if (cli) {
            userProfile = await loadUserProfileFromServer(cli);
        }
        updateProfileName(currentUser);

        // Показываем первый контакт или системное сообщение
        if (contacts.size > 0) {
            const firstContact = Array.from(contacts.values())[0];
            selectContact(firstContact.name);
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

        // Обрабатываем ответы сервера
        if (sender === "!server.msg") {
            console.log("Server response:", content);
            return;
        }

        // Обрабатываем ошибки сервера
        if (sender === "!server.error") {
            console.error("Server error:", content);
            updateChatTitle(`Ошибка: ${content}`);
            return;
        }

        // Определяем контакт
        const relevantChat = sender === currentUser ? receiver : sender;
        
        // Автоматически добавляем контакт, если его еще нет (ИСПРАВЛЕНИЕ БАГА)
        if (!contacts.has(relevantChat)) {
            addContact(contacts, relevantChat);
            console.log(`Added new contact: ${relevantChat}`);
        }
        
        // Сохраняем в историю
        addMessageToHistory(messageHistory, relevantChat, msg);
        
        // Обновляем информацию контакта
        updateContactLastMessage(contacts, relevantChat, content, msg.getTime());

        // Отображаем сообщение если оно в текущем чате
        if (sender === currentChat || receiver === currentChat) {
            displayMessage(content, sender === currentUser);
            console.log(`Message from ${sender}: ${content}`);
        } else {
            // Помечаем как непрочитанное
            incrementUnread(contacts, relevantChat);
        }
        
        // Обновляем UI и сохраняем
        updateContactsListUI(contacts, currentChat, selectContact);
        saveChatDataWithDelay();
    };

    if (connectNow) {
        cli.connect();
    }
}

/**
 * Загружает контакты с сервера и объединяет с локальными
 */
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
 * Выбирает контакт и отображает его историю
 */
function selectContact(contactName: string): void {
    currentChat = contactName;
    
    // Очищаем UI сообщений
    clearMessagesUI();
    
    // Загружаем и отображаем историю сообщений
    const msgs = messageHistory.get(contactName) || [];
    for (const msg of msgs) {
        const isOwn = msg.getSender() === currentUser;
        displayMessage(msg.getContent(), isOwn);
    }
    
    // Очищаем счетчик непрочитанных
    clearUnread(contacts, contactName);
    
    // Обновляем UI
    updateContactsListUI(contacts, currentChat, selectContact);
    updateChatTitle(contactName);
    focusTextarea();
}

/**
 * Начинает новый чат с указанным пользователем
 */
function startNewChat(username: string): void {
    // Валидируем имя пользователя
    if (!username || !username.startsWith('@')) {
        updateChatTitle('Имя должно начинаться с @');
        return;
    }
    
    if (username === currentUser) {
        updateChatTitle('Нельзя написать самому себе');
        return;
    }
    
    // Добавляем в контакты если еще нет
    if (!contacts.has(username)) {
        addContact(contacts, username);
    }
    
    // Очищаем поле ввода
    clearNewChatUsername();
    
    // Выбираем контакт
    selectContact(username);
    saveChatDataWithDelay();
}

/**
 * Добавляет контакт на сервер
 */
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

/**
 * Обработчик авто-входа
 */
async function handleAutoLogin() {
    const cookieUser = getCookie('pulsar_user');
    const cookiePass = getCookie('pulsar_pass');

    if (cookieUser && cookiePass) {
        // Initialize client but don't connect yet — we'll attach auto-login wrapper first
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

                    // Вызываем оригинальный обработчик, если есть
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

        // Now connect after wrapper is in place
        cli!.connect();
    } else {
        window.location.href = '/login';
    }
}

/**
 * Обработчик сохранения профиля
 */
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

/**
 * События и обработчики
 */

// Отправка сообщений
const sendBtn = getUIElement('sendBtn');
const textarea = getUIElement('textarea');

if (sendBtn && textarea) {
    sendBtn.addEventListener('click', async () => {
        const message = getTextareaValue();
        if (!message || !cli) return;

        try {
            cli.send(message, currentChat);
            
            // Добавляем сообщение в историю
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

    // Отправка при Enter (Shift+Enter для новой строки)
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });
}

// Профиль
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

// Выход
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

// Поиск контактов
const contactSearch = getUIElement('contactSearch');
if (contactSearch) {
    contactSearch.addEventListener('input', () => {
        updateContactsListUI(contacts, currentChat, selectContact);
    });
}

// Новый чат
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

// Закрытие модального окна профиля при клике вне
const profileModal = getUIElement('profileModal');
if (profileModal) {
    profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) {
            closeProfileModal();
        }
    });
}

/**
 * Инициализация приложения
 */
console.log("Pulsar Web Client initialized");
handleAutoLogin();
