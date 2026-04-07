const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('BOT RODANDO'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');

async function startRussoBot() {
    // Mudamos o nome da sessão para 'sessao_nova_forca' para limpar o cache
    const { state, saveCreds } = await useMultiFileAuthState('sessao_nova_forca');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '110.0.5481.177']
    });

    // SISTEMA PÉ NA PORTA: Tenta gerar o código a cada 5 segundos se não aparecer
    if (!sock.authState.creds.registered) {
        let tentativa = 0;
        const interval = setInterval(async () => {
            tentativa++;
            console.log(`⏳ [TENTATIVA ${tentativa}] SOLICITANDO CÓDIGO...`);
            try {
                // Tenta com o número padrão do Paraná/Cuiabá
                let code = await sock.requestPairingCode('5545999282949');
                if (code) {
                    console.log('\n\n🇷🇺 [SEU CÓDIGO DE 8 DÍGITOS]: ' + code + '\n\n');
                    clearInterval(interval); // Para de tentar quando conseguir
                }
            } catch (err) {
                console.log('❌ WhatsApp ainda não liberou... Tentando de novo...');
            }
        }, 5000); 
    }

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log('✅ BOT CONECTADO COM SUCESSO!');
        if (u.connection === 'close') startRussoBot();
    });
}
startRussoBot();
