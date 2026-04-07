const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const qrcode = require('qrcode-terminal')
const yts = require('yt-search')
const ytdl = require('ytdl-core')
const fs = require('fs')
const pino = require('pino')

// ================= CONFIGURAÇÃO AJUSTADA =================
const ownerNumber = '5565993416402@s.whatsapp.net' 
const botPhoneNumber = '5545999282949' // << NÚMERO CORRIGIDO AQUI
const prefix = '!'
// =========================================================

if (!fs.existsSync('./database.json')) fs.writeFileSync('./database.json', JSON.stringify({ aluguel: {}, usuarios: {} }))
const getDb = () => JSON.parse(fs.readFileSync('./database.json'))
const saveDb = (db) => fs.writeFileSync('./database.json', JSON.stringify(db, null, 2))

async function startRussoBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sessao_russo')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '110.0.5481.177'],
        printQRInTerminal: false
    })

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            let code = await sock.requestPairingCode(botPhoneNumber)
            code = code?.match(/.{1,4}/g)?.join('-') || code
            console.log('\n\n🇷🇺 [CÓDIGO DE CONEXÃO]: ' + code + '\n\n')
        }, 5000)
    }

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
            if (reason !== DisconnectReason.loggedOut) startRussoBot()
        } else if (connection === 'open') {
            console.log('✅ [RUSSO-BOT ONLINE]: CONECTADO COM SUCESSO!')
        }
    })

    sock.ev.on('group-participants.update', async (update) => {
        const { id, participants, action } = update
        const db = getDb()
        if (action === 'add' && db.aluguel[id]) {
            for (let num of participants) {
                const ppUrl = await sock.profilePictureUrl(num, 'image').catch(() => 'https://telegra.ph/file/b545f448e658141445b2b.jpg')
                await sock.sendMessage(id, { 
                    image: { url: ppUrl }, 
                    caption: `👋 *BEM-VINDO(A)!* \n\nOlá @${num.split('@')[0]}, você entrou na elite. Use *!menu*!`,
                    mentions: [num] 
                })
            }
        }
    })

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0]
        if (!msg.message || msg.key.fromMe) return
        const remoteJid = msg.key.remoteJid
        const isGroup = remoteJid.endsWith('@g.us')
        const sender = msg.key.participant || msg.key.remoteJid
        const pushname = msg.pushName || "Usuário"
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase()

        const db = getDb()
        const isVip = db.aluguel[remoteJid] ? true : false
        const isOwner = sender === ownerNumber

        if (text.startsWith(prefix)) {
            const args = text.slice(1).split(' ')
            const command = args.shift()
            const q = args.join(' ')

            if (command === 'ativar' && isOwner && isGroup) {
                const dias = parseInt(args[0]) || 30
                db.aluguel[remoteJid] = { expira: new Date().getTime() + (dias * 24 * 60 * 60 * 1000) }
                saveDb(db)
                return sock.sendMessage(remoteJid, { text: `🇷🇺 *SISTEMA:* Grupo liberado por ${dias} dias.` })
            }

            if (isGroup && !isVip && !isOwner) return

            switch (command) {
                case 'menu':
                    const botPp = await sock.profilePictureUrl(sock.user.id.split(':')[0] + '@s.whatsapp.net', 'image').catch(() => 'https://telegra.ph/file/b545f448e658141445b2b.jpg')
                    const menuMsg = `⚙️ *RUSSO-BOT V-SUPREMA*\n\n👤 *User:* ${pushname}\n\n🛡️ *ADMIN:* !marcar, !ban, !tempo\n🎵 *MEDIA:* !play, !video, !perfil\n🎮 *ZUEIRA:* !gay, !corno\n\n🇷🇺 _Bot Online 24h_`
                    await sock.sendMessage(remoteJid, { image: { url: botPp }, caption: menuMsg })
                    break

                case 'play':
                    if (!q) return
                    const sPlay = await yts(q); const vPlay = sPlay.videos[0]
                    if (vPlay) {
                        await sock.sendMessage(remoteJid, { text: `🎵 *Baixando:* ${vPlay.title}` })
                        const pPlay = `./${vPlay.videoId}.mp3`
                        ytdl(vPlay.url, { filter: 'audioonly' }).pipe(fs.createWriteStream(pPlay)).on('finish', async () => {
                            await sock.sendMessage(remoteJid, { audio: { url: pPlay }, mimetype: 'audio/mp4' })
                            fs.unlinkSync(pPlay)
                        })
                    }
                    break

                case 'marcar':
                    const gMar = await sock.groupMetadata(remoteJid)
                    const mMar = gMar.participants.map(p => p.id)
                    await sock.sendMessage(remoteJid, { text: `📢 *CHAMADA GERAL:* \n\n${q}`, mentions: mMar })
                    break
            }
        }
    })
}

startRussoBot().catch(e => console.log("ERRO:", e))
