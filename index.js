const express = require('express');
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('BOT ONLINE'));
app.listen(port, '0.0.0.0', () => console.log(`Porta: ${port}`));

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const pino = require('pino')

async function startRussoBot() {
    // MUDEI O NOME AQUI PARA 'sessao_definitiva' PARA FORÇAR O RESET
    const { state, saveCreds } = await useMultiFileAuthState('sessao_definitiva')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '110.0.5481.177'],
        printQRInTerminal: false
    })

    // GERA O CÓDIGO DE 8 DÍGITOS
    if (!sock.authState.creds.registered) {
        console.log("⏳ SOLICITANDO NOVO CÓDIGO... AGUARDE...");
        setTimeout(async () => {
            try {
                // Tenta com o 9 extra (Paraná/Cuiabá)
                let code = await sock.requestPairingCode('5545999282949')
                console.log('\n\n🇷🇺 [SEU CÓDIGO]: ' + code + '\n\n')
            } catch (err) {
                console.log('❌ ERRO: Dê um "Clear Build Cache" na Render.');
            }
        }, 10000) 
    }

    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u
        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
            if (reason !== DisconnectReason.loggedOut) startRussoBot()
        } else if (connection === 'open') {
            console.log('✅ BOT CONECTADO E ATIVO!')
        }
    })
}
startRussoBot()
