const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('RUSSO ON'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');

async function startRussoBot() {
    // Mudamos o nome da sessão para 'sessao_forca_45' para resetar o erro
    const { state, saveCreds } = await useMultiFileAuthState('sessao_forca_45');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '110.0.5481.177']
    });

    console.log("🚀 [SISTEMA]: BOT INICIADO. AGUARDANDO COMUNICAÇÃO...");

    if (!sock.authState.creds.registered) {
        let contador = 0;
        const interval = setInterval(async () => {
            contador++;
            console.log(`⏳ [TENTATIVA ${contador}] SOLICITANDO CÓDIGOS...`);
            
            try {
                // OPÇÃO 1: COM O 9
                let code1 = await sock.requestPairingCode('5545999282949');
                if (code1) {
                    console.log('\n\n🇷🇺 [OPÇÃO 1 - COM 9]: ' + code1);
                }

                // OPÇÃO 2: SEM O 9
                let code2 = await sock.requestPairingCode('554599282949');
                if (code2) {
                    console.log('🇷🇺 [OPÇÃO 2 - SEM 9]: ' + code2 + '\n\n');
                    clearInterval(interval); // Para de tentar quando o código aparecer
                }
            } catch (err) {
                console.log('❌ [ERRO]: WhatsApp demorou. Tentando de novo em 5s...');
            }
        }, 8000); 
    }

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log('✅ CONECTADO NO CHIP 45!');
        if (u.connection === 'close') startRussoBot();
    });
}
startRussoBot();
