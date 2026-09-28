const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;

let latestQR = null;
let isReady = false;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: 'new',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu'
        ]
    }
});

// ===== DATA =====
const jokes = [
    "Why do programmers prefer dark mode? Light attracts bugs 🐛",
    "Why did the dev go broke? He used up all his cache 💸",
    "How many programmers to change a bulb? None, it's a hardware problem 💡",
    "Why do Java devs wear glasses? They don't C# 👓",
    "I'd tell you a UDP joke, but you might not get it 📡",
    "There are 10 types of people: those who get binary, and those who don't 🔢",
    "A SQL query walks into a bar: 'Can I join you?' 🍻",
    "Recursion: see Recursion 🔁",
    "Why was the function sad? It didn't get called 📞",
    "!false — it's funny because it's true 😂"
];

const quotes = [
    "The best way to predict the future is to invent it. — Alan Kay",
    "Code is like humor. When you have to explain it, it's bad. — Cory House",
    "First, solve the problem. Then write the code. — John Johnson",
    "Simplicity is the soul of efficiency. — Austin Freeman",
    "Premature optimization is the root of all evil. — Donald Knuth",
    "Any fool can write code a computer understands. Good programmers write code humans understand. — Martin Fowler"
];

const facts = [
    "Octopuses have three hearts 🐙",
    "Honey never spoils 🍯",
    "A day on Venus is longer than a year on Venus 🪐",
    "Bananas are berries, strawberries aren't 🍌",
    "Sharks existed before trees 🦈",
    "Water makes up ~60% of the human body 💧",
    "The shortest war lasted 38 minutes ⚔️",
    "Butterflies taste with their feet 🦋",
    "The Eiffel Tower grows ~15cm in summer 🗼",
    "A group of flamingos is called a flamboyance 🦩"
];

const riddles = [
    { q: "What has keys but can't open locks?", a: "A piano" },
    { q: "What gets wetter the more it dries?", a: "A towel" },
    { q: "What has a head and tail but no body?", a: "A coin" },
    { q: "I speak without a mouth. What am I?", a: "An echo" },
    { q: "The more you take, the more you leave behind. What am I?", a: "Footsteps" }
];

const truthQuestions = [
    "What's your most embarrassing moment?",
    "Who's your secret crush?",
    "What's the biggest lie you've told?",
    "What's the last thing you searched on your phone?",
    "What's your biggest fear?"
];

const dares = [
    "Send the last photo in your gallery.",
    "Type your name with your eyes closed.",
    "Voice note yourself singing.",
    "Send an emoji for every letter of your name.",
    "Text your crush 'hey' and screenshot the reply."
];

const wouldYouRather = [
    "Would you rather: Fight 1 horse-sized duck OR 100 duck-sized horses?",
    "Would you rather: Always be 10 min late OR 20 min early?",
    "Would you rather: Have unlimited money OR unlimited time?",
    "Would you rather: Never use social media OR never watch movies again?",
    "Would you rather: Read minds OR be invisible?"
];

const rand = arr => arr[Math.floor(Math.random() * arr.length)];

// ===== MENU =====
const MENU = `
╔══════════════════════╗
   🤖 *XITEXE BOT*
╚══════════════════════╝

*🎮 FUN*
.ping — pong
.hi — greet
.joke — random joke
.quote — random quote
.fact — random fact
.dice — roll 1-6
.coinflip — heads/tails
.8ball <q> — magic 8-ball
.riddle — random riddle
.truth — truth question
.dare — dare challenge
.wouldyourather — random dilemma

*🛠️ UTILITY*
.time — current time
.date — today's date
.calc 2+2 — math
.random 1 100 — random number
.password 16 — generate password
.reverse hello — reverse text
.upper hello — uppercase
.lower HELLO — lowercase
.len hello — character count
.uuid — generate UUID
.id — your WhatsApp ID
.chatid — current chat ID

*👥 GROUP*
.groupinfo — group stats
.tagall — mention everyone
.admins — list admins
.members — member count
.link — group invite link

*⏰ REMINDERS*
.remind 5m water — set reminder
(s = seconds, m = minutes, h = hours)

*🎲 GAMES*
.guess 42 — guess a number
.quiz — random quiz

*ℹ️ INFO*
.menu — this menu
.help — same as .menu
.about — about this bot
`.trim();

// ===== BOT EVENTS =====
client.on('qr', (qr) => {
    latestQR = qr;
    console.log('📱 QR Code ready. Visit the web URL to scan.');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    isReady = true;
    latestQR = null;
    console.log('✅ Bot is ready!');
});

client.on('authenticated', () => console.log('🔐 Authenticated'));
client.on('auth_failure', m => console.error('❌ Auth failed:', m));
client.on('disconnected', r => { console.log('⚠️ Disconnected:', r); isReady = false; });

// ===== MESSAGE HANDLER =====
client.on('message', async (msg) => {
    const raw = msg.body.trim();
    const lower = raw.toLowerCase();
    const args = raw.split(' ');
    const cmd = lower.split(' ')[0];

    if (!cmd.startsWith('.') && !cmd.startsWith('!')) return;

    console.log('📩 Command received:', cmd, 'from', msg.from);

    try {
        // ===== MENU =====
        if (['.menu', '.help', '.commands', '!menu', '!help', '!commands'].includes(cmd)) {
            return msg.reply(MENU);
        }

        if (['.about', '!about'].includes(cmd)) {
            return msg.reply('🤖 XITEXE BOT\nVersion: 1.0\nBuilt with whatsapp-web.js\nType .menu for commands');
        }

        // ===== FUN =====
        if (['.ping', '!ping'].includes(cmd)) return msg.reply('pong 🏓');
        if (['.hi', '.hello', '!hi', '!hello'].includes(cmd)) return msg.reply('Hello 👋');
        if (['.joke', '!joke'].includes(cmd)) return msg.reply('😄 ' + rand(jokes));
        if (['.quote', '!quote'].includes(cmd)) return msg.reply('💬 ' + rand(quotes));
        if (['.fact', '!fact'].includes(cmd)) return msg.reply('🧠 ' + rand(facts));
        if (['.dice', '!dice'].includes(cmd)) return msg.reply(`🎲 ${Math.floor(Math.random() * 6) + 1}`);
        if (['.coinflip', '!coinflip'].includes(cmd)) return msg.reply(Math.random() < 0.5 ? 'Heads 🪙' : 'Tails 🪙');

        if (['.8ball', '!8ball'].includes(cmd)) {
            const answers = ["Yes ✅","No ❌","Maybe 🤔","Absolutely 🔥","Doubtful 🤨","Definitely 💯","Ask later 💭","Signs point to yes 👍"];
            return msg.reply('🎱 ' + rand(answers));
        }

        if (['.riddle', '!riddle'].includes(cmd)) {
            const r = rand(riddles);
            await msg.reply(`🧩 ${r.q}\n\n_Answer in 20s..._`);
            setTimeout(() => msg.reply(`💡 Answer: ${r.a}`), 20000);
            return;
        }

        if (['.truth', '!truth'].includes(cmd)) return msg.reply('💬 ' + rand(truthQuestions));
        if (['.dare', '!dare'].includes(cmd)) return msg.reply('🔥 ' + rand(dares));
        if (['.wouldyourather', '!wouldyourather'].includes(cmd)) return msg.reply('🤔 ' + rand(wouldYouRather));

        // ===== UTILITY =====
        if (['.time', '!time'].includes(cmd)) return msg.reply(`🕐 ${new Date().toLocaleString()}`);
        if (['.date', '!date'].includes(cmd)) return msg.reply(`📅 ${new Date().toDateString()}`);

        if (['.calc', '!calc'].includes(cmd)) {
            const expr = raw.slice(cmd.length).trim();
            if (!expr) return msg.reply('Usage: .calc 2+2');
            if (!/^[0-9+\-*/().\s]+$/.test(expr)) return msg.reply('❌ Only numbers and + - * / ( ) allowed');
            try { return msg.reply(`🧮 ${expr} = ${eval(expr)}`); }
            catch { return msg.reply('❌ Invalid expression'); }
        }

        if (['.random', '!random'].includes(cmd)) {
            const min = parseInt(args[1]) || 1;
            const max = parseInt(args[2]) || 100;
            return msg.reply(`🎲 ${Math.floor(Math.random() * (max - min + 1)) + min}`);
        }

        if (['.password', '!password'].includes(cmd)) {
            const len = Math.min(parseInt(args[1]) || 16, 64);
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
            let p = '';
            for (let i = 0; i < len; i++) p += chars[Math.floor(Math.random() * chars.length)];
            return msg.reply(`🔐 ${p}`);
        }

        if (['.reverse', '!reverse'].includes(cmd)) {
            const t = raw.slice(cmd.length).trim();
            return msg.reply(t ? t.split('').reverse().join('') : 'Usage: .reverse hello');
        }

        if (['.upper', '!upper'].includes(cmd)) {
            const t = raw.slice(cmd.length).trim();
            return msg.reply(t ? t.toUpperCase() : 'Usage: .upper hello');
        }

        if (['.lower', '!lower'].includes(cmd)) {
            const t = raw.slice(cmd.length).trim();
            return msg.reply(t ? t.toLowerCase() : 'Usage: .lower HELLO');
        }

        if (['.len', '!len'].includes(cmd)) {
            const t = raw.slice(cmd.length).trim();
            return msg.reply(`Length: ${t.length}`);
        }

        if (['.uuid', '!uuid'].includes(cmd)) {
            const u = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
            return msg.reply(`🆔 ${u}`);
        }

        if (['.id', '!id'].includes(cmd)) return msg.reply(`Your ID: ${msg.from}`);

        // ===== GROUP =====
        const chat = await msg.getChat();

        if (['.chatid', '!chatid'].includes(cmd)) {
            return msg.reply(`Chat ID: ${chat.id._serialized}`);
        }

        if (['.groupinfo', '!groupinfo'].includes(cmd)) {
            if (!chat.isGroup) return msg.reply('❌ Groups only.');
            return msg.reply(`📊 *${chat.name}*\nMembers: ${chat.participants.length}\nDesc: ${chat.description || 'None'}`);
        }

        if (['.tagall', '!tagall'].includes(cmd)) {
            if (!chat.isGroup) return msg.reply('❌ Groups only.');
            let t = '📢 *Attention:*\n\n';
            chat.participants.forEach(p => t += `@${p.id.user} `);
            return chat.sendMessage(t, { mentions: chat.participants });
        }

        if (['.admins', '!admins'].includes(cmd)) {
            if (!chat.isGroup) return msg.reply('❌ Groups only.');
            const admins = chat.participants.filter(p => p.isAdmin).map(p => `@${p.id.user}`).join(' ');
            return msg.reply(`👑 Admins: ${admins || 'None'}`);
        }

        if (['.members', '!members'].includes(cmd)) {
            if (!chat.isGroup) return msg.reply('❌ Groups only.');
            return msg.reply(`👥 Total: ${chat.participants.length} members`);
        }

        if (['.link', '!link'].includes(cmd)) {
            if (!chat.isGroup) return msg.reply('❌ Groups only.');
            try {
                const code = await chat.getInviteCode();
                return msg.reply(`🔗 https://chat.whatsapp.com/${code}`);
            } catch { return msg.reply('❌ Cannot get invite link'); }
        }

        // ===== REMINDERS =====
        if (['.remind', '!remind'].includes(cmd)) {
            const m = raw.match(/^[.!]remind\s+(\d+)(s|m|h)\s+(.+)$/i);
            if (!m) return msg.reply('Usage: .remind 5m Take a break');
            const unit = m[2].toLowerCase();
            const ms = unit === 's' ? +m[1] * 1000 : unit === 'm' ? +m[1] * 60000 : +m[1] * 3600000;
            const chatId = msg.from;
            setTimeout(async () => {
                try { await client.sendMessage(chatId, `⏰ *Reminder:* ${m[3]}`); } catch {}
            }, ms);
            return msg.reply(`✅ Reminder in ${m[1]}${m[2]}: "${m[3]}"`);
        }

        // ===== GAMES =====
        if (['.guess', '!guess'].includes(cmd)) {
            const n = parseInt(args[1]);
            if (isNaN(n)) return msg.reply('Usage: .guess 42');
            const target = Math.floor(Math.random() * 100) + 1;
            const diff = Math.abs(n - target);
            if (n === target) return msg.reply(`🎉 Correct! It was ${target}`);
            if (diff <= 5) return msg.reply(`🔥 So close! It was ${target}`);
            if (diff <= 15) return msg.reply(`👍 Close-ish. It was ${target}`);
            return msg.reply(`❌ It was ${target}`);
        }

        if (['.quiz', '!quiz'].includes(cmd)) {
            const qs = [
                { q: 'What is 7 × 8?', a: '56' },
                { q: 'Capital of Japan?', a: 'tokyo' },
                { q: 'Largest planet?', a: 'jupiter' },
                { q: 'How many continents?', a: '7' }
            ];
            const q = rand(qs);
            await msg.reply(`❓ ${q.q}\n\n_Answer in 20s..._`);
            setTimeout(() => msg.reply(`💡 Answer: ${q.a}`), 20000);
            return;
        }

        // ===== UNKNOWN =====
        return msg.reply(`❌ Unknown: ${cmd}\nType *.menu* for all commands`);

    } catch (e) {
        console.error('Handler error:', e);
        try { await msg.reply('❌ Error: ' + e.message); } catch {}
    }
});

// ===== WEB PAGE =====
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>XITEXE BOT</title>
            <meta http-equiv="refresh" content="3">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {
                    background: #0a0a0a;
                    color: #00ff00;
                    font-family: monospace;
                    text-align: center;
                    padding: 20px;
                    margin: 0;
                }
                h1 { color: #ff00ff; font-size: 2rem; }
                img {
                    border: 3px solid #00ff00;
                    border-radius: 10px;
                    margin: 20px 0;
                    background: #fff;
                    padding: 10px;
                }
                .ok { color: #00ff00; font-size: 2rem; }
                .wait { color: #ffaa00; }
                .info {
                    max-width: 500px;
                    margin: 20px auto;
                    padding: 20px;
                    border: 1px solid #00ff00;
                    border-radius: 10px;
                    text-align: left;
                    background: #0d0d0d;
                }
                .info h2 { color: #ff00ff; }
                .info code {
                    background: #1a1a1a;
                    padding: 2px 6px;
                    border-radius: 4px;
                    color: #00ffcc;
                }
            </style>
        </head>
        <body>
            ${isReady ? `
                <h1 class="ok">✅ Bot is running!</h1>
                <p>Send <code>.menu</code> to your bot on WhatsApp</p>
                <div class="info">
                    <h2>Quick Commands</h2>
                    <p><code>.menu</code> — full command list</p>
                    <p><code>.ping</code> — check bot</p>
                    <p><code>.joke</code> — random joke</p>
                    <p><code>.time</code> — current time</p>
                    <p><code>.help</code> — same as .menu</p>
                </div>
            ` : latestQR ? `
                <h1>📱 Scan this QR code</h1>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(latestQR)}" />
                <p>Open WhatsApp → Linked Devices → Link a Device</p>
                <p class="wait">This page refreshes every 3 seconds</p>
            ` : `
                <h1 class="wait">⏳ Starting bot...</h1>
                <p>Please wait 30-60 seconds</p>
            `}
        </body>
        </html>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

client.initialize();
