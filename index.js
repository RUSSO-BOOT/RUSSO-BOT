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
    // NOVA SESSÃO PARA LIMPAR O ERRO DE CÓDIGO ANTERIOR
    const { state, saveCreds } = await useMultiFileAuthState('sessao_resgate_45')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Mac OS', 'Safari', '10.15.7']
    })

    if (!sock.authState.creds.registered) {
        console.log("⏳ ESTABILIZANDO CONEXÃO... AGUARDE 20 SEGUNDOS...");
        setTimeout(async () => {
            try {
                // VAMOS TENTAR COM O 9 (PADRÃO BRASIL)
                let code = await sock.requestPairingCode('5545999282949');
                console.log('\n\n🇷🇺 [DIGITE ESTE CÓDIGO NO CELULAR]: ' + code + '\n\n');
            } catch (e) {
                console.log('❌ O ZAP RECUSOU. DÊ UM CLEAR CACHE NA RENDER.');
            }
        }, 20000); 
    }

    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log('✅ CONECTADO! ME AVISA AQUI!');
        if (u.connection === 'close') startRussoBot();
    })
}
startRussoBot()
