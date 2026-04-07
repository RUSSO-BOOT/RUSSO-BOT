const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('RUSSO ON'));
app.listen(process.env.PORT || 10000);

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const pino = require('pino')

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('sessao_russo')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '110.0.5481.177']
    })

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            const code = await sock.requestPairingCode('5545999282949') // << CONFIRMA ESSE NÚMERO!
            console.log('\n\n🇷🇺 [SEU CÓDIGO]: ' + code + '\n\n')
        }, 10000) // Dei 10 segundos pra Render respirar
    }

    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log('✅ CONECTADO!')
        if (u.connection === 'close') start()
    })
}
start()
