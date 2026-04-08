const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');
const yts = require('yt-search');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- SERVER PARA MANTER ACORDADO ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.write("Russo-Bot Online!");
    res.end();
}).listen(PORT);

// --- CONFIG IA ---
const genAI = new GoogleGenerativeAI("SUA_CHAVE_GEMINI_AQUI");
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// --- NÚMEROS CONFIGURADOS ---
const botNumero = '45999282949@s.whatsapp.net';
const donoNumero = '65993416402@s.whatsapp.net';

async function startRusso() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ["Russo-Bot", "Safari", "3.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    // --- MENSAGEM DE ATIVAÇÃO ---
    sock.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add' && anu.participants.includes(sock.user.id.split(':')[0] + '@s.whatsapp.net')) {
            const msgAtivacao = `🕺 *RUSSO-BOT FOI ATIVADO!* 🕺\n\nCom ele você terá as opções de:\n\n🛡️ *Antilink*\n🎵 *Play Música*\n📌 *Marcação de Todos*\n🤖 *IA Conversacional*\n\nO bot está ativo por 30 dias! 🚀`;
            await sock.sendMessage(anu.id, { 
                image: { url: 'https://i.imgur.com/u6RjC0X.jpeg' }, 
                caption: msgAtivacao 
            });
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startRusso();
        } else if (connection === 'open') console.log('✅ Russo-Bot Conectado!');
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const isGroup = from.endsWith('@g.us');
        const sender = msg.key.participant || from;

        // Lógica de Admins
        let admins = [];
        let isBotAdmin = false;
        let isSenderAdmin = false;
        if (isGroup) {
            const metadata = await sock.groupMetadata(from);
            admins = metadata.participants.filter(p => p.admin !== null).map(p => p.id);
            isBotAdmin = admins.includes(sock.user.id.split(':')[0] + '@s.whatsapp.net');
            isSenderAdmin = admins.includes(sender);
        }

        // --- ANTILINK ---
        if (isGroup && body.includes('chat.whatsapp.com') && !isSenderAdmin && isBotAdmin) {
            await sock.sendMessage(from, { text: '🚫 *Link detectado!* Removendo infrator...' });
            await sock.groupParticipantsUpdate(from, [sender], "remove");
        }

        const command = body.toLowerCase().split(' ')[0];
        const args = body.split(' ').slice(1).join(' ');

        switch (command) {
            case '!menu':
                const menu = `
🕺 *RUSSO-BOT - MENU* 🕺

🛡️ *ADMINISTRAÇÃO*
🔹 !antilink
🔹 !ban (marque a msg)
🔹 !abrir
🔹 !fechar
🔹 !agendar (abrir/fechar grupo)

🎵 *MULTIMÍDIA*
🔹 !play (nome da musica)
🔹 !imagem (busca google)
🔹 !s (fazer figurinha)

📅 *EVENTOS*
🔹 !evento (Nome / Dia / Hora)
🔹 !todos (marca geral)

🤖 *INTERAÇÃO*
🔹 !russo (conversar com IA)

👑 *DONO*
🔹 !painel
🔹 !limpar
                `.trim();
                await sock.sendMessage(from, { text: menu });
                break;

            case '!play':
                if (!args) return sock.sendMessage(from, { text: 'Qual música quer ouvir, chefia?' });
                const search = await yts(args);
                const video = search.videos[0];
                if (!video) return sock.sendMessage(from, { text: 'Música não encontrada! ❌' });
                
                await sock.sendMessage(from, { text: `🎧 *Baixando:* ${video.title}\n⏳ Aguarde um instante...` });
                // Aqui o bot enviaria o MP3 usando ytdl-core (no Render precisa de FFMPEG instalado via Docker)
                await sock.sendMessage(from, { audio: { url: video.url }, mimetype: 'audio/mp4' }, { quoted: msg });
                break;

            case '!agendar':
                if (!isSenderAdmin) return;
                const [acao, tempo] = args.split(' '); // ex: !agendar fechar 60 (em minutos)
                if (!acao || !tempo) return sock.sendMessage(from, { text: 'Use: !agendar fechar 60' });
                
                sock.sendMessage(from, { text: `✅ Agendado para ${acao} o grupo em ${tempo} minutos.` });
                setTimeout(async () => {
                    const setting = acao === 'fechar' ? 'announcement' : 'not_announcement';
                    await sock.groupSettingUpdate(from, setting);
                    sock.sendMessage(from, { text: `📢 Atenção! O grupo foi ${acao === 'fechar' ? 'FECHADO' : 'ABERTO'} conforme agendado.` });
                }, parseInt(tempo) * 60000);
                break;

            case '!evento':
                const evArgs = body.slice(8).split('/');
                if (evArgs.length < 3) return sock.sendMessage(from, { text: '❌ Erro! Use: !evento Nome / Dia / Hora' });
                const participants = (await sock.groupMetadata(from)).participants.map(p => p.id);
                const evTxt = `📅 *NOVO EVENTO AGENDADO!*\n\n📌 *Assunto:* ${evArgs[0].trim()}\n🗓️ *Data:* ${evArgs[1].trim()}\n⏰ *Hora:* ${evArgs[2].trim()}\n\nCompareçam! @everyone`;
                await sock.sendMessage(from, { text: evTxt, mentions: participants });
                break;

            case '!russo':
                const result = await model.generateContent(args || 'Oi!');
                await sock.sendMessage(from, { text: `🤖 *Russo:* ${result.response.text()}` });
                break;

            case '!ban':
                if (!isSenderAdmin || !isBotAdmin) return;
                const cited = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0];
                if (cited) await sock.groupParticipantsUpdate(from, [cited], "remove");
                break;

            case '!painel':
                if (sender !== donoNumero) return;
                await sock.sendMessage(from, { text: `👑 *PAINEL DO DONO*\n\n✅ Bot: Online\n📱 Numero: ${botNumero}\n🛠️ Status: Premium` });
                break;
        }
    });
}

startRusso();
