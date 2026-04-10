const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    delay
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');
const yts = require('yt-search');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- SERVER PING (PARA O RENDER NÃO DORMIR) ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.write("Russo Online!"); res.end(); }).listen(PORT);

// --- CONFIGURAÇÃO IA GEMINI ---
const GEN_AI_KEY = "AIzaSyANCttvDMK4sJOLQWlkbu6OeobJO3prW9o"; 
const genAI = new GoogleGenerativeAI(GEN_AI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// --- CONFIGURAÇÃO DE NÚMEROS ---
const botNumero = '5545999282949'; 
const donoFormatos = ['5565993416402', '556593416402']; // Reconhece com e sem o 9

async function startRusso() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        // AJUSTADO: Agora simulando um Mac com Safari para conexão estável
        browser: ["Mac OS", "Safari", "15.0"], 
        printQRInTerminal: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
    });

    // --- PAIRING CODE (CÓDIGO DE 8 DÍGITOS) ---
    if (!sock.authState.creds.registered) {
        console.log("🟡 Preparando conexão Apple Safari...");
        await delay(10000); 
        try {
            let code = await sock.requestPairingCode(botNumero);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`\n\n🔹 SEU CÓDIGO DE CONEXÃO: ${code}\n\n`);
        } catch (e) { 
            console.log("❌ Erro ao gerar código. Tentando novamente...");
            setTimeout(startRusso, 5000);
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') console.log('✅ Russo-Bot Conectado (Simulação Mac)!');
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startRusso();
        }
    });

    // --- MENSAGEM DE ATIVAÇÃO ---
    sock.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add' && anu.participants.includes(sock.user.id.split(':')[0] + '@s.whatsapp.net')) {
            const msgAtivacao = `🕺 *RUSSO-BOT FOI ATIVADO!* 🕺\n\nrusso-bot foi ativado por 30 dias, com ele voce tera as opções de antilink play marcação de todos\n\nDigite *!menu* para ver tudo! 🚀`;
            await sock.sendMessage(anu.id, { 
                image: { url: 'https://i.imgur.com/u6RjC0X.jpeg' }, 
                caption: msgAtivacao 
            });
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const isGroup = from.endsWith('@g.us');
        const isOwner = donoFormatos.some(num => sender.includes(num));

        const command = body.toLowerCase().split(' ')[0];
        const args = body.split(' ').slice(1).join(' ');

        // --- LÓGICA ADMIN ---
        let isBotAdmin = false;
        let isSenderAdmin = false;
        if (isGroup) {
            try {
                const metadata = await sock.groupMetadata(from);
                const admins = metadata.participants.filter(p => p.admin !== null).map(p => p.id);
                isBotAdmin = admins.includes(sock.user.id.split(':')[0] + '@s.whatsapp.net');
                isSenderAdmin = admins.includes(sender);
            } catch (e) {}
        }

        // --- ANTILINK ---
        if (isGroup && body.includes('chat.whatsapp.com') && !isSenderAdmin && isBotAdmin) {
            await sock.sendMessage(from, { text: '🚫 *Link detectado!* Removendo infrator...' });
            await sock.groupParticipantsUpdate(from, [sender], "remove");
        }

        // --- SISTEMA DE COMANDOS ORGANIZADOS ---
        switch (command) {
            case '!menu':
                const menu = `
🕺 *RUSSO-BOT - MENU* 🕺

🛡️ *ADMINISTRAÇÃO*
🔹 !antilink
🔹 !ban
🔹 !abrir
🔹 !fechar
🔹 !agendar

🎵 *DIVERSÃO*
🔹 !play
🔹 !s
🔹 !imagem
🔹 !letra

🤖 *IA RUSSO*
🔹 !russo
🔹 !pergunta

📅 *GRUPO*
🔹 !evento
🔹 !todos
🔹 !regras

🎰 *JOGOS*
🔹 !cassino
🔹 !roleta
🔹 !perfil

👑 *DONO*
🔹 !painel
🔹 !limpar
🔹 !sair
                `.trim();
                await sock.sendMessage(from, { 
                    image: { url: 'https://i.imgur.com/u6RjC0X.jpeg' }, 
                    caption: menu 
                });
                break;

            case '!play':
                if (!args) return sock.sendMessage(from, { text: 'Qual música quer ouvir?' });
                const search = await yts(args);
                const video = search.videos[0];
                if (video) {
                    await sock.sendMessage(from, { text: `🎧 *Baixando:* ${video.title}\n⏳ Enviando como MP3...` });
                    await sock.sendMessage(from, { audio: { url: video.url }, mimetype: 'audio/mp4' }, { quoted: msg });
                }
                break;

            case '!russo':
                if (!args) return;
                try {
                    const result = await model.generateContent(args);
                    await sock.sendMessage(from, { text: `🤖 *Russo:* ${result.response.text()}` });
                } catch (e) { await sock.sendMessage(from, { text: '❌ Erro na IA.' }); }
                break;

            case '!evento':
                const evArgs = body.slice(8).split('/');
                if (evArgs.length < 3) return sock.sendMessage(from, { text: '❌ Use: !evento Nome / Dia / Hora' });
                const metadata = await sock.groupMetadata(from);
                const mentions = metadata.participants.map(p => p.id);
                const txt = `📅 *EVENTO: ${evArgs[0].trim()}*\n🗓️ *DIA:* ${evArgs[1].trim()}\n⏰ *HORA:* ${evArgs[2].trim()}\n\n@everyone Compareçam!`;
                await sock.sendMessage(from, { text: txt, mentions });
                break;

            case '!todos':
                if (!isSenderAdmin && !isOwner) return;
                const grp = await sock.groupMetadata(from);
                const mnts = grp.participants.map(p => p.id);
                await sock.sendMessage(from, { text: `📢 *MARCAÇÃO GERAL*\n\n${args || 'Atenção membros!'}`, mentions: mnts });
                break;

            case '!painel':
                if (!isOwner) return;
                await sock.sendMessage(from, { text: `👑 *PAINEL RUSSO-BOT*\n\n✅ Sistema: Online\n🔋 Host: Apple Safari Simulation\n💎 Dono: Reconhecido` });
                break;
        }
    });
}

startRusso();
