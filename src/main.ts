import PulsarWebSocket from "./websocket/pulsar";
import Message from "./message";
import { PulsarClient } from "./client";

console.log("Hello, World!");

const pulsarURL = 'ws://212.113.98.14:8080';

const cli = new PulsarClient("@ra", pulsarURL);

cli.connect();

cli.onOpen = async () => {
    console.log("Connect!");
    const rsp =  await cli.requestRaw("!ping");
    console.log(rsp);
};

cli.onMessage = (msg: Message) => {
    console.log(`New message:
        id: ${msg.getId()}
        time: ${msg.getTime()}
        src: ${msg.getSender()}
        dst: ${msg.getReciever()}
        msg: ${msg.getContent()}
    `);
};