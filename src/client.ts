import PulsarWebSocket from "./websocket/pulsar";
import Message from "./message"
import Answer from "./answer";
import * as def from "./defines"

export class PulsarClient {
    private pws: PulsarWebSocket;
    private name: string;
    private serverAnswers: Answer[];

    public onOpen:    (() => void)               | null = null;
    public onClose:   ((ev: CloseEvent) => void) | null = null;
    public onError:   ((ev: Event) => void)      | null = null;
    public onMessage: ((msg: Message) => void)   | null = null;

    constructor(name: string, url: string) {
        this.pws = new PulsarWebSocket(url);
        this.name = name;
        this.serverAnswers = [];
    }

    connect(): void {
        // Bind websocket callbacks first to avoid race where socket opens before handlers assigned
        this.pws.onOpen = () => {
            // reset any client-side onOpen handling
            this.onOpen && this.onOpen();
        };

        this.pws.onClose = (ev) => {
            this.onClose && this.onClose(ev);
        };

        this.pws.onError = (ev) => {
            this.onError && this.onError(ev);
        };

        this.pws.onMessage = (raw) => {
            const m = Message.fromPayload(raw);

            if (m.getSender() === "!server.msg") {
                const parsed = this.parseAns(m.getContent());
                this.pushAns(parsed);
            }

            this.onMessage && this.onMessage(m);
        };

        // Now establish connection
        this.pws.connect();
    }

    disconnect(): void {
        this.pws.disconnect();
    }

    send(content: string, receiver: string) {
        const payload = new Message(0, content, receiver, this.name, Math.floor(Date.now() / 1000));
        this.pws.send(payload.toPayload());
    }

    parseAns(rawAns: string): Answer {
        const SEP = "\x1e";
        const REQ_PREF = "REQ:";
        const RSP_PREF = "RSP:";

        const trim = (s: string) => {
            let a = 0;
            let b = s.length;
            while (a < b && /\s/.test(s[a])) ++a;
            while (b > a && /\s/.test(s[b - 1])) --b;
            return s.substring(a, b);
        };

        let left: string;
        let right: string;
        const pos = rawAns.indexOf(SEP);
        if (pos === -1) {
            const rspPos = rawAns.indexOf(RSP_PREF);
            if (rspPos !== -1) {
                left = rawAns.substring(0, rspPos);
                right = rawAns.substring(rspPos);
            } else {
                left = rawAns;
                right = "";
            }
        } else {
            left = rawAns.substring(0, pos);
            right = rawAns.substring(pos + 1);
        }

        left = trim(left);
        right = trim(right);

        const res: Answer = { req: "", rsp: "" };

        if (left.startsWith(REQ_PREF)) res.req = trim(left.substring(REQ_PREF.length));
        else res.req = left;

        if (right.startsWith(RSP_PREF)) res.rsp = trim(right.substring(RSP_PREF.length));
        else res.rsp = right;

        return res;
    }

    pushAns(ans: Answer): void {
        this.serverAnswers.push(ans);

        if (this.serverAnswers.length > def.PULSAR_MAX_ANSWER_STORE) {
            this.serverAnswers.shift();
        }
    }

    private async waitForAnswer(req: string, timeoutMs: number = 5000): Promise<string> {
        return new Promise((resolve, reject) => {
            const findIndex = (): number => {
                for (let i = this.serverAnswers.length - 1; i >= 0; i--) {
                    if (this.serverAnswers[i].req === req) return i;
                }
                return -1;
            };

            const useAnswerAt = (idx: number) => {
                const rsp = this.serverAnswers[idx].rsp;
                this.serverAnswers.splice(idx, 1);
                resolve(rsp);
            };

            const idx = findIndex();
            if (idx !== -1) {
                useAnswerAt(idx);
                return;
            }

            const iv = setInterval(() => {
                const i = findIndex();
                if (i !== -1) {
                    clearInterval(iv);
                    if (to) clearTimeout(to);
                    useAnswerAt(i);
                }
            }, 50);

            const to = setTimeout(() => {
                clearInterval(iv);
                reject(new Error(`Request timeout: ${req}`));
            }, timeoutMs);
        });
    }

    async requestRaw(req: string, timeoutMs: number = 5000): Promise<string> {
        this.send(req, "!server.req");
        return await this.waitForAnswer(req, timeoutMs);
    }
}
