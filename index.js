const express = require('express');
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('🇷🇺 RUSSO-BOT OPERACIONAL'));
app.listen(port, '0.0.0.0', () => console.log(`Monitorando porta ${port}`));

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const pino = require('pino')
const moment = require('moment-timezone')

// CONFIGURAÇÃO DO DONO
const ownerNumber = '5565993416402@s.whatsapp.net' 

if (!fs.existsSync('./database.json')) fs.writeFileSync('./database.json', JSON.stringify({ aluguel: {}, usuarios: {} }))
const getDb = () => JSON.parse(fs.readFileSync('./database.json'))
const saveDb = (db) => fs.writeFileSync('./database.json', JSON.stringify(db, null, 2))

async function startRussoBot() {
    // A pasta 'sessao_russo' salva sua conexão
    const { state, saveCreds } = await useMultiFileAuthState('sessao_russo')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Russo-Bot', 'Chrome', '1.0.0'],
        printQRInTerminal: true // Mostra o QR torto no log
    })

    // Captura o QR Code em formato de texto para a gente converter
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update
        
        if (qr) {
            console.log('\n\n🇷🇺 [COPIE O TEXTO ABAIXO E MANDE PARA O GEMINI]:\n' + qr + '\n\n');
        }

        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
            if (reason !== DisconnectReason.loggedOut) startRussoBot()
        } else if (connection === 'open') {
            console.log('✅ [RUSSO-BOT]: CONECTADO COM SUCESSO NO WHATSAPP!');
        }
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0]
        if (!msg.message || msg.key.fromMe) return
        const remoteJid = msg.key.remoteJid
        const isGroup = remoteJid.endsWith('@g.us')
        const sender = msg.key.participant || msg.key.remoteJid
        const pushname = msg.pushName || "Usuário"
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase()
        const db = getDb()
        const isOwner = sender.includes('5565993416402')

        // COMANDO DE ATIVAÇÃO
        if (text.startsWith('!ativar') && isOwner) {
            const dias = parseInt(text.split(' ')[1]) || 30
            db.aluguel[remoteJid] = { expira: Date.now() + (dias * 24 * 60 * 60 * 1000) }
            saveDb(db)
            return sock.sendMessage(remoteJid, { text: `🇷🇺 *SISTEMA:* Grupo ativado por ${dias} dias!` })
        }

        // COMANDO MENU LUXO
        if (text === '!menu' && (db.aluguel[remoteJid] || isOwner)) {
            const data = moment.tz('America/Cuiaba').format('DD/MM')
            const hora = moment.tz('America/Cuiaba').format('HH:mm')
            const botPp = await sock.profilePictureUrl(sock.user.id.split(':')[0] + '@s.whatsapp.net', 'image').catch(() => 'https://telegra.ph/file/b545f448e658141445b2b.jpg')
            
            const menuTxt = `┏━━〔 🇷🇺 *RUSSO-BOT* 〕━━┓\n┃\n┃ 👤 *User:* ${pushname}\n┃ 🕒 *Hora:* ${hora} | *Data:* ${data}\n┃ 🛡️ *Status:* ${db.aluguel[remoteJid] ? '💎 VIP' : '👑 DONO'}\n┃\n┣━━〔 🛠️ *COMANDOS* 〕\n┃ 🔹 !marcar [texto]\n┃ 🔹 !ban [marque]\n┃ 🔹 !play [música]\n┃ 🔹 !perfil\n┃ 🔹 !pix\n┃\n┗━━━━━━━━━━━━━┛\n🇷🇺 _O brabo da gestão_`
            await sock.sendMessage(remoteJid, { image: { url: botPp }, caption: menuTxt })
        }
    })
}
startRussoBot()
