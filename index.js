const express = require('express');
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Russo-Bot Online!'));
app.listen(port, () => console.log(`Monitorando porta ${port}`));

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

// ================= CONFIGURAÇÃO =================
const ownerNumber = '5565993416402@s.whatsapp.net' 
const botPhoneNumber = '5545999282949' 
const prefix = '!'
// ================================================

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
        browser: ['Russo-Bot', 'Chrome', '1.0.0'],
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
            console.log('✅ [RUSSO-BOT]: CONECTADO E PRONTO PARA VENDAS!')
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
        const args = text.trim().split(/ +/).slice(1)
        const q = args.join(" ")

        const db = getDb()
        const isOwner = sender.includes('5565993416402')
        const isVip = db.aluguel[remoteJid] ? true : false
        
        // --- SISTEMA DE ANTILINK ---
        if (isGroup && isVip && text.includes('chat.whatsapp.com/')) {
            if (!isOwner) {
                await sock.sendMessage(remoteJid, { delete: msg.key })
                return sock.sendMessage(remoteJid, { text: `🚫 *ANTILINK:* Divulgação proibida aqui, @${sender.split('@')[0]}!`, mentions: [sender] })
            }
        }

        if (text.startsWith(prefix)) {
            const command = text.slice(1).split(' ')[0]

            // COMANDO DE ATIVAÇÃO (SÓ VOCÊ)
            if (command === 'ativar' && isOwner) {
                const dias = parseInt(args[0]) || 30
                const expira = Date.now() + (dias * 24 * 60 * 60 * 1000)
                db.aluguel[remoteJid] = { expira }
                saveDb(db)
                return sock.sendMessage(remoteJid, { text: `✅ *GRUPO ATIVADO!*\n\n👑 *Dono:* @${sender.split('@')[0]}\n📅 *Validade:* ${dias} dias\n🚀 *Status:* Russo-Bot Liberado!`, mentions: [sender] })
            }

            // TRAVA DE SEGURANÇA PARA GRUPOS NÃO PAGOS
            if (isGroup && !isVip && !isOwner) return

            switch (command) {
                case 'menu':
                    const data = moment.tz('America/Cuiaba').format('DD/12/YYYY')
                    const hora = moment.tz('America/Cuiaba').format('HH:mm:ss')
                    const validade = isVip ? moment(db.aluguel[remoteJid].expira).format('DD/MM HH:mm') : 'N/A'
                    
                    const botPp = await sock.profilePictureUrl(sock.user.id.split(':')[0] + '@s.whatsapp.net', 'image').catch(() => 'https://telegra.ph/file/b545f448e658141445b2b.jpg')

                    const menuTxt = `┏━━━〔 🇷🇺 *RUSSO-BOT* 〕━━━┓
┃
┃ 👤 *Olá:* ${pushname}
┃ 📅 *Data:* ${data}
┃ 🕒 *Hora:* ${hora}
┃ 🛡️ *Status:* ${isVip ? '💎 VIP' : '❌ FREE'}
┃ ⏳ *Expira:* ${validade}
┃
┣━━〔 🛠️ *ADMINISTRAÇÃO* 〕
┃
┃ 🔹 *!marcar* [texto]
┃ 🔹 *!ban* [marque alguém]
┃ 🔹 *!limpar* (apaga msgs)
┃ 🔹 *!infogrupo* (dados)
┃
┣━━〔 🎵 *ENTRETENIMENTO* 〕
┃
┃ 🔹 *!play* [nome da música]
┃ 🔹 *!video* [nome do vídeo]
┃ 🔹 *!perfil* (suas infos)
┃ 🔹 *!gay* (zueira)
┃ 🔹 *!corno* (zueira)
┃
┣━━〔 💰 *SISTEMA VIP* 〕
┃
┃ 🔹 *!ativar* [dias] (Dono)
┃ 🔹 *!tempo* (ver validade)
┃ 🔹 *!pix* (pagamento)
┃
┗━━━━━━━━━━━━━━━┛
🇷🇺 _Gestão de Grupos & Vendas_`

                    await sock.sendMessage(remoteJid, { image: { url: botPp }, caption: menuTxt })
                    break

                case 'marcar':
                    const metadata = await sock.groupMetadata(remoteJid)
                    const participants = metadata.participants.map(p => p.id)
                    await sock.sendMessage(remoteJid, { text: `📢 *CHAMADA GERAL:* \n\n${q || 'Atenção membros!'}`, mentions: participants })
                    break

                case 'ban':
                    if (!isGroup) return
                    const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0]
                    if (!mention) return sock.sendMessage(remoteJid, { text: '❌ Marque o infrator!' })
                    await sock.groupParticipantsUpdate(remoteJid, [mention], 'remove')
                    break

                case 'pix':
                    await sock.sendMessage(remoteJid, { text: `💰 *PAGAMENTO VIP:*\n\nChave Pix: *SEU-EMAIL-OU-CELULAR-AQUI*\nValor: R$ 30,00 / Mês\n\n_Envie o comprovante para o dono para ativar!_` })
                    break
            }
        }
    })
}

startRussoBot()
