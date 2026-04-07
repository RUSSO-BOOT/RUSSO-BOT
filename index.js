const express = require('express');
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('RUSSO ON'));
app.listen(port, '0.0.0.0', () => console.log(`Online na porta ${port}`));

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const pino = require('pino')

async function startRussoBot() {
    // MUDAMOS PARA 'sessao_z' PARA ZERAR TUDO
    const { state, saveCreds } = await useMultiFileAuthState('sessao_z')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '110.0.5481.177']
    })

    if (!sock.authState.creds.registered) {
        console.log("⏳ SOLICITANDO CÓDIGO... AGUARDE 5 SEGUNDOS...");
        setTimeout(async () => {
            try {
                // Tenta o código de 8 dígitos direto
                let code = await sock.requestPairingCode('5545999282949')
                console.log('\n\n🇷🇺 [SEU CÓDIGO]: ' + code + '\n\n')
            } catch (err) {
                console.log('❌ ERRO: O WhatsApp demorou a responder. Dê um RESTART na Render.');
            }
        }, 5000) 
    }

    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'close') startRussoBot()
        if (u.connection === 'open') console.log('✅ BOT CONECTADO!')
    })

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0]
        if (!msg.message || msg.key.fromMe) return
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase()
        if (text === '!menu') {
            await sock.sendMessage(msg.key.remoteJid, { text: '🇷🇺 *RUSSO-BOT ON!*' })
        }
    })
}
startRussoBot()
