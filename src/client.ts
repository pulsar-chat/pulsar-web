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
            const m = Message.fromPayload(raw);

            if (m.getSender() === "!server.msg") {
                const parsed = this.parseAns(m.getContent());
                this.pushAns(parsed);
            }

            this.onMessage && this.onMessage(m);
        }
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

    private async waitForAnswer(req: string): Promise<string> {
        return new Promise((resolve) => {
            const check = (): string | null => {
                for (const a of this.serverAnswers) {
                    if (a.req === req) return a.rsp;
                }
                return null;
            };

            const found = check();
            if (found !== null) {
                resolve(found);
                return;
            }

            const iv = setInterval(() => {
                const v = check();
                if (v !== null) {
                    clearInterval(iv);
                    resolve(v);
                }
            }, 50);
        });
    }

    async requestRaw(req: string): Promise<string> {
        this.send(req, "!server.req");
        return await this.waitForAnswer(req);
    }
}