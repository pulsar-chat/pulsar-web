import PulsarWebSocket from "./websocket/pulsar";
import Message from "./message";
import { PulsarClient } from "./client";
import { getCookie, deleteCookie } from "./cookie";
import { PULSAR_URL } from "./config";

console.log("Hello, World!");

const cookieUser = getCookie('pulsar_user');
const cookiePass = getCookie('pulsar_pass');

const clientName = cookieUser ?? "@browser";

const cli = new PulsarClient(clientName, PULSAR_URL);

cli.connect();

cli.onOpen = async () => {
    console.log("Connect!");

    if (cookieUser && cookiePass) {
        try {
            const loginReq = `!login ${cookieUser} ${cookiePass}`;
            const loginRsp = await cli.requestRaw(loginReq);

            if (loginRsp === 'success') {
                console.log('Auto-login successful', cookieUser);
            } else {
                console.warn('Auto-login failed: ', loginRsp);
                deleteCookie('pulsar_user');
                deleteCookie('pulsar_pass');
            }
        } catch (err) {
            console.warn('Auto-login error: ', err);
        }
    } else {
        const rsp = await cli.requestRaw("!ping");
        console.log(rsp);
    }
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




// МЯСНОЙ БОГ 44ю0exi