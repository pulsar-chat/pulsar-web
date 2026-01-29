

function stringify(arg: unknown): string {
    return String(arg);
}

function removeSpaces(s: string): string {
    return s.replace(/\s+/g, "");
}
function alignRight(size: number, arg: unknown, fill: string = ' '): string {
    const str = stringify(arg);
    const sSize = str.length;
    const delta = size - sSize;
    let res = '';
    for (let i = 0; i < delta; i++) {
        res += fill;
    }
    res += str;
    return res;
}

class Message {
    private id: number;
    private content: string;
    private receiver: string;
    private sender: string;
    private timestamp: Date;

    constructor(id: number, content: string, receiver: string, sender: string, timestamp: Date) {
        this.id = id;
        this.content = content;
        this.receiver = receiver;
        this.sender = sender;
        this.timestamp = timestamp;
    }
    getId(): number {
        return this.id;
    }

    getTime(): Date {
        return this.timestamp;
    }

    getSender(): string {
        return this.sender;
    }

    getRec(): string {
        return this.receiver;
    }

    getContent(): string {
        return this.content;
    }


    toPayload(): string {
        let payload = "";
        payload += alignRight(PULSAR_ID_SIZE, this.id, "0");
        payload += alignRight(PULSAR_TIME_SIZE, this.timestamp, "0");
        payload += alignRight(PULSAR_SRC_SIZE, this.sender);
        payload += alignRight(PULSAR_DST_SIZE, this.receiver);
        payload += this.content;
        return payload;
    }

    static toPayload(message: Message): string {
        return message.toPayload();
    }

    fromPayload(payload: string): Message {
        const idStr = removeSpaces(payload.slice(0, PULSAR_ID_SIZE));
        const timeStr = removeSpaces(payload.slice(PULSAR_ID_SIZE, PULSAR_ID_SIZE + PULSAR_TIME_SIZE));
        const senderStr = removeSpaces(payload.slice(PULSAR_ID_SIZE + PULSAR_TIME_SIZE, PULSAR_ID_SIZE + PULSAR_TIME_SIZE + PULSAR_SRC_SIZE));
        const receiverStr = removeSpaces(payload.slice(PULSAR_ID_SIZE + PULSAR_TIME_SIZE + PULSAR_SRC_SIZE, PULSAR_ID_SIZE + PULSAR_TIME_SIZE + PULSAR_SRC_SIZE + PULSAR_DST_SIZE));
        const contentStr = payload.slice(PULSAR_ID_SIZE + PULSAR_TIME_SIZE + PULSAR_SRC_SIZE + PULSAR_DST_SIZE);
        const id = parseInt(idStr, 10);
        const timestamp = new Date(parseInt(timeStr, 10));
        return new Message(id, contentStr, receiverStr, senderStr, timestamp);
    }
}
