const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('RUSSO ON'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');

async function startRussoBot() {
    // Mudamos a sessão para 'sessao_final_v45' para limpar o erro anterior
    const { state, saveCreds } = await useMultiFileAuthState('sessao_final_v45');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '110.0.5481.177']
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            console.log("\n\n--- 🇷🇺 TESTANDO AS DUAS OPÇÕES DO SEU CHIP 45 ---");
            
            // OPÇÃO 1: COM O 9 (Geralmente falha no PR)
            try {
                let code1 = await sock.requestPairingCode('5545999282949');
                console.log('🇷🇺 [OPÇÃO 1 - COM 9]: ' + code1);
            } catch (e) { console.log('❌ Opção 1 falhou'); }

            // OPÇÃO 2: SEM O 9 (99% de chance de ser essa no Paraná!)
            try {
                let code2 = await sock.requestPairingCode('554599282949');
                console.log('🇷🇺 [OPÇÃO 2 - SEM 9]: ' + code2);
            } catch (e) { console.log('❌ Opção 2 falhou'); }
            
            console.log("----------------------------------------------\n");
        }, 10000); 
    }

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log('✅ AGORA FOI! BOT ONLINE NO CHIP 45!');
        if (u.connection === 'close') startRussoBot();
    });
}
startRussoBot();
