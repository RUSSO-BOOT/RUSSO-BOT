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
    // MUDAMOS O NOME AQUI PARA RESETAR TUDO E GERAR NOVO CÓDIGO
    const { state, saveCreds } = await useMultiFileAuthState('sessao_v5_ouro')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Mac OS', 'Safari', '10.15.7']
    })

    if (!sock.authState.creds.registered) {
        console.log("⏳ AGUARDANDO PARA GERAR O CÓDIGO NOVO...");
        setTimeout(async () => {
            try {
                // FOQUE NO SEU NÚMERO 45 SEM O 9 (OPÇÃO MAIS FORTE)
                const code = await sock.requestPairingCode('554599282949');
                console.log('\n\n🇷🇺 [NOVO CÓDIGO]: ' + code + '\n\n');
            } catch (e) {
                console.log('❌ ERRO. DÊ RESTART NA RENDER.');
            }
        }, 15000); 
    }

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u
        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
            if (reason !== DisconnectReason.loggedOut) startRussoBot()
        } else if (connection === 'open') {
            console.log('✅ [SISTEMA]: CONECTADO COM SUCESSO!');
        }
    })

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0]
        if (!msg.message || msg.key.fromMe) return
        const remoteJid = msg.key.remoteJid
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase()
        
        // TESTE RÁPIDO
        if (text === 'oi') {
            await sock.sendMessage(remoteJid, { text: '🇷🇺 *ESTOU VIVO!* Pode mandar os comandos.' })
        }
    })
}

startRussoBot()
