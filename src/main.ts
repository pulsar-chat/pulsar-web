import PulsarWebSocket from "./websocket/pulsar";
import Message from "./message";
import { PulsarClient } from "./client";
import { getCookie, deleteCookie, setCookie } from "./cookie";
import { PULSAR_URL } from "./config";

// UI Elements
const messagesContainer = document.getElementById('messages');
const textarea = document.querySelector('.chat__textarea') as HTMLTextAreaElement;
const sendBtn = document.querySelector('.chat__send') as HTMLButtonElement;
const chatTitle = document.querySelector('.chat__title') as HTMLDivElement;

let currentChat: string = "@browser";
let currentUser: string = "@browser";
let cli: PulsarClient | null = null;

// Initialize client
function initClient(username: string) {
    cli = new PulsarClient(username, PULSAR_URL);
    currentUser = username;

    cli.connect();

    cli.onOpen = async () => {
        console.log("Connected to server!");
        updateUI("Connected!");
        
        const rsp = await cli!.requestRaw("!ping");
        console.log(`Ping response: ${rsp}`);
    };

    cli.onClose = () => {
        updateUI("Disconnected");
        console.log("Disconnected from server");
    };

    cli.onError = (ev) => {
        console.error("Connection error:", ev);
        updateUI("Connection Error");
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
            updateUI(`Error: ${content}`);
            return;
        }

        // Display regular messages
        if (sender === currentChat || receiver === currentChat) {
            displayMessage(content, sender === currentUser);
            console.log(`Message from ${sender}: ${content}`);
        }
    };
}

function displayMessage(content: string, isOwn: boolean = false) {
    if (!messagesContainer) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${isOwn ? 'msg--right' : 'msg--left'}`;

    const timestamp = new Date().toLocaleTimeString();
    const msgBubble = document.createElement('div');
    msgBubble.className = 'msg__bubble';
    msgBubble.innerHTML = `${content}<br><span class="msg__time">${timestamp}</span>`;

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
                    currentChat = cookieUser;
                    updateUI(cookieUser);
                    displayMessage("Auto-login successful!", true);
                } else {
                    console.warn('Auto-login failed:', loginRsp);
                    deleteCookie('pulsar_user');
                    deleteCookie('pulsar_pass');
                    displayMessage("Login failed. Please reconnect.", false);
                }
            } catch (err) {
                console.warn('Auto-login error:', err);
            }
        };
    } else {
        initClient("@browser");
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
        } catch (err) {
            console.error('Send error:', err);
            displayMessage(`Error: ${err}`, false);
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

// Start the client
console.log("Pulsar Web Client initialized");
handleAutoLogin();