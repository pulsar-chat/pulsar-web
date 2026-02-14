import { Contact } from "./types";
import { getSortedContacts } from "./contacts";

const uiElements = {
    messagesContainer: null as HTMLDivElement | null,
    textarea: null as HTMLTextAreaElement | null,
    sendBtn: null as HTMLButtonElement | null,
    chatTitle: null as HTMLDivElement | null,
    contactsList: null as HTMLDivElement | null,
    profileBtn: null as HTMLDivElement | null,
    logoutBtn: null as HTMLButtonElement | null,
    profileModal: null as HTMLDivElement | null,
    profileModalClose: null as HTMLButtonElement | null,
    profileSaveBtn: null as HTMLButtonElement | null,
    profileCancelBtn: null as HTMLButtonElement | null,
    profileName: null as HTMLDivElement | null,
    contactSearch: null as HTMLInputElement | null,
    newChatUsername: null as HTMLInputElement | null,
    newChatBtn: null as HTMLButtonElement | null,
    clockModule: null as HTMLSpanElement | null
};

export function initUIElements(): void {
    uiElements.messagesContainer = document.getElementById('messages') as HTMLDivElement;
    uiElements.textarea = document.querySelector('.chat__textarea') as HTMLTextAreaElement;
    uiElements.sendBtn = document.querySelector('.chat__send') as HTMLButtonElement;
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

export function displayMessage(content: string, time: number, isOwn: boolean = false): void {
    const messagesContainer = getUIElement('messagesContainer');
    if (!messagesContainer) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${isOwn ? 'msg--right' : 'msg--left'}`;

    const timestamp = new Date(time * 1000).toLocaleTimeString();
    const msgBubble = document.createElement('div');
    msgBubble.className = 'msg__bubble';
    msgBubble.innerHTML = `${escapeHtml(content)}<br><span class="msg__time">${timestamp}</span>`;

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

export function updateContactsListUI(
    contacts: Map<string, Contact>,
    currentChat: string,
    onContactClick: (contactName: string) => void
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
    
    const contactElements = contactsList.querySelectorAll('.contact');
    contactElements.forEach(el => {
        el.addEventListener('click', () => {
            const contactName = el.getAttribute('data-contact');
            if (contactName) {
                onContactClick(contactName);
            }
        });
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
