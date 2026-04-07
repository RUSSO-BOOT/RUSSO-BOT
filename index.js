const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inicializa a IA
const genAI = new GoogleGenerativeAI("SUA_CHAVE_GEMINI_AQUI");
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

async function connectToWhatsApp() {
    // Pasta onde o QR Code fica salvo (Fundamental pro Render)
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    // Lógica de Ativação no Grupo (Com Foto e Mensagem de 30 dias)
    sock.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add' && anu.participants.includes(sock.user.id)) {
            const menuAtivacao = `
🕺 *RUSSO-BOT ATIVADO!* 🕺

✅ *Status:* Online por 30 dias
🛡️ *Funções:* Antilink, Play, Marcação Geral

Digite *!menu* para começar!`.trim();
            
            await sock.sendMessage(anu.id, { 
                image: { url: 'LINK_DA_FOTO_DO_BOT.jpg' }, 
                caption: menuAtivacao 
            });
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        // --- MENU ORGANIZADO ---
        if (body === '!menu') {
            const menuTxt = `
🕺 *RUSSO-BOT - MENU* 🕺

🛡️ *ADMINISTRAÇÃO*
🚫 !ban - Remove membro
🛡️ !antilink - Ativa bloqueio
🔓 !abrir - Abre o grupo
🔒 !fechar - Fecha o grupo

🎵 *MULTIMÍDIA*
🎧 !play - Baixar música (MP3)
🖼️ !imagem - Buscar foto Google
🎭 !s - Criar figurinha

📅 *ORGANIZAÇÃO*
⏰ !evento - Agendar compromisso
📌 !todos - Marcar todo o grupo

🤖 *INTERAÇÃO*
💬 !russo - Conversar com a IA
            `.trim();
            await sock.sendMessage(from, { text: menuTxt });
        }

        // --- COMANDO !EVENTO ---
        if (body.startsWith('!evento')) {
            const args = body.slice(8).split('/'); 
            if (args.length < 3) return sock.sendMessage(from, { text: 'Use: !evento Nome / Dia / Hora' });
            
            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants.map(p => p.id);
            
            const txt = `📅 *EVENTO MARCADO!*\n\n📌 *O que:* ${args[0]}\n🗓️ *Data:* ${args[1]}\n⏰ *Hora:* ${args[2]}\n\n@everyone`;
            await sock.sendMessage(from, { text: txt, mentions: participants });
        }

        // --- IA CONVERSAR (GEMINI) ---
        if (body.startsWith('!russo ')) {
            const prompt = body.slice(7);
            const result = await model.generateContent(prompt);
            await sock.sendMessage(from, { text: `🤖 *Russo:* ${result.response.text()}` });
        }
    });
}

connectToWhatsApp();
