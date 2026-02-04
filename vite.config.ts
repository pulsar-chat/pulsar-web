import { defineConfig } from "vite";
import { resolve } from "path";

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
    }
});