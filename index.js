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
    // MUDAMOS PARA 'sessao_final_ouro' PARA ZERAR O ERRO DE CÓDIGO INCORRETO
    const { state, saveCreds } = await useMultiFileAuthState('sessao_final_ouro')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Mac OS', 'Safari', '10.15.7']
    })

    if (!sock.authState.creds.registered) {
        console.log("⏳ AGUARDANDO 15 SEGUNDOS PARA GERAR OS CÓDIGOS...");
        setTimeout(async () => {
            try {
                // OPÇÃO 1: COM O 9
                let code1 = await sock.requestPairingCode('5545999282949');
                console.log('\n🇷🇺 [OPÇÃO 1 - COM 9]: ' + code1);

                // OPÇÃO 2: SEM O 9 (TENTA ESSA PRIMEIRO!)
                let code2 = await sock.requestPairingCode('554599282949');
                console.log('🇷🇺 [OPÇÃO 2 - SEM 9]: ' + code2 + '\n');
            } catch (e) {
                console.log('❌ Erro. Dê um "Clear Build Cache" na Render.');
            }
        }, 15000); 
    }

    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log('✅ AGORA FOI! BOT ONLINE!');
        if (u.connection === 'close') startRussoBot();
    })
}
startRussoBot()
