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

// --- CONFIGURAÇÃO IA GEMINI (SUA CHAVE APLICADA) ---
const GEN_AI_KEY = "AIzaSyANCttvDMK4sJOLQWlkbu6OeobJO3prW9o"; 
const genAI = new GoogleGenerativeAI(GEN_AI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// --- CONFIGURAÇÃO DE NÚMEROS ---
const botNumero = '5545999282949'; 
const donoFormatos = ['5565993416402', '556593416402']; // Reconhece você com e sem o 9

async function startRusso() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        printQRInTerminal: false
    });

    // --- PAIRING CODE (CONEXÃO POR CÓDIGO) ---
    if (!sock.authState.creds.registered) {
        console.log("🟡 Gerando Pairing Code em 5 segundos...");
        await delay(5000);
        try {
            let code = await sock.requestPairingCode(botNumero);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`\n\n🔹 SEU CÓDIGO DE CONEXÃO: ${code}\n\n`);
        } catch (e) { console.log("Erro ao gerar código."); }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') console.log('✅ Russo-Bot Conectado e Operante!');
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startRusso();
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

        // --- ANTILINK (BAN IMEDIATO) ---
        if (isGroup && body.includes('chat.whatsapp.com') && !isSenderAdmin && isBotAdmin) {
            await sock.sendMessage(from, { text: '🚫 *Link detectado!* Removendo infrator...' });
            await sock.groupParticipantsUpdate(from, [sender], "remove");
        }

        // --- SISTEMA DE COMANDOS ---
        switch (command) {
            case '!menu':
                const menu = `
🕺 *RUSSO-BOT ATIVADO* 🕺

🛡️ *ADMINISTRAÇÃO*
🔹 !antilink - Info sobre bloqueio
🔹 !ban - Remover (marque a msg)
🔹 !abrir - Abrir o grupo
🔹 !fechar - Fechar o grupo
🔹 !agendar - Marcar hora para abrir/fechar

🎵 *MULTIMÍDIA*
🔹 !play - Baixar música (MP3)
🔹 !s - Criar figurinha rápida
🔹 !imagem - Buscar foto Google
🔹 !letra - Letra de música

🤖 *INTELIGÊNCIA*
🔹 !russo - Conversar com a IA Russo
🔹 !pergunta - Dúvidas rápidas

📅 *ORGANIZAÇÃO*
🔹 !evento - Nome / Dia / Hora
🔹 !todos - Marcar todo o grupo
🔹 !regras - Ver regras do grupo

🎰 *DIVERSÃO*
🔹 !cassino - Tente a sorte no giro
🔹 !roleta - Jogo da roleta russa
🔹 !perfil - Ver seu status

👑 *OPÇÕES DO DONO*
🔹 !painel - Status do Russo
🔹 !limpar - Limpar as mensagens
🔹 !sair - Fazer o bot sair do grupo
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
                    await sock.sendMessage(from, { text: `🎧 *Baixando:* ${video.title}\n⏳ Só um momento...` });
                    await sock.sendMessage(from, { audio: { url: video.url }, mimetype: 'audio/mp4' });
                }
                break;

            case '!russo':
                if (!args) return;
                try {
                    const result = await model.generateContent(args);
                    await sock.sendMessage(from, { text: `🤖 *Russo:* ${result.response.text()}` });
                } catch (e) { await sock.sendMessage(from, { text: '❌ IA indisponível.' }); }
                break;

            case '!evento':
                const evArgs = body.slice(8).split('/');
                if (evArgs.length < 3) return sock.sendMessage(from, { text: '❌ Use: !evento Nome / Dia / Hora' });
                const metadata = await sock.groupMetadata(from);
                const mentions = metadata.participants.map(p => p.id);
                const txt = `📅 *EVENTO AGENDADO!*\n\n📌 *Assunto:* ${evArgs[0].trim()}\n🗓️ *Data:* ${evArgs[1].trim()}\n⏰ *Hora:* ${evArgs[2].trim()}\n\n@everyone`;
                await sock.sendMessage(from, { text: txt, mentions });
                break;

            case '!todos':
                if (!isSenderAdmin && !isOwner) return;
                const groupMem = await sock.groupMetadata(from);
                const allMentions = groupMem.participants.map(p => p.id);
                await sock.sendMessage(from, { text: `📢 *CHAMADA GERAL:* \n\n${args || 'Atenção membros!'}`, mentions: allMentions });
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

            case '!cassino':
                const itens = ['💎', '💰', '🎰', '🔥', '💩'];
                const r1 = itens[Math.floor(Math.random() * itens.length)];
                const r2 = itens[Math.floor(Math.random() * itens.length)];
                const r3 = itens[Math.floor(Math.random() * itens.length)];
                const ganhou = r1 === r2 && r2 === r3;
                await sock.sendMessage(from, { text: `🎰 *CASSINO RUSSO*\n\n[ ${r1} | ${r2} | ${r3} ]\n\n${ganhou ? '🏆 VOCÊ GANHOU!' : '❌ Tente novamente!'}` });
                break;

            case '!painel':
                if (!isOwner) return;
                await sock.sendMessage(from, { text: `👑 *PAINEL RUSSO-BOT*\n\n✅ Status: Online\n🔋 Dono: Reconhecido\n🛡️ Antilink: Ligado` });
                break;
                
            case '!ban':
                if (!isSenderAdmin || !isBotAdmin) return;
                const cited = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0];
                if (cited) {
                    await sock.groupParticipantsUpdate(from, [cited], "remove");
                    await sock.sendMessage(from, { text: '✅ Removido!' });
                }
                break;
        }
    });
}

startRusso();
