class PulsarWebSocket {
    private url: string;
    private socket: WebSocket | null = null;
    private reconnectInterval: number = 2000;
    private shouldReconnect: boolean = true;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectInterval: number = 30000;

    public onOpen: (() => void) | null = null;
    public onClose: ((ev: CloseEvent) => void) | null = null;
    public onError: ((ev: Event) => void) | null = null;
    public onMessage: ((raw: string) => void) | null = null;

    constructor(url: string) {
        this.url = url;
    }

    connect() {
        if (
            this.socket && (
                this.socket.readyState === WebSocket.OPEN || 
                this.socket.readyState === WebSocket.CONNECTING
            )
        ) return;
        this.shouldReconnect = true;
        this.socket = new WebSocket(this.url);
        this.socket.binaryType = "arraybuffer";

        this.socket.addEventListener("open", () => {
            // Reset reconnect attempts on successful open
            this.reconnectAttempts = 0;
            this.onOpen && this.onOpen();
        }); // обработка открытия сокета

        this.socket.addEventListener("close", (ev) => {
            this.onClose && this.onClose(ev);
            this.socket = null;
            if (this.shouldReconnect) {
                // exponential backoff for reconnects
                this.reconnectAttempts++;
                const interval = Math.min(this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectInterval);
                // Only attempt reconnect if shouldReconnect still true at execution time
                setTimeout(() => {
                    if (this.shouldReconnect) this.connect();
                }, interval);
            }
        }); // обработка закрытия сокета и реконнект

        this.socket.addEventListener("error", (ev) => {
            this.onError && this.onError(ev);
        }); // обработка ошибок?

        this.socket.addEventListener("message", (ev) => {
            const bytes = new Uint8Array(ev.data);
            const raw = new TextDecoder().decode(bytes);

            this.onMessage && this.onMessage(raw);
        }); // обработка сообщений
    }

    disconnect() {
        this.shouldReconnect = false;
        if (this.socket) {
            this.socket.close(0, "disconnect (PulsarWebSocket::disconnect)");
            this.socket = null;
        }
    }

    send(raw: string) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            throw new Error("PulsarWebSocket is not open!");
        }

        this.socket.send(raw);
    }
}

export default PulsarWebSocket;