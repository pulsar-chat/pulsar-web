import { defineConfig } from "vite";
import { resolve } from "path";
import fs from "fs"

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                register: resolve(__dirname, 'register.html'),
                login: resolve(__dirname, 'login.html'),
                client: resolve(__dirname, 'client.html'),
            }
        }
    },

    server: {
        https: {
            key: fs.readFileSync('localhost+2-key.pem'),
            cert: fs.readFileSync('localhost+2.pem')
        },
        host: 'localhost'
    }
});