

function stringify(arg: unknown): string {
    return String(arg);
}
// в тс ес что стро
function removeSpaces(s: string): string {
    return s.replace(/\s+/g, "");//\s это юлбой пробельный символ типо таб или ентер а g это мы
    //  тип по всей строке чекаем(global) а не ток да первого совпадения \s
}
function alignRight(size: number,arg: unknown,fill: string = ' '): string {
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

    constructor(){// если ничгео не подаем в конструктор(поумолчаниб)
        this.id = 0;
        this.content = "";
        this.receiver = "";
        this.sender = "";
        this.timestamp = new Date(); //в школе рассксжу
    };
    constructor(id: number, content: string, receiver: string, sender: string, timestamp: Date) {
        this.id = id;
        this.content = content;
        this.receiver = receiver;
        this.sender = sender;
        this.timestamp = timestamp;
    }
    constructor(id: number, content: string, receiver: string, sender: string){
         this.id = id;
        this.content = content;
        this.receiver = receiver;
        this.sender = sender;
        this.timestamp = new Date();//тк дату не подаем ставим текущую
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
    // std::string to_payload() const {
    //     std::ostringstream oss;

    //     oss << align_right(PULSAR_ID_SIZE, id, '0');
    //     oss << align_right(PULSAR_TIME_SIZE, time.toTime(), '0');
    //     oss << align_right(PULSAR_SRC_SIZE, src);
    //     oss << align_right(PULSAR_DST_SIZE, dst);
    //     oss << msg;

    //     return oss.str();
    // }я н е понял что  это делает(типо в конечную форму предачина серв???)




    // toPayload(): string {
    //     let payload = "";
    //     payload += alignRight(PULSAR_ID_SIZE, this.id, "0");
    //     payload += alignRight(PULSAR_TIME_SIZE, this.time.toTime(), "0");
    //     payload += alignRight(PULSAR_SRC_SIZE, this.src);
    //     payload += alignRight(PULSAR_DST_SIZE, this.dst);
    //     payload += this.msg;
    //     return payload;
    // }

    // static toPayload(message: Message): string {
    //     return message.toPayload();
    // }

}
