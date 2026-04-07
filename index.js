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

// ================= CONFIGURAÇÃO JÁ DEFINIDA =================
const ownerNumber = '5565993416402@s.whatsapp.net' // Você (Mestre)
const botPhoneNumber = '5545999292849' // Chip do Bot (DDD 45)
const prefix = '!'
// ============================================================

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

    // --- CÓDIGO DE PAREAMENTO (VER NO LOG DA RENDER) ---
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            let code = await sock.requestPairingCode(botPhoneNumber)
            code = code?.match(/.{1,4}/g)?.join('-') || code
            console.log('\n\n🇷🇺 [CÓDIGO DE CONEXÃO]: ' + code + '\n\n')
            console.log('DIGITE ESTE CÓDIGO NO WHATSAPP DO BOT (45 99929-2849)\n\n')
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

    // --- FUNÇÃO DE BOAS-VINDAS COM FOTO DE QUEM ENTROU ---
    sock.ev.on('group-participants.update', async (update) => {
        const { id, participants, action } = update
        const db = getDb()
        
        // Só funciona se o grupo estiver com aluguel ativo
        if (action === 'add' && db.aluguel[id]) {
            for (let num of participants) {
                // Anti-Fake (Gringo)
                if (!num.startsWith('55')) {
                    await sock.sendMessage(id, { text: `🛡️ *SISTEMA:* Gringo @${num.split('@')[0]} banido automaticamente.`, mentions: [num] })
                    return await sock.groupParticipantsUpdate(id, [num], 'remove')
                }

                // Tenta buscar a foto de perfil de quem entrou
                const ppUrl = await sock.profilePictureUrl(num, 'image').catch(() => 'https://telegra.ph/file/b545f448e658141445b2b.jpg')
                
                await sock.sendMessage(id, { 
                    image: { url: ppUrl }, 
                    caption: `👋 *BEM-VINDO(A)!* \n\nOlá @${num.split('@')[0]}, você acaba de entrar no grupo! Use *!menu* para conhecer o Russo-Bot.`,
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
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").toLowerCase()

        const db = getDb()
        const isVip = db.aluguel[remoteJid] ? true : false
        const isOwner = sender === ownerNumber
        const agora = new Date().getTime()

        if (!db.usuarios[sender]) db.usuarios[sender] = { xp: 0, level: 1 }
        db.usuarios[sender].xp += 5
        saveDb(db)

        if (isGroup && isVip && text.includes('chat.whatsapp.com/')) {
            const gMeta = await sock.groupMetadata(remoteJid)
            const isAdmin = gMeta.participants.find(p => p.id === sender)?.admin !== null
            if (!isAdmin && !isOwner) {
                await sock.sendMessage(remoteJid, { delete: msg.key })
                return sock.sendMessage(remoteJid, { text: `🚫 *ANTI-LINK:* Sem divulgações aqui!`, mentions: [sender] })
            }
        }

        if (text.startsWith(prefix)) {
            const args = text.slice(1).split(' ')
            const command = args.shift()
            const q = args.join(' ')

            if (command === 'ativar' && isOwner && isGroup) {
                const dias = parseInt(args[0]) || 30
                db.aluguel[remoteJid] = { expira: agora + (dias * 24 * 60 * 60 * 1000) }
                saveDb(db)
                return sock.sendMessage(remoteJid, { text: `🇷🇺 *SISTEMA:* Grupo ativado por ${dias} dias pelo meu mestre.` })
            }

            if (isGroup && !isVip && !isOwner) return

            switch (command) {
                case 'menu':
                    // Pega a foto do próprio Bot (a que você colocou no chip 45)
                    const botPpUrl = await sock.profilePictureUrl(sock.user.id.split(':')[0] + '@s.whatsapp.net', 'image').catch(() => 'https://telegra.ph/file/b545f448e658141445b2b.jpg')
                    
                    const menuText = `⚙️ *RUSSO-BOT V-SUPREMA*\n\n` +
                                     `👤 *User:* ${pushname}\n` +
                                     `🆙 *Nível:* ${db.usuarios[sender].level}\n\n` +
                                     `🛡️ *ADMIN:* !marcar, !ban, !tempo\n` +
                                     `🎵 *MEDIA:* !play, !video, !perfil\n` +
                                     `🎮 *ZUEIRA:* !gay, !corno\n\n` +
                                     `🇷🇺 _Hospedado 24h na Nuvem_`
                    
                    await sock.sendMessage(remoteJid, { image: { url: botPpUrl }, caption: menuText })
                    break

                case 'play':
                    if (!q) return
                    const sPlay = await yts(q); const vPlay = sPlay.videos[0]
                    if (vPlay) {
                        await sock.sendMessage(remoteJid, { text: `🎵 *Baixando MP3:* ${vPlay.title}` })
                        const pPlay = `./${vPlay.videoId}.mp3`
                        ytdl(vPlay.url, { filter: 'audioonly' }).pipe(fs.createWriteStream(pPlay)).on('finish', async () => {
                            await sock.sendMessage(remoteJid, { audio: { url: pPlay }, mimetype: 'audio/mp4' })
                            fs.unlinkSync(pPlay)
                        })
                    }
                    break

                case 'perfil':
                    const pUrl = await sock.profilePictureUrl(sender, 'image').catch(() => 'https://telegra.ph/file/b545f448e658141445b2b.jpg')
                    const pStatus = `👤 *NOME:* ${pushname}\n🆙 *LEVEL:* ${db.usuarios[sender].level}\n✨ *XP:* ${db.usuarios[sender].xp}`
                    await sock.sendMessage(remoteJid, { image: { url: pUrl }, caption: pStatus })
                    break

                case 'marcar':
                    const gMar = await sock.groupMetadata(remoteJid)
                    const mMar = gMar.participants.map(p => p.id)
                    await sock.sendMessage(remoteJid, { text: `📢 *CHAMADA GERAL:* \n\n${q}`, mentions: mMar })
                    break

                case 'ban':
                    const gBan = await sock.groupMetadata(remoteJid)
                    const botAdmin = gBan.participants.find(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net')?.admin !== null
                    if (!botAdmin) return
                    const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0]
                    if (mention) await sock.groupParticipantsUpdate(remoteJid, [mention], 'remove')
                    break
            }
        }
    })
}

startRussoBot()
