const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('RUSSO ON 🇷🇺'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const pino = require('pino')

async function startRussoBot() {
    // IMPORTANTE: Mantendo a sessão que você já conectou
    const { state, saveCreds } = await useMultiFileAuthState('sessao_nova_vida')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Mac OS', 'Safari', '10.15.7']
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u
        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
            if (reason !== DisconnectReason.loggedOut) startRussoBot()
        } else if (connection === 'open') {
            console.log('✅ [SISTEMA]: RUSSO ONLINE E TE ESCUTANDO!')
        }
    })

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0]
        if (!msg.message || msg.key.fromMe) return
        
        const remoteJid = msg.key.remoteJid
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase()
        const isOwner = remoteJid.includes('5565993416402') // Seu número 65

        // TESTE IMEDIATO NO PV
        if (isOwner && text === 'oi') {
            await sock.sendMessage(remoteJid, { text: '🇷🇺 *FALA MEU CHEFE!* Agora eu te ouvi. O motor tá tinindo!' })
        }

        // COMANDO DE TESTE DE MENU
        if (text === '!menu') {
            const menuTxt = `┏━━━〔 🇷🇺 *RUSSO-BOT* 〕━━━┓\n┃\n┃ 🛡️ *Status:* Online\n┃ 👤 *Dono:* Gui\n┃\n┣━━〔 🛠️ *COMANDOS* 〕\n┃ 🔹 !marcar\n┃ 🔹 !ban\n┃ 🔹 !pix\n┃\n┗━━━━━━━━━━━━━━━┛`
            await sock.sendMessage(remoteJid, { text: menuTxt })
        }
    })
}

startRussoBot()
