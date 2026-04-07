const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('RUSSO ON 🇷🇺'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys')
const pino = require('pino')

async function startRussoBot() {
    // SESSÃO TOTALMENTE LIMPA
    const { state, saveCreds } = await useMultiFileAuthState('sessao_v10_final')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        // FINGINDO SER UM CELULAR ANDROID (MAIS SEGURO)
        browser: ['Android', 'Chrome', '11.0.0']
    })

    if (!sock.authState.creds.registered) {
        console.log("⏳ ESTABILIZANDO... AGUARDE 20 SEGUNDOS...");
        setTimeout(async () => {
            try {
                // TENTAREMOS O FORMATO PADRÃO DO PARANÁ
                let code = await sock.requestPairingCode('5545999282949');
                console.log('\n\n🇷🇺 [NOVO CÓDIGO]: ' + code + '\n\n');
            } catch (e) {
                console.log('❌ Erro. Dê Clear Cache na Render.');
            }
        }, 20000); 
    }

    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log('✅ CONECTADO!');
        if (u.connection === 'close') startRussoBot();
    })
}
startRussoBot()
