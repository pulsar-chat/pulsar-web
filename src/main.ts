import PulsarWebSocket from "./websocket/pulsar";

console.log("Hello, World!");

const pwsURL = 'ws://212.113.98.14:8080';
const pws = new PulsarWebSocket(pwsURL);

pws.connect();

pws.onOpen = () => {
    pws.send("Hello, World!");
}

pws.onMessage  = (m) => {
    const message = Message.fromPayload(m)

    if (message.getSender().startsWith("!server")) {
        // парсинг ответа от сервера
    }
}