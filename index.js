const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('BOT RUSSO ATIVO'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');

async function startRussoBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sessao_mac_final');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        // MUDANÇA CRÍTICA: FINGINDO SER MAC OS (MAIS SEGURO)
        browser: ['Mac OS', 'Safari', '10.15.7']
    });

    if (!sock.authState.creds.registered) {
        console.log("🚀 AGUARDANDO ESTABILIZAR PARA GERAR CÓDIGOS...");
        setTimeout(async () => {
            try {
                // FOQUE NA OPÇÃO 2 (SEM O 9) - É A QUE O PARANÁ ACEITA NO BOT
                let code1 = await sock.requestPairingCode('5545999282949');
                console.log('\n🇷🇺 [OPÇÃO 1 - COM 9]: ' + code1);
                
                let code2 = await sock.requestPairingCode('554599282949');
                console.log('🇷🇺 [OPÇÃO 2 - SEM 9]: ' + code2 + '\n');
            } catch (e) {
                console.log('❌ Erro na geração. Tente o Deploy novamente.');
            }
        }, 15000); 
    }

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (new Boom(lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut);
            if (shouldReconnect) startRussoBot();
        } else if (connection === 'open') {
            console.log('✅ SUCESSO! BOT CONECTADO!');
        }
    });
}
startRussoBot();
