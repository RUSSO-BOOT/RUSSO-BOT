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

// === CONFIGURAÇÃO DO DONO (SEU NÚMERO MESTRE) ===
const ownerNumber = '5565993416402@s.whatsapp.net' 

// BANCO DE DADOS DE ALUGUEL
if (!fs.existsSync('./aluguel.json')) fs.writeFileSync('./aluguel.json', JSON.stringify({}))
const getDb = () => JSON.parse(fs.readFileSync('./aluguel.json'))
const saveDb = (db) => fs.writeFileSync('./aluguel.json', JSON.stringify(db, null, 2))

async function startRussoBot() {
    console.log('🇷🇺 [SISTEMA]: Iniciando motores do Russo-Bot...')
    
    // Pasta que guarda o login (sessao_russo)
    const { state, saveCreds } = await useMultiFileAuthState('sessao_russo')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        // Identidade de navegador para evitar bloqueios do WhatsApp
        browser: ['Ubuntu', 'Chrome', '110.0.5481.177'],
        printQRInTerminal: false
    })

    sock.ev.on('creds.update', saveCreds)

    // MONITOR DE CONEXÃO E QR CODE
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update
        
        if (qr) {
            console.log('🇷🇺 [QR CODE]: ESCANEIE PARA CONECTAR!')
            qrcode.generate(qr, { small: true })
        }

        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
            const shouldReconnect = reason !== DisconnectReason.loggedOut
            console.log(`🔄 Conexão fechada (Motivo: ${reason}). Tentando reconectar...`)
            if (shouldReconnect) startRussoBot()
        } else if (connection === 'open') {
            console.log('✅ [SUCESSO]: RUSSO-BOT CONECTADO E OPERANTE!')
        }
    })

    // MONITOR DE ENTRADA (ANTI-FAKE / GRINGOS)
    sock.ev.on('group-participants.update', async (update) => {
        const { id, participants, action } = update
        const db = getDb()
        
        // Só remove gringo se o grupo estiver com aluguel ativo
        if (action === 'add' && db[id]) {
            for (let num of participants) {
                if (!num.startsWith('55')) { 
                    await sock.sendMessage(id, { text: `🛡️ *ANTI-FAKE:* Removendo gringo @${num.split('@')[0]}`, mentions: [num] })
                    await sock.groupParticipantsUpdate(id, [num], 'remove')
                }
            }
        }
    })

    // MONITOR DE MENSAGENS (COMANDOS)
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0]
        if (!msg.message || msg.key.fromMe) return

        const remoteJid = msg.key.remoteJid
        const isGroup = remoteJid.endsWith('@g.us')
        const sender = msg.key.participant || msg.key.remoteJid
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").toLowerCase()

        const db = getDb()
        const isVip = db[remoteJid] ? true : false
        const agora = new Date().getTime()
        const isOwner = sender === ownerNumber

        // --- ANTI-LINK (APAGA SE NÃO FOR ADMIN OU DONO) ---
        if (isGroup && isVip && text.includes('chat.whatsapp.com/')) {
            const groupMeta = await sock.groupMetadata(remoteJid)
            const senderAdmin = groupMeta.participants.find(p => p.id === sender)?.admin !== null
            if (!senderAdmin && !isOwner) {
                await sock.sendMessage(remoteJid, { delete: msg.key })
                await sock.sendMessage(remoteJid, { text: `🚫 *ANTI-LINK:* @${sender.split('@')[0]}, links são proibidos!`, mentions: [sender] })
            }
        }

        // --- PROCESSAMENTO DE COMANDOS ---
        if (text.startsWith('!')) {
            const args = text.slice(1).split(' ')
            const command = args.shift()
            const q = args.join(' ')

            // COMANDO DE ATIVAÇÃO (SÓ VOCÊ PODE USAR NO GRUPO DO CLIENTE)
            if (command === 'ativar' && isOwner && isGroup) {
                const dias = parseInt(args[0]) || 30
                db[remoteJid] = { expira: agora + (dias * 24 * 60 * 60 * 1000) }
                saveDb(db)
                return sock.sendMessage(remoteJid, { text: `🇷🇺 *SISTEMA ATIVADO:* Grupo liberado por ${dias} dias.` })
            }

            // TRAVA DE SEGURANÇA: SÓ RESPONDE SE TIVER ALUGUEL OU FOR O DONO
            if (isGroup && !isVip && !isOwner) return

            switch (command) {
                case 'menu':
                    const painel = `⚙️ *RUSSO-BOT: GESTÃO DE ELITE*\n\n` +
                                 `👑 *DONO:* !ativar [dias]\n` +
                                 `⏳ *STATUS:* !tempo\n` +
                                 `🎵 *MUSICA:* !play [nome]\n` +
                                 `📢 *CHAMADA:* !marcar [aviso]\n` +
                                 `🚫 *BANIR:* !ban [marcar membro]\n\n` +
                                 `🇷🇺 _Domine o jogo ou seja jogado._`
                    await sock.sendMessage(remoteJid, { text: painel })
                    break

                case 'tempo':
                    const resta = db[remoteJid].expira - agora
                    const d = Math.floor(resta / (1000 * 60 * 60 * 24))
                    const h = Math.floor((resta % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
                    await sock.sendMessage(remoteJid, { text: `⏳ *LICENÇA:* Restam *${d} dias* e *${h} horas*.` })
                    break

                case 'play':
                    if (!q) return sock.sendMessage(remoteJid, { text: '❌ Digite o nome da música!' })
                    try {
                        const search = await yts(q)
                        const video = search.videos[0]
                        if (!video) return sock.sendMessage(remoteJid, { text: '❌ Música não encontrada.' })
                        
                        await sock.sendMessage(remoteJid, { text: `🎵 *Baixando:* ${video.title}\n⏳ _Aguarde o envio..._` })
                        const path = `./${video.videoId}.mp3`
                        
                        ytdl(video.url, { filter: 'audioonly' })
                            .pipe(fs.createWriteStream(path))
                            .on('finish', async () => {
                                await sock.sendMessage(remoteJid, { audio: { url: path }, mimetype: 'audio/mp4' })
                                fs.unlinkSync(path)
                            })
                    } catch (e) {
                        await sock.sendMessage(remoteJid, { text: '❌ Erro ao processar áudio.' })
                    }
                    break

                case 'marcar':
                    const meta = await sock.groupMetadata(remoteJid)
                    const isAdmin = meta.participants.find(p => p.id === sender)?.admin !== null
                    if (!isAdmin && !isOwner) return
                    const mends = meta.participants.map(p => p.id)
                    await sock.sendMessage(remoteJid, { text: `📢 *CHAMADA GERAL:* \n\n${q || 'Atenção!'}`, mentions: mends })
                    break

                case 'ban':
                    const gMeta = await sock.groupMetadata(remoteJid)
                    const botAdmin = gMeta.participants.find(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net')?.admin !== null
                    const sAdmin = gMeta.participants.find(p => p.id === sender)?.admin !== null
                    if (!sAdmin && !isOwner) return
                    if (!botAdmin) return sock.sendMessage(remoteJid, { text: '❌ Preciso ser Admin para banir.' })
                    
                    const mention = m.messages[0].message.extendedTextMessage?.contextInfo?.mentionedJid[0]
                    if (!mention) return sock.sendMessage(remoteJid, { text: '❌ Marque o membro para banir.' })
                    await sock.groupParticipantsUpdate(remoteJid, [mention], 'remove')
                    break
            }
        }
    })
}

startRussoBot().catch(e => console.log("ERRO CRÍTICO:", e))
