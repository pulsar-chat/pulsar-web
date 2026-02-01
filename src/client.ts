import PulsarWebSocket from "./websocket/pulsar";
import Message from "./message"

export class PulsarClient {
    private pws: PulsarWebSocket;
    private name: string;

    public onOpen:    (() => void)               | null = null;
    public onClose:   ((ev: CloseEvent) => void) | null = null;
    public onError:   ((ev: Event) => void)      | null = null;
    public onMessage: ((msg: Message) => void)   | null = null;

    constructor(name: string, url: string) {
        this.pws = new PulsarWebSocket(url);
        this.name = name;
    }

    connect(): void {
        this.pws.connect();

        this.pws.onOpen = () => {
            this.onOpen && this.onOpen();
        };

        this.pws.onClose = (ev) => {
            this.onClose && this.onClose(ev);
        };

        this.pws.onError = (ev) => {
            this.onError && this.onError(ev);
        };

        this.pws.onMessage = (raw) => {
            this.onMessage && this.onMessage(Message.fromPayload(raw));
        }
    }

    send(content: string, receiver: string) {
        const payload = new Message(0, content, receiver, this.name, Math.floor(Date.now() / 1000));
        this.pws.send(payload.toPayload());
    }

    requestRaw(req: string) {
        this.send(req, "!server.req");
    }
}