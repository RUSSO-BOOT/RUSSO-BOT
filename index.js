const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('🇷🇺 RUSSO-BOT OPERACIONAL'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

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

// CONFIGURAÇÃO - SEU NÚMERO
const ownerNumber = '5565993416402@s.whatsapp.net' 

// BANCO DE DADOS
if (!fs.existsSync('./database.json')) fs.writeFileSync('./database.json', JSON.stringify({ aluguel: {}, usuarios: {} }))
const getDb = () => JSON.parse(fs.readFileSync('./database.json'))
const saveDb = (db) => fs.writeFileSync('./database.json', JSON.stringify(db, null, 2))

async function startRussoBot() {
    // MANTEMOS A SESSÃO QUE JÁ ESTÁ LOGADA!
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
            console.log('✅ [RUSSO-BOT]: SISTEMA FULL OPERACIONAL!')
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
        const isOwner = sender.includes('5565993416402')

        const db = getDb()

        // RESPOSTA NO PV PRO DONO
        if (!isGroup && isOwner && text === 'oi') {
            return sock.sendMessage(remoteJid, { text: `🇷🇺 *FALA MEU CHEFE!* O Russo tá na base. O que manda hoje?` })
        }

        // COMANDO DE ATIVAÇÃO (SÓ VOCÊ)
        if (text.startsWith('!ativar') && isOwner) {
            const dias = parseInt(text.split(' ')[1]) || 30
            db.aluguel[remoteJid] = { expira: Date.now() + (dias * 24 * 60 * 60 * 1000) }
            saveDb(db)
            return sock.sendMessage(remoteJid, { text: `🇷🇺 *SISTEMA:* Grupo ativado com sucesso por ${dias} dias!` })
        }

        // MENU COMPLETO COM FORMATO QUE COMBINAMOS
        if (text === '!menu') {
            if (db.aluguel[remoteJid] || isOwner) {
                const data = moment.tz('America/Cuiaba').format('DD/MM')
                const hora = moment.tz('America/Cuiaba').format('HH:mm')
                
                // PEGA A FOTO DO BOT OU UMA PADRÃO
                const botPp = await sock.profilePictureUrl(sock.user.id.split(':')[0] + '@s.whatsapp.net', 'image').catch(() => 'https://telegra.ph/file/b545f448e658141445b2b.jpg')

                const menuTxt = `┏━━━〔 🇷🇺 *RUSSO-BOT* 〕━━━┓
┃
┃ 👤 *User:* ${pushname}
┃ 🕒 *Hora:* ${hora} | *Data:* ${data}
┃ 🛡️ *Status:* VIP / ATIVO
┃
┣━━〔 🛠️ *COMANDOS* 〕
┃ 🔹 !marcar (Marcar todos)
┃ 🔹 !play (Baixar música)
┃ 🔹 !ban (Remover membro)
┃ 🔹 !pix (Dados de pagamento)
┃ 🔹 !infogrupo (Ver validade)
┃
┗━━━━━━━━━━━━━━━┛`
                
                await sock.sendMessage(remoteJid, { 
                    image: { url: botPp }, 
                    caption: menuTxt 
                })
            } else {
                await sock.sendMessage(remoteJid, { text: "❌ *ERRO:* Grupo não ativado. Peça ao @5565993416402 para ativar." }, { mentions: [ownerNumber] })
            }
        }
    })
}

startRussoBot()
