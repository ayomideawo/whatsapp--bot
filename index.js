const { default: makeWASocket, DisconnectReason, makeCacheableSignalKeyStore, initAuthCreds } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const P = require('pino');
const axios = require('axios');
const math = require('mathjs');

// Bot Configuration
const PREFIX = '!';
const BOT_NAME = 'Xhypher Bot';
const cooldowns = new Set();

// --- IN-MEMORY AUTH STORE (No folder needed) ---
const store = {};
const authState = {
    creds: initAuthCreds(),
    keys: {
        get: (type, ids) => {
            const data = {};
            for (const id of ids) {
                data[id] = store[`${type}-${id}`];
            }
            return data;
        },
        set: (data) => {
            for (const type in data) {
                for (const id in data[type]) {
                    store[`${type}-${id}`] = data[type][id];
                }
            }
        }
    }
};
// -----------------------------------------------

async function startBot() {
    const sock = makeWASocket({
        auth: {
            creds: authState.creds,
            keys: makeCacheableSignalKeyStore(authState.keys, P({ level: 'silent' }))
        },
        printQRInTerminal: true,
        logger: P({ level: 'silent' }),
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('Scan this QR code in your WhatsApp Linked Devices:');
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting:', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log(`✅ ${BOT_NAME} is connected and ready!`);
        }
    });

    // Welcome message for new group members
    sock.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            const groupId = anu.id;
            const participants = anu.participants;
            const text = `Welcome to the group, @${participants[0].split('@')[0]}! 👋\nType ${PREFIX}menu to see what I can do.`;
            await sock.sendMessage(groupId, { text, mentions: participants });
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        
        // Extract message text safely
        const text = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     msg.message.imageMessage?.caption || '';

        if (!text.startsWith(PREFIX)) return;

        const args = text.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        const q = args.join(' ');

        // Anti-spam cooldown (2 seconds)
        if (cooldowns.has(sender)) return;
        cooldowns.add(sender);
        setTimeout(() => cooldowns.delete(sender), 2000);

        // Command Handler
        try {
            switch (command) {
                case 'menu':
                case 'help':
                    const menuText = `*🤖 ${BOT_NAME} Menu*\n\n` +
                        `*Utility:*\n` +
                        `• ${PREFIX}ping - Check bot speed\n` +
                        `• ${PREFIX}uptime - Check how long bot has been running\n` +
                        `• ${PREFIX}calc <math> - Calculate (e.g., ${PREFIX}calc 2+2)\n\n` +
                        `*Fun:*\n` +
                        `• ${PREFIX}joke - Get a random joke\n` +
                        `• ${PREFIX}quote - Get an inspirational quote\n\n` +
                        `*Group Management:*\n` +
                        `• ${PREFIX}tagall <message> - Tag everyone in the group\n` +
                        `• ${PREFIX}groupinfo - Get group details\n\n` +
                        `_Powered by ${BOT_NAME}_`;
                    await sock.sendMessage(from, { text: menuText }, { quoted: msg });
                    break;

                case 'ping':
                    const start = Date.now();
                    await sock.sendMessage(from, { text: 'Pinging...' }, { quoted: msg })
                        .then((sentMsg) => {
                            const latency = Date.now() - start;
                            sock.sendMessage(from, { text: `🏓 Pong! Latency: ${latency}ms`, edit: sentMsg.key });
                        });
                    break;

                case 'uptime':
                    const uptime = process.uptime();
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);
                    await sock.sendMessage(from, { text: `⏱️ Uptime: ${hours}h ${minutes}m ${seconds}s` }, { quoted: msg });
                    break;

                case 'calc':
                    if (!q) return sock.sendMessage(from, { text: `Usage: ${PREFIX}calc 5 * 5` }, { quoted: msg });
                    try {
                        const result = math.evaluate(q);
                        await sock.sendMessage(from, { text: `🧮 Result: *${result}*` }, { quoted: msg });
                    } catch (e) {
                        await sock.sendMessage(from, { text: `❌ Invalid math expression.` }, { quoted: msg });
                    }
                    break;

                case 'joke':
                    const jokeRes = await axios.get('https://official-joke-api.appspot.com/random_joke');
                    const joke = `😂 *Joke*\n\n${jokeRes.data.setup}\n\n...${jokeRes.data.punchline}`;
                    await sock.sendMessage(from, { text: joke }, { quoted: msg });
                    break;

                case 'quote':
                    const quoteRes = await axios.get('https://api.quotable.io/random');
                    const quote = `💡 *Quote of the day*\n\n"${quoteRes.data.content}"\n— _${quoteRes.data.author}_`;
                    await sock.sendMessage(from, { text: quote }, { quoted: msg });
                    break;

                case 'tagall':
                    if (!isGroup) return sock.sendMessage(from, { text: '❌ This command only works in groups.' }, { quoted: msg });
                    const groupMetadata = await sock.groupMetadata(from);
                    const participants = groupMetadata.participants.map(p => p.id);
                    let tagText = `📢 *Attention Everyone*\n\n${q ? q : 'Please check the chat!'}\n\n`;
                    participants.forEach(p => { tagText += `@${p.split('@')[0]}\n`; });
                    await sock.sendMessage(from, { text: tagText, mentions: participants }, { quoted: msg });
                    break;

                case 'groupinfo':
                    if (!isGroup) return sock.sendMessage(from, { text: '❌ This command only works in groups.' }, { quoted: msg });
                    const meta = await sock.groupMetadata(from);
                    const info = `👥 *Group Info*\n\n` +
                        `*Name:* ${meta.subject}\n` +
                        `*Members:* ${meta.participants.length}\n` +
                        `*Created:* ${new Date(meta.creation * 1000).toLocaleDateString()}\n` +
                        `*Desc:* ${meta.desc || 'No description'}`;
                    await sock.sendMessage(from, { text: info }, { quoted: msg });
                    break;

                default:
                    break;
            }
        } catch (error) {
            console.error('Command Error:', error);
            sock.sendMessage(from, { text: '❌ An error occurred while processing that command.' }, { quoted: msg });
        }
    });
}

startBot();
