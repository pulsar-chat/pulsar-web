import PulsarWebSocket from "./websocket/pulsar";
import Message from "./message";
import { PulsarClient } from "./client";
import { getCookie, deleteCookie, setCookie } from "./cookie";
import { PULSAR_URL } from "./config";

// Type definitions
interface Contact {
    name: string;
    lastMessage?: string;
    lastTime?: number;
    unread?: number;
}

interface UserProfile {
    description?: string;
    email?: string;
    realName?: string;
    birthday?: number;
}

// UI Elements
const messagesContainer = document.getElementById('messages');
const textarea = document.querySelector('.chat__textarea') as HTMLTextAreaElement;
const sendBtn = document.querySelector('.chat__send') as HTMLButtonElement;
const chatTitle = document.querySelector('.chat__title') as HTMLDivElement;
const contactsList = document.getElementById('contacts-list') as HTMLDivElement;
const profileBtn = document.getElementById('profile-btn') as HTMLDivElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;
const profileModal = document.getElementById('profile-modal') as HTMLDivElement;
const profileModalClose = document.getElementById('profile-modal-close') as HTMLButtonElement;
const profileSaveBtn = document.getElementById('profile-save') as HTMLButtonElement;
const profileCancelBtn = document.getElementById('profile-cancel') as HTMLButtonElement;
const profileName = document.getElementById('profile-name') as HTMLDivElement;
const contactSearch = document.getElementById('contact-search') as HTMLInputElement;
const newChatUsername = document.getElementById('new-chat-username') as HTMLInputElement;
const newChatBtn = document.getElementById('new-chat-btn') as HTMLButtonElement;

// State
let currentChat: string = "@browser";
let currentUser: string = "@browser";
let cli: PulsarClient | null = null;
let contacts: Map<string, Contact> = new Map();
let messageHistory: Map<string, Message[]> = new Map();
let userProfile: UserProfile = {};

// Initialize client
function initClient(username: string) {
    cli = new PulsarClient(username, PULSAR_URL);
    currentUser = username;

    cli.connect();

    cli.onOpen = async () => {
        console.log("Connected to server!");
        updateUI("Подключено!");
        
        const rsp = await cli!.requestRaw("!ping");
        console.log(`Ping response: ${rsp}`);
        
        // Load saved chat data from storage
        loadChatData();
        
        // Load user profile
        loadUserProfile();
        
        // Load contacts list
        loadContacts();
    };

    cli.onClose = () => {
        updateUI("Отключено");
        console.log("Disconnected from server");
    };

    cli.onError = (ev) => {
        console.error("Connection error:", ev);
        updateUI("Ошибка подключения");
    };

    cli.onMessage = (msg: Message) => {
        const sender = msg.getSender();
        const receiver = msg.getReciever();
        const content = msg.getContent();

        // Handle server responses
        if (sender === "!server.msg") {
            console.log("Server response:", content);
            return;
        }

        // Handle error messages
        if (sender === "!server.error") {
            console.error("Server error:", content);
            updateUI(`Ошибка: ${content}`);
            return;
        }

        // Display regular messages
        const relevantChat = sender === currentUser ? receiver : sender;
        
        // Store in history
        if (!messageHistory.has(relevantChat)) {
            messageHistory.set(relevantChat, []);
        }
        messageHistory.get(relevantChat)!.push(msg);
        
        // Update contact last message
        if (contacts.has(relevantChat)) {
            const contact = contacts.get(relevantChat)!;
            contact.lastMessage = content;
            contact.lastTime = Math.floor(Date.now() / 1000);
        }

        // Display if in this chat
        if (sender === currentChat || receiver === currentChat) {
            displayMessage(content, sender === currentUser);
            console.log(`Message from ${sender}: ${content}`);
        } else {
            // Mark as unread
            if (contacts.has(relevantChat)) {
                const contact = contacts.get(relevantChat)!;
                contact.unread = (contact.unread || 0) + 1;
            }
            updateContactsList();
        }
        
        // Save chat data after any message
        saveChatData();
    };
}

function displayMessage(content: string, isOwn: boolean = false) {
    if (!messagesContainer) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${isOwn ? 'msg--right' : 'msg--left'}`;

    const timestamp = new Date().toLocaleTimeString();
    const msgBubble = document.createElement('div');
    msgBubble.className = 'msg__bubble';
    msgBubble.innerHTML = `${escapeHtml(content)}<br><span class="msg__time">${timestamp}</span>`;

    msgDiv.appendChild(msgBubble);
    messagesContainer.appendChild(msgDiv);

    // Auto-scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function updateUI(status: string) {
    if (chatTitle) {
        chatTitle.textContent = status;
    }
}

function escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Storage functions
function saveChatData() {
    // Save contacts
    const contactsData = Array.from(contacts.entries()).map(([name, contact]) => ({
        name,
        lastMessage: contact.lastMessage,
        lastTime: contact.lastTime,
        unread: contact.unread
    }));
    localStorage.setItem('pulsar_contacts', JSON.stringify(contactsData));
    
    // Save message history
    const historyData = Array.from(messageHistory.entries()).map(([chat, messages]) => ({
        chat,
        messages: messages.map(msg => ({
            content: msg.getContent(),
            receiver: msg.getReciever(),
            sender: msg.getSender()
        }))
    }));
    localStorage.setItem('pulsar_message_history', JSON.stringify(historyData));
}

function loadChatData() {
    // Load contacts
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
    
    // Load message history
    const historyJson = localStorage.getItem('pulsar_message_history');
    if (historyJson) {
        try {
            const historyData = JSON.parse(historyJson);
            for (const item of historyData) {
                const messages: Message[] = [];
                for (const msgData of item.messages) {
                    // Create Message with current timestamp (0 means it's a new id)
                    const msg = new Message(
                        0,
                        msgData.content,
                        msgData.receiver,
                        msgData.sender,
                        Math.floor(Date.now() / 1000)
                    );
                    messages.push(msg);
                }
                messageHistory.set(item.chat, messages);
            }
        } catch (e) {
            console.error('Failed to load message history from storage:', e);
        }
    }
}

// Load contacts from server
async function loadContacts() {
    if (!cli) return;
    
    try {
        const rsp = await cli.requestRaw("!contact list");
        
        if (rsp && rsp !== '-') {
            // Parse contacts list (comma-separated)
            const contactNames = rsp.split(',').map(n => n.trim()).filter(n => n);
            
            for (const name of contactNames) {
                if (!contacts.has(name)) {
                    contacts.set(name, { name });
                }
            }
        }
        
        updateContactsList();
    } catch (err) {
        console.error('Failed to load contacts:', err);
    }
}

// Load user profile from server
async function loadUserProfile() {
    if (!cli) return;
    
    try {
        const rsp = await cli.requestRaw("!profile get");
        
        if (rsp && rsp !== '-') {
            // Parse profile format: description \x1D email \x1D realName \x1D birthday
            const fields = rsp.split('\u001D');
            if (fields[0]) userProfile.description = fields[0];
            if (fields[1]) userProfile.email = fields[1];
            if (fields[2]) userProfile.realName = fields[2];
            if (fields[3]) userProfile.birthday = parseInt(fields[3]);
        }
    } catch (err) {
        console.error('Failed to load profile:', err);
    }
}

// Update contacts list UI
function updateContactsList() {
    if (!contactsList) return;
    
    const searchQuery = contactSearch?.value.toLowerCase() || '';
    
    let html = '';
    const sortedContacts = Array.from(contacts.values())
        .filter(c => c.name.toLowerCase().includes(searchQuery))
        .sort((a, b) => (b.lastTime || 0) - (a.lastTime || 0));
    
    for (const contact of sortedContacts) {
        const isActive = contact.name === currentChat ? ' contact--active' : '';
        const lastMsg = contact.lastMessage || 'Нет сообщений';
        const unreadBadge = contact.unread ? `<span class="contact__badge">${contact.unread}</span>` : '';
        
        html += `
            <div class="contact${isActive}" data-contact="${contact.name}">
                <div class="contact__avatar">${contact.name[1] || '@'}</div>
                <div class="contact__meta">
                    <div class="contact__name">${escapeHtml(contact.name)}</div>
                    <div class="contact__last">${escapeHtml(lastMsg.substring(0, 30))}</div>
                </div>
                ${unreadBadge}
            </div>
        `;
    }
    
    if (sortedContacts.length === 0) {
        html = '<div style="padding: 20px; text-align: center; color: var(--color-text-muted);">Нет контактов</div>';
    }
    
    contactsList.innerHTML = html;
    
    // Save chat data when list updates
    saveChatData();
    
    // Add click handlers
    const contactElements = contactsList.querySelectorAll('.contact');
    contactElements.forEach(el => {
        el.addEventListener('click', () => {
            const contactName = el.getAttribute('data-contact');
            if (contactName) {
                selectContact(contactName);
            }
        });
    });
}

// Select a contact
function selectContact(contactName: string) {
    currentChat = contactName;
    
    // Clear and load message history
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
    }
    
    // Load messages for this contact
    const msgs = messageHistory.get(contactName) || [];
    for (const msg of msgs) {
        const isOwn = msg.getSender() === currentUser;
        displayMessage(msg.getContent(), isOwn);
    }
    
    // Clear unread count
    if (contacts.has(contactName)) {
        contacts.get(contactName)!.unread = 0;
    }
    
    updateContactsList();
    updateUI(contactName);
    
    if (textarea) {
        textarea.focus();
    }
}

// Start new chat with username
function startNewChat(username: string) {
    // Validate username
    if (!username || !username.startsWith('@')) {
        updateUI('Имя должно начинаться с @');
        return;
    }
    
    if (username === currentUser) {
        updateUI('Нельзя написать самому себе');
        return;
    }
    
    // Add to contacts if not exists
    if (!contacts.has(username)) {
        contacts.set(username, { name: username });
    }
    
    // Clear input
    if (newChatUsername) {
        newChatUsername.value = '';
    }
    
    // Select this contact
    selectContact(username);
    updateUI(`Чат с ${username}`);
    
    // Save chat data
    saveChatData();
}

// Profile modal functions
function openProfileModal() {
    if (!profileModal) return;
    
    // Fill in current profile data
    const usernameInput = document.getElementById('profile-username') as HTMLInputElement;
    const emailInput = document.getElementById('profile-email') as HTMLInputElement;
    const realnameInput = document.getElementById('profile-realname') as HTMLInputElement;
    const descriptionInput = document.getElementById('profile-description') as HTMLTextAreaElement;
    const birthdayInput = document.getElementById('profile-birthday') as HTMLInputElement;
    
    if (usernameInput) usernameInput.value = currentUser;
    if (emailInput) emailInput.value = userProfile.email || '';
    if (realnameInput) realnameInput.value = userProfile.realName || '';
    if (descriptionInput) descriptionInput.value = userProfile.description || '';
    if (birthdayInput) birthdayInput.value = (userProfile.birthday || '').toString();
    
    profileModal.classList.add('modal--active');
}

function closeProfileModal() {
    if (profileModal) {
        profileModal.classList.remove('modal--active');
    }
}

async function saveProfile() {
    if (!cli) return;
    
    const emailInput = document.getElementById('profile-email') as HTMLInputElement;
    const realnameInput = document.getElementById('profile-realname') as HTMLInputElement;
    const descriptionInput = document.getElementById('profile-description') as HTMLTextAreaElement;
    const birthdayInput = document.getElementById('profile-birthday') as HTMLInputElement;
    
    const profile = [
        descriptionInput?.value || '',
        emailInput?.value || '',
        realnameInput?.value || '',
        birthdayInput?.value || ''
    ].join('\u001D');
    
    try {
        const rsp = await cli.requestRaw(`!profile set ${profile}`);
        
        if (rsp === 'success') {
            userProfile.email = emailInput?.value;
            userProfile.realName = realnameInput?.value;
            userProfile.description = descriptionInput?.value;
            userProfile.birthday = birthdayInput?.value ? parseInt(birthdayInput.value) : undefined;
            
            closeProfileModal();
            updateUI('Профиль сохранен!');
        } else {
            console.error('Failed to save profile:', rsp);
        }
    } catch (err) {
        console.error('Profile save error:', err);
        updateUI('Ошибка сохранения профиля');
    }
}

// Handle login
async function handleAutoLogin() {
    const cookieUser = getCookie('pulsar_user');
    const cookiePass = getCookie('pulsar_pass');

    if (cookieUser && cookiePass) {
        initClient(cookieUser);
        cli!.onOpen = async () => {
            try {
                const loginReq = `!login ${cookieUser} ${cookiePass}`;
                const loginRsp = await cli!.requestRaw(loginReq);

                if (loginRsp === 'success') {
                    console.log('Auto-login successful:', cookieUser);
                    profileName.textContent = cookieUser;
                    updateUI(cookieUser);
                    displayMessage("Автовход выполнен!", true);
                } else {
                    console.warn('Auto-login failed:', loginRsp);
                    deleteCookie('pulsar_user');
                    deleteCookie('pulsar_pass');
                    displayMessage("Сеанс истек. Пожалуйста, войдите снова.", false);
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                }
            } catch (err) {
                console.warn('Auto-login error:', err);
                deleteCookie('pulsar_user');
                deleteCookie('pulsar_pass');
                window.location.href = '/login';
            }
        };
    } else {
        window.location.href = '/login';
    }
}

// Handle message sending
if (sendBtn && textarea) {
    sendBtn.addEventListener('click', async () => {
        const message = textarea.value.trim();
        if (!message || !cli) return;

        try {
            cli.send(message, currentChat);
            displayMessage(message, true);
            textarea.value = '';
            textarea.focus();
            
            // Save chat data when message is sent
            saveChatData();
        } catch (err) {
            console.error('Send error:', err);
            displayMessage(`Ошибка: ${err}`, false);
        }
    });

    // Send on Enter (Ctrl+Enter for new line)
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });
}

// Profile modal event listeners
if (profileBtn) {
    profileBtn.addEventListener('click', openProfileModal);
}

if (profileModalClose) {
    profileModalClose.addEventListener('click', closeProfileModal);
}

if (profileCancelBtn) {
    profileCancelBtn.addEventListener('click', closeProfileModal);
}

if (profileSaveBtn) {
    profileSaveBtn.addEventListener('click', saveProfile);
}

// Logout button
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

// Contact search
if (contactSearch) {
    contactSearch.addEventListener('input', () => {
        updateContactsList();
    });
}

// New chat
if (newChatBtn && newChatUsername) {
    newChatBtn.addEventListener('click', () => {
        const username = newChatUsername.value.trim();
        if (username) {
            startNewChat(username);
        }
    });
    
    newChatUsername.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const username = newChatUsername.value.trim();
            if (username) {
                startNewChat(username);
            }
        }
    });
}

// Close modal on outside click
if (profileModal) {
    profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) {
            closeProfileModal();
        }
    });
}

// Start the client
console.log("Pulsar Web Client initialized");
handleAutoLogin();