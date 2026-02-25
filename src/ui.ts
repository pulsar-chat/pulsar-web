import { Contact, UserProfile } from "./types";
import { getSortedContacts } from "./contacts";
import { formatBirthday } from "./profile";

const uiElements = {
    messagesContainer: null as HTMLDivElement | null,
    textarea: null as HTMLTextAreaElement | null,
    sendBtn: null as HTMLButtonElement | null,
    attachmentsContainer: null as HTMLDivElement | null,
    chatTitle: null as HTMLDivElement | null,
    contactsList: null as HTMLDivElement | null,
    logoutBtn: null as HTMLButtonElement | null,
    profileModal: null as HTMLDivElement | null,
    profileModalClose: null as HTMLButtonElement | null,
    profileSaveBtn: null as HTMLButtonElement | null,
    profileCancelBtn: null as HTMLButtonElement | null,
    profileName: null as HTMLDivElement | null,
    contactSearch: null as HTMLInputElement | null,
    newChatUsername: null as HTMLInputElement | null,
    newChatBtn: null as HTMLButtonElement | null,
    clockModule: null as HTMLSpanElement | null,
    viewProfileModal: null as HTMLDivElement | null,
    viewProfileModalClose: null as HTMLButtonElement | null,
    viewProfileCloseBtn: null as HTMLButtonElement | null,
    viewProfileUsername: null as HTMLInputElement | null,
    viewProfileEmail: null as HTMLInputElement | null,
    viewProfileRealname: null as HTMLInputElement | null,
    viewProfileDescription: null as HTMLTextAreaElement | null,
    viewProfileBirthday: null as HTMLInputElement | null
};

export function initUIElements(): void {
    uiElements.messagesContainer = document.getElementById('messages') as HTMLDivElement;
    uiElements.textarea = document.querySelector('.chat__textarea') as HTMLTextAreaElement;
    uiElements.sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
    uiElements.attachmentsContainer = document.getElementById('chat-attachments') as HTMLDivElement;
    uiElements.chatTitle = document.querySelector('.chat__title') as HTMLDivElement;
    uiElements.contactsList = document.getElementById('contacts-list') as HTMLDivElement;
    uiElements.profileBtn = document.getElementById('profile-btn') as HTMLDivElement;
    uiElements.logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;
    uiElements.profileModal = document.getElementById('profile-modal') as HTMLDivElement;
    uiElements.profileModalClose = document.getElementById('profile-modal-close') as HTMLButtonElement;
    uiElements.profileSaveBtn = document.getElementById('profile-save') as HTMLButtonElement;
    uiElements.profileCancelBtn = document.getElementById('profile-cancel') as HTMLButtonElement;
    uiElements.profileName = document.getElementById('profile-name') as HTMLDivElement;
    uiElements.contactSearch = document.getElementById('contact-search') as HTMLInputElement;
    uiElements.newChatUsername = document.getElementById('new-chat-username') as HTMLInputElement;
    uiElements.newChatBtn = document.getElementById('new-chat-btn') as HTMLButtonElement;
    uiElements.clockModule = document.getElementById('clock-module') as HTMLSpanElement;
    uiElements.viewProfileModal = document.getElementById('view-profile-modal') as HTMLDivElement;
    uiElements.viewProfileModalClose = document.getElementById('view-profile-modal-close') as HTMLButtonElement;
    uiElements.viewProfileCloseBtn = document.getElementById('view-profile-close') as HTMLButtonElement;
    uiElements.viewProfileUsername = document.getElementById('view-profile-username') as HTMLInputElement;
    uiElements.viewProfileEmail = document.getElementById('view-profile-email') as HTMLInputElement;
    uiElements.viewProfileRealname = document.getElementById('view-profile-realname') as HTMLInputElement;
    uiElements.viewProfileDescription = document.getElementById('view-profile-description') as HTMLTextAreaElement;
    uiElements.viewProfileBirthday = document.getElementById('view-profile-birthday') as HTMLInputElement;
}

export function getUIElement<K extends keyof typeof uiElements>(key: K): typeof uiElements[K] {
    return uiElements[key];
}

export function escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}


// helper used by displayMessage to determine how to render a single file tag
function renderFilePreview(url: string): string {
    // simple extension-based mime detection
    const lower = url.toLowerCase();
    const imageExt = /(\.jpe?g|\.png|\.gif|\.webp|\.bmp|\.svg)$/i;
    const videoExt = /(\.mp4|\.webm|\.ogg)$/i;

    if (imageExt.test(lower)) {
        return `<div class="file-preview-wrapper"><img src="${escapeHtml(url)}" class="file-preview" /></div>`;
    } else if (videoExt.test(lower)) {
        return `<div class="file-preview-wrapper"><video controls src="${escapeHtml(url)}" class="file-preview"></video></div>`;
    } else {
        // fallback link
        return `<div class="file-preview-wrapper"><a href="${escapeHtml(url)}" download="" class="file-download">Скачать файл</a></div>`;
    }
}

// parses content and replaces any [FILE:url] tags with appropriate html
function parseContentWithFiles(content: string): string {
    const fileRegex = /\[FILE:([^\]]+)\]/g;
    let result = '';
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = fileRegex.exec(content)) !== null) {
        result += escapeHtml(content.slice(lastIndex, match.index));
        const url = match[1];
        result += renderFilePreview(url);
        lastIndex = fileRegex.lastIndex;
    }

    result += escapeHtml(content.slice(lastIndex));
    return result;
}

export function displayMessage(content: string, time: number, isOwn: boolean = false, sender?: string): void {
    const messagesContainer = getUIElement('messagesContainer');
    if (!messagesContainer) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${isOwn ? 'msg--right' : 'msg--left'}`;

    const timestamp = new Date(time * 1000).toLocaleTimeString();
    const msgBubble = document.createElement('div');
    msgBubble.className = 'msg__bubble';
    
    // build the main html including parsed file blocks
    let messageHTML = parseContentWithFiles(content) + '<br><span class="msg__time">';
    if (sender && !isOwn) {
        messageHTML += `${escapeHtml(sender)} • `;
    }
    messageHTML += `${timestamp}</span>`;
    
    msgBubble.innerHTML = messageHTML;

    msgDiv.appendChild(msgBubble);
    messagesContainer.appendChild(msgDiv);

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}


export function updateChatTitle(status: string): void {
    const chatTitle = getUIElement('chatTitle');
    if (chatTitle) {
        chatTitle.textContent = status;
    }
}

export function clearMessagesUI(): void {
    const messagesContainer = getUIElement('messagesContainer');
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
    }
}

/**
 * Оптимизирует производительность отображения сообщений на мобильных
 * Скрывает старые сообщения, если их слишком много
 */
export function optimizeMessagesDisplay(): void {
    const messagesContainer = getUIElement('messagesContainer');
    if (!messagesContainer) return;

    const messages = messagesContainer.querySelectorAll('.msg') as NodeListOf<HTMLDivElement>;
    const MAX_VISIBLE = window.innerWidth < 768 ? 100 : 200;

    // Если сообщений больше, чем максимум, скрываем старые
    if (messages.length > MAX_VISIBLE) {
        const messagesToHide = messages.length - MAX_VISIBLE;
        for (let i = 0; i < messagesToHide; i++) {
            messages[i].style.display = 'none';
        }
    } else {
        // Показываем все сообщения, если их меньше максимума
        messages.forEach(msg => {
            msg.style.display = '';
        });
    }
}

export function updateContactsListUI(
    contacts: Map<string, Contact>,
    currentChat: string,
    onContactClick: (contactName: string) => void,
    onProfileClick: (contactName: string) => void
): void {
    const contactsList = getUIElement('contactsList');
    const contactSearch = getUIElement('contactSearch');

    if (!contactsList) return;

    const searchQuery = contactSearch?.value.toLowerCase() || '';
    const sortedContacts = getSortedContacts(contacts, searchQuery);

    let html = '';

    for (const contact of sortedContacts) {
        const isActive = contact.name === currentChat ? ' contact--active' : '';
        const lastMsg = contact.lastMessage || 'Нет сообщений';
        const unreadBadge = contact.unread ?
            `<span class="contact__badge">${contact.unread}</span>` : '';
        
        // Определяем иконку для аватара в зависимости от типа контакта
        const avatarIcon = contact.contactType === 'channel' ? '#' : contact.name[1] || '@';

        // Форматируем последнее сообщение с информацией об отправителе
        let lastMsgDislay = escapeHtml(lastMsg.substring(0, 30));
        if (contact.lastSender && contact.contactType === 'channel') {
            // Для каналов показываем отправителя
            lastMsgDislay = `${escapeHtml(contact.lastSender)}: ${lastMsgDislay}`;
        }

        html += `
            <div class="contact${isActive} contact--${contact.contactType}" data-contact="${contact.name}">
                <div class="contact__avatar">${avatarIcon}</div>
                <div class="contact__meta">
                    <div class="contact__name">${escapeHtml(contact.name)}</div>
                    <div class="contact__last">${lastMsgDislay}</div>
                </div>
                ${unreadBadge}
            </div>
        `;
    }

    if (sortedContacts.length === 0) {
        html = '<div style="padding: 20px; text-align: center; color: var(--color-text-muted);">Нет контактов</div>';
    }

    contactsList.innerHTML = html;

    const contactElements = contactsList.querySelectorAll('.contact');
    contactElements.forEach(el => {
        el.addEventListener('click', () => {
            const contactName = el.getAttribute('data-contact');
            if (contactName) {
                onContactClick(contactName);
            }
        });

        // Add click handler for profile view on name/avatar
        const avatarEl = el.querySelector('.contact__avatar');
        const nameEl = el.querySelector('.contact__name');

        const handleProfileClick = (e: Event) => {
            e.stopPropagation();
            const contactName = el.getAttribute('data-contact');
            if (contactName && contactName.startsWith('@')) {
                onProfileClick(contactName);
            }
        };

        if (avatarEl) avatarEl.addEventListener('click', handleProfileClick);
        if (nameEl) nameEl.addEventListener('click', handleProfileClick);
    });
}

export function openProfileModal(currentUser: string, userProfile: any): void {
    const profileModal = getUIElement('profileModal');
    if (!profileModal) return;

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

export function closeProfileModal(): void {
    const profileModal = getUIElement('profileModal');
    if (profileModal) {
        profileModal.classList.remove('modal--active');
    }
}

export function openViewProfileModal(username: string, userProfile: UserProfile): void {
    const viewProfileModal = getUIElement('viewProfileModal');
    if (!viewProfileModal) return;

    const usernameInput = getUIElement('viewProfileUsername');
    const emailInput = getUIElement('viewProfileEmail');
    const realnameInput = getUIElement('viewProfileRealname');
    const descriptionInput = getUIElement('viewProfileDescription');
    const birthdayInput = getUIElement('viewProfileBirthday');

    if (usernameInput) usernameInput.value = username;
    if (emailInput) emailInput.value = userProfile.email || '';
    if (realnameInput) realnameInput.value = userProfile.realName || '';
    if (descriptionInput) descriptionInput.value = userProfile.description || '';
    if (birthdayInput) birthdayInput.value = formatBirthday(userProfile.birthday);

    viewProfileModal.classList.add('modal--active');
}

export function closeViewProfileModal(): void {
    const viewProfileModal = getUIElement('viewProfileModal');
    if (viewProfileModal) {
        viewProfileModal.classList.remove('modal--active');
    }
}

export function getProfileFormData(): any {
    const emailInput = document.getElementById('profile-email') as HTMLInputElement;
    const realnameInput = document.getElementById('profile-realname') as HTMLInputElement;
    const descriptionInput = document.getElementById('profile-description') as HTMLTextAreaElement;
    const birthdayInput = document.getElementById('profile-birthday') as HTMLInputElement;

    return {
        email: emailInput?.value || '',
        realName: realnameInput?.value || '',
        description: descriptionInput?.value || '',
        birthday: birthdayInput?.value || '0'
    };
}

export function updateProfileName(username: string): void {
    const profileName = getUIElement('profileName');
    if (profileName) {
        profileName.textContent = username;
    }
}

export function focusTextarea(): void {
    const textarea = getUIElement('textarea');
    if (textarea) {
        textarea.focus();
    }
}

export function clearTextarea(): void {
    const textarea = getUIElement('textarea');
    if (textarea) {
        textarea.value = '';
    }
}

export function getTextareaValue(): string {
    const textarea = getUIElement('textarea');
    return textarea?.value.trim() || '';
}

export function getNewChatUsername(): string {
    const newChatUsername = getUIElement('newChatUsername');
    return newChatUsername?.value.trim() || '';
}

export function clearNewChatUsername(): void {
    const newChatUsername = getUIElement('newChatUsername');
    if (newChatUsername) {
        newChatUsername.value = '';
    }
}

export function getContactSearchQuery(): string {
    const contactSearch = getUIElement('contactSearch');
    return contactSearch?.value.toLowerCase() || '';
}
