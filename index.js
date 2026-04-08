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

// --- SERVER PARA MANTER O BOT ACORDADO (RENDER) ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.write("Russo-Bot Online e Operante!");
    res.end();
}).listen(PORT);

// --- CONFIGURAÇÃO DA IA (GEMINI) ---
const genAI = new GoogleGenerativeAI("SUA_CHAVE_GEMINI_AQUI");
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// --- CONFIGURAÇÃO DE NÚMEROS ---
const botNumero = '5545999282949'; // Número do bot com DDI
const donoNumero = '5565993416402@s.whatsapp.net'; // Número do dono

async function startRusso() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"], // Necessário para Pairing Code
        printQRInTerminal: false
    });

    // --- SOLICITAÇÃO DO PAIRING CODE (CÓDIGO DE CONEXÃO) ---
    if (!sock.authState.creds.registered) {
        console.log("🟡 Aguardando 5 segundos para gerar o código...");
        await delay(5000);
        let code = await sock.requestPairingCode(botNumero);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log(`\n\n🔹 SEU CÓDIGO DE CONEXÃO: ${code}\n\n`);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startRusso();
        } else if (connection === 'open') {
            console.log('✅ Russo-Bot Conectado com Sucesso!');
        }
    });

    // --- MENSAGEM DE ATIVAÇÃO AO ENTRAR NO GRUPO ---
    sock.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add' && anu.participants.includes(sock.user.id.split(':')[0] + '@s.whatsapp.net')) {
            const msgAtivacao = `🕺 *RUSSO-BOT FOI ATIVADO!* 🕺\n\nEste bot ficará ativo por 30 dias!\n\nCom ele você terá as opções de:\n🔹 antilink\n🔹 play\n🔹 marcação de todos\n\nDigite *!menu* para começar! 🚀`;
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
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const isGroup = from.endsWith('@g.us');
        const sender = msg.key.participant || from;

        // Lógica de Admins
        let admins = [];
        let isBotAdmin = false;
        let isSenderAdmin = false;
        if (isGroup) {
            try {
                const metadata = await sock.groupMetadata(from);
                admins = metadata.participants.filter(p => p.admin !== null).map(p => p.id);
                isBotAdmin = admins.includes(sock.user.id.split(':')[0] + '@s.whatsapp.net');
                isSenderAdmin = admins.includes(sender);
            } catch (e) { }
        }

        // --- ANTILINK (BAN IMEDIATO) ---
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
🔹 !antilink - Ativa bloqueio de links
🔹 !ban - Remove membro (marque a msg)
🔹 !abrir - Abre o grupo
🔹 !fechar - Fecha o grupo
🔹 !agendar - Agendar abertura/fechamento

🎵 *MULTIMÍDIA*
🔹 !play - Baixar música (YouTube)
🔹 !s - Criar figurinha rápida
🔹 !imagem - Pesquisar foto Google

📅 *EVENTOS*
🔹 !evento - Nome / Dia / Hora
🔹 !todos - Marcar todos do grupo

🤖 *INTELIGÊNCIA*
🔹 !russo - Conversar com a IA Russo

👑 *DONO*
🔹 !painel - Status do sistema
🔹 !limpar - Limpar o chat
                `.trim();
                await sock.sendMessage(from, { text: menu });
                break;

            case '!play':
                if (!args) return sock.sendMessage(from, { text: 'Qual música você quer ouvir?' });
                const search = await yts(args);
                const video = search.videos[0];
                if (!video) return sock.sendMessage(from, { text: 'Música não encontrada! ❌' });
                await sock.sendMessage(from, { text: `🎧 *Baixando:* ${video.title}\n⏳ Aguarde um instante...` });
                await sock.sendMessage(from, { audio: { url: video.url }, mimetype: 'audio/mp4' }, { quoted: msg });
                break;

            case '!evento':
                const evArgs = body.slice(8).split('/');
                if (evArgs.length < 3) return sock.sendMessage(from, { text: '❌ Erro! Use: !evento Nome / Dia / Hora' });
                const metadata = await sock.groupMetadata(from);
                const participants = metadata.participants.map(p => p.id);
                const evTxt = `📅 *NOVO EVENTO AGENDADO!*\n\n📌 *Assunto:* ${evArgs[0].trim()}\n🗓️ *Data:* ${evArgs[1].trim()}\n⏰ *Hora:* ${evArgs[2].trim()}\n\nCompareçam! @everyone`;
                await sock.sendMessage(from, { text: evTxt, mentions: participants });
                break;

            case '!todos':
                if (!isSenderAdmin) return;
                const groupMem = await sock.groupMetadata(from);
                const mentionIds = groupMem.participants.map(p => p.id);
                await sock.sendMessage(from, { text: `📢 *CHAMADA GERAL:* \n\n${args || 'Atenção membros!'}`, mentions: mentionIds });
                break;

            case '!russo':
                if (!args) return;
                try {
                    const result = await model.generateContent(args);
                    await sock.sendMessage(from, { text: `🤖 *Russo IA:* ${result.response.text()}` });
                } catch (e) {
                    await sock.sendMessage(from, { text: '❌ IA ocupada, tente mais tarde.' });
                }
                break;

            case '!agendar':
                if (!isSenderAdmin) return;
                const [acao, tempo] = args.split(' ');
                if (!acao || !tempo) return sock.sendMessage(from, { text: 'Use: !agendar fechar 60' });
                sock.sendMessage(from, { text: `✅ Agendado para ${acao} em ${tempo} minutos.` });
                setTimeout(async () => {
                    await sock.groupSettingUpdate(from, acao === 'fechar' ? 'announcement' : 'not_announcement');
                    sock.sendMessage(from, { text: `📢 Grupo ${acao === 'fechar' ? 'FECHADO' : 'ABERTO'} automaticamente.` });
                }, parseInt(tempo) * 60000);
                break;

            case '!painel':
                if (sender !== donoNumero) return;
                await sock.sendMessage(from, { text: `👑 *PAINEL DO DONO*\n\n✅ Status: Online\n🔋 Host: Render\n💎 Aluguel: Ativo` });
                break;
        }
    });
}

startRusso();
