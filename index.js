const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('RUSSO ON'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');

async function startRussoBot() {
    // Mudamos a sessão de novo pra limpar o erro de 'conexão falhou'
    const { state, saveCreds } = await useMultiFileAuthState('sessao_limpa_final');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        // MUDAMOS AQUI PARA PARECER UM CELULAR REAL
        browser: ['Android (RussoBot)', 'Chrome', '1.0.0']
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            console.log("\n--- 🇷🇺 GERANDO CÓDIGOS (FOQUE NA OPÇÃO 2) ---");
            try {
                let code1 = await sock.requestPairingCode('5545999282949');
                console.log('🇷🇺 [OPÇÃO 1]: ' + code1);
            } catch (e) {}

            try {
                let code2 = await sock.requestPairingCode('554599282949');
                console.log('🇷🇺 [OPÇÃO 2 - MAIS PROVÁVEL]: ' + code2);
            } catch (e) {}
        }, 10000); 
    }

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log('✅ AGORA FOI! BOT ONLINE!');
        if (u.connection === 'close') startRussoBot();
    });
}
startRussoBot();
