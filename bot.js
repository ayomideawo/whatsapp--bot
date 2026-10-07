const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;

let latestQR = null;
let isReady = false;
let botPassword = process.env.BOT_PASSWORD || null;
const authedChats = new Set();

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: 'new',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-sync',
            '--disable-translate',
            '--hide-scrollbars',
            '--mute-audio',
            '--no-first-run',
            '--single-process'
        ]
    }
});

// ===== SMALL DATA SETS =====
const jokes = [
    "Why do programmers prefer dark mode? Light attracts bugs 🐛",
    "Why did the dev go broke? He used up all his cache 💸",
    "How many programmers to change a bulb? None, hardware 💡",
    "A SQL query walks into a bar: 'Can I join you?' 🍻",
    "Recursion: see Recursion 🔁"
];

const facts = [
    "Octopuses have three hearts 🐙",
    "Honey never spoils 🍯",
    "A day on Venus is longer than a year 🪐",
    "Bananas are berries, strawberries aren't 🍌"
];

const quotes = [
    "The best way to predict the future is to invent it. — Alan Kay",
    "Simplicity is the soul of efficiency. — Austin Freeman",
    "Code is like humor. When you have to explain it, it's bad. — Cory House"
];

const sectips = [
    "*Tip:* Use a password manager.",
    "*Tip:* Enable 2FA on every account.",
    "*Tip:* Never reuse passwords."
];

const rand = arr => arr[Math.floor(Math.random() * arr.length)];

// ===== STYLED MENU =====
const MENU = `╔══════════════════════════╗
║   🤖  *XITEXE BOT*   🤖   ║
╚══════════════════════════╝

⚡ *30 commands* — 4 categories
📱 Prefix: \`. \` or \`! \`

*📂 Categories:*
🎮 \`.fun\` — Fun (10)
🛠️ \`.util\` — Utility (10)
🛡️ \`.sec\` — Security (5)
ℹ️ \`.info\` — Info (3)

*🔥 Quick start:*
• \`.ping\` — test the bot
• \`.joke\` — get a laugh
• \`.calc 5*8\` — do math
• \`.password 20\` — strong password

_Tap \`.fun\`, \`.util\`, \`.sec\` or \`.info\` for details_`;

const FUN_MENU = `╔══════════════════════════╗
║  🎮  *FUN* (10)
╚══════════════════════════╝

▸ \`.joke\` — Random joke
▸ \`.fact\` — Random fact
▸ \`.quote\` — Random quote
▸ \`.dice\` — Roll a dice
▸ \`.coinflip\` — Heads or tails
▸ \`.8ball\` — Magic 8-ball
▸ \`.roast\` — Roast someone
▸ \`.compliment\` — Give a compliment
▸ \`.vibe\` — Vibe check
▸ \`.rate <thing>\` — Rate something`;

const UTIL_MENU = `╔══════════════════════════╗
║  🛠️  *UTILITY* (10)
╚══════════════════════════╝

▸ \`.time\` — Current time
▸ \`.date\` — Today's date
▸ \`.calc <expr>\` — Calculator
▸ \`.random <min> <max>\` — Random number
▸ \`.password <len>\` — Generate password
▸ \`.reverse <text>\` — Reverse text
▸ \`.upper <text>\` — Uppercase
▸ \`.lower <text>\` — Lowercase
▸ \`.len <text>\` — Character count
▸ \`.count <text>\` — Word count`;

const SEC_MENU = `╔══════════════════════════╗
║  🛡️  *SECURITY* (5)
╚══════════════════════════╝

▸ \`.strength <pwd>\` — Password strength
▸ \`.scamcheck <text>\` — Scam analysis
▸ \`.linkcheck <url>\` — Link safety
▸ \`.sectips\` — Security tip
▸ \`.randpin <len>\` — Random PIN`;

const INFO_MENU = `╔══════════════════════════╗
║  ℹ️  *INFO* (3)
╚══════════════════════════╝

▸ \`.ping\` — Check bot latency
▸ \`.menu\` — Show main menu
▸ \`.help\` — Same as menu`;

// ===== COMMANDS =====
const COMMANDS = {
    // Menus
    menu: ctx => ctx.reply(MENU),
    help: ctx => ctx.reply(MENU),
    fun: ctx => ctx.reply(FUN_MENU),
    util: ctx => ctx.reply(UTIL_MENU),
    sec: ctx => ctx.reply(SEC_MENU),
    info: ctx => ctx.reply(INFO_MENU),

    // Fun
    joke: ctx => ctx.reply('😄 ' + rand(jokes)),
    fact: ctx => ctx.reply('🧠 ' + rand(facts)),
    quote: ctx => ctx.reply('💬 ' + rand(quotes)),
    dice: ctx => ctx.reply(`🎲 ${Math.floor(Math.random() * 6) + 1}`),
    coinflip: ctx => ctx.reply(Math.random() < 0.5 ? 'Heads 🪙' : 'Tails 🪙'),
    '8ball': ctx => ctx.reply('🎱 ' + rand(['Yes ✅','No ❌','Maybe 🤔','Definitely 💯'])),
    roast: ctx => ctx.reply('🔥 ' + rand([
        "You're the reason they put instructions on shampoo bottles.",
        "Your code is like your face — buggy.",
        "You're the human equivalent of a software update at 3 AM."
    ])),
    compliment: ctx => ctx.reply('💚 ' + rand([
        "You're doing great.",
        "Your existence makes the world better.",
        "You're smarter than you think."
    ])),
    vibe: ctx => ctx.reply('✨ ' + rand([
        "🔥 Immaculate vibes.",
        "✨ Chill vibes.",
        "⚡ Chaotic energy."
    ])),
    rate: (ctx, arg) => ctx.reply(`⭐ ${arg || 'it'}: ${Math.floor(Math.random() * 10) + 1}/10`),

    // Utility
    time: ctx => ctx.reply(`🕐 ${new Date().toLocaleString()}`),
    date: ctx => ctx.reply(`📅 ${new Date().toDateString()}`),
    calc: (ctx, arg) => {
        if (!arg) return ctx.reply('Usage: .calc 2+2');
        if (!/^[0-9+\-*/().\s]+$/.test(arg)) return ctx.reply('❌ Only numbers and + - * / ( )');
        try { ctx.reply(`🧮 ${arg} = ${eval(arg)}`); }
        catch { ctx.reply('❌ Invalid expression'); }
    },
    random: (ctx, arg) => {
        const a = arg.split(' ');
        const min = parseInt(a[0]) || 1;
        const max = parseInt(a[1]) || 100;
        ctx.reply(`🎲 ${Math.floor(Math.random() * (max - min + 1)) + min}`);
    },
    password: (ctx, arg) => {
        const len = Math.min(parseInt(arg) || 16, 64);
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let p = '';
        for (let i = 0; i < len; i++) p += chars[Math.floor(Math.random() * chars.length)];
        ctx.reply(`🔐 ${p}`);
    },
    reverse: (ctx, arg) => ctx.reply(arg ? arg.split('').reverse().join('') : 'Usage: .reverse hello'),
    upper: (ctx, arg) => ctx.reply(arg ? arg.toUpperCase() : 'Usage: .upper hello'),
    lower: (ctx, arg) => ctx.reply(arg ? arg.toLowerCase() : 'Usage: .lower HELLO'),
    len: (ctx, arg) => ctx.reply(`Length: ${arg.length}`),
    count: (ctx, arg) => ctx.reply(`📊 Chars: ${arg.length} | Words: ${arg.split(/\s+/).filter(Boolean).length}`),

    // Security
    strength: (ctx, arg) => {
        if (!arg) return ctx.reply('Usage: .strength MyPass123');
        const score = [arg.length >= 8, arg.length >= 12, /[a-z]/.test(arg), /[A-Z]/.test(arg), /[0-9]/.test(arg), /[^a-zA-Z0-9]/.test(arg)].filter(Boolean).length;
        ctx.reply(`🔐 Strength: ${score >= 5 ? 'Very Strong 🟢' : score >= 4 ? 'Strong 🟡' : score >= 3 ? 'Medium 🟠' : 'Weak 🔴'}`);
    },
    scamcheck: (ctx, arg) => {
        const t = arg.toLowerCase();
        const flags = [];
        if (/urgent|immediately/.test(t)) flags.push('Urgency');
        if (/click here/.test(t)) flags.push('Click bait');
        if (/otp|password|pin/.test(t)) flags.push('Sensitive info');
        ctx.reply(`🔍 Red flags: ${flags.length ? flags.join(', ') : '✅ None'}`);
    },
    linkcheck: (ctx, arg) => {
        const u = arg.toLowerCase();
        const flags = [];
        if (/bit\.ly|tinyurl/.test(u)) flags.push('Shortener');
        if (!/^https:\/\//.test(u)) flags.push('Not HTTPS');
        ctx.reply(`🔗 ${flags.length ? '⚠️ ' + flags.join(', ') : '✅ No obvious risks'}`);
    },
    sectips: ctx => ctx.reply('🔒 ' + rand(sectips)),
    randpin: (ctx, arg) => {
        const len = Math.min(parseInt(arg) || 6, 12);
        let pin = '';
        for (let i = 0; i < len; i++) pin += Math.floor(Math.random() * 10);
        ctx.reply(`🔢 Random PIN: ${pin}`);
    },

    // Info
    ping: async ctx => {
        const t = Date.now();
        await ctx.reply('🏓 Pong!');
        ctx.reply(`⚡ ${Date.now() - t}ms`);
    }
};

// ===== EVENTS =====
client.on('qr', qr => {
    latestQR = qr;
    console.log('📱 QR ready');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    isReady = true;
    latestQR = null;
    console.log('✅ Ready');
});

client.on('auth_failure', m => console.error('❌ Auth:', m));
client.on('disconnected', r => { console.log('⚠️ Disconnected:', r); isReady = false; });

client.on('message', async msg => {
    if (msg.fromMe) return;
    const text = msg.body.trim();
    if (!text) return;

    const lower = text.toLowerCase();
    const args = text.split(' ');
    const cmd = lower.split(' ')[0];

    if (botPassword && !authedChats.has(msg.from)) {
        if (lower === botPassword.toLowerCase()) {
            authedChats.add(msg.from);
            return msg.reply('✅ Password correct. Type .menu');
        }
        return msg.reply('🔒 Password protected. Send the password.');
    }

    if (!cmd.startsWith('.') && !cmd.startsWith('!')) return;
    const command = cmd.slice(1);
    const arg = args.slice(1).join(' ');

    if (COMMANDS[command]) {
        try { await COMMANDS[command](msg, arg); }
        catch (e) { console.error(e.message); msg.reply('❌ Error'); }
    } else {
        msg.reply(`❌ Unknown: ${cmd}\nType .menu`);
    }
});

// ===== STYLED QR PAGE =====
app.get('/', (req, res) => {
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>XITEXE WhatsApp Bot</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
            background:#0a0a0a; color:#e0e0e0;
            font-family:'Segoe UI',system-ui,sans-serif;
            min-height:100vh; display:flex; align-items:center; justify-content:center;
            padding:20px;
            background-image:
                radial-gradient(circle at 20% 50%, rgba(0,200,83,0.08) 0%, transparent 50%),
                radial-gradient(circle at 80% 50%, rgba(255,0,255,0.05) 0%, transparent 50%);
        }
        .card {
            background:#121212; border:1px solid #222; border-radius:20px;
            padding:40px 30px; max-width:480px; width:100%;
            box-shadow:0 20px 60px rgba(0,0,0,0.6);
            position:relative; overflow:hidden;
        }
        .card::before {
            content:''; position:absolute; top:0; left:0; right:0; height:3px;
            background:linear-gradient(90deg,#00c853,#ff00ff,#00c853);
            background-size:200% 100%; animation:shimmer 3s linear infinite;
        }
        @keyframes shimmer {
            0% { background-position:200% 0; }
            100% { background-position:-200% 0; }
        }
        .logo { text-align:center; font-size:3rem; margin-bottom:10px; }
        h1 { text-align:center; font-size:1.4rem; color:#00c853; margin-bottom:6px; font-weight:700; letter-spacing:1px; }
        .subtitle { text-align:center; color:#666; font-size:0.8rem; margin-bottom:25px; letter-spacing:0.5px; }
        .status { text-align:center; padding:20px; border-radius:12px; margin-bottom:20px; }
        .status.ready { background:rgba(0,200,83,0.08); border:1px solid rgba(0,200,83,0.3); }
        .status.waiting { background:rgba(255,170,0,0.08); border:1px solid rgba(255,170,0,0.3); }
        .status-icon { font-size:3rem; display:block; margin-bottom:10px; }
        .status-title { font-size:1.1rem; font-weight:700; margin-bottom:6px; }
        .status.ready .status-title { color:#00c853; }
        .status.waiting .status-title { color:#ffaa00; }
        .status-text { color:#888; font-size:0.85rem; }
        .qr-wrapper {
            background:#fff; border-radius:16px; padding:20px;
            margin:0 auto 20px; width:fit-content;
            box-shadow:0 0 40px rgba(0,200,83,0.15);
        }
        .qr-wrapper img { display:block; width:280px; height:280px; }
        .instructions { background:#0a0a0a; border:1px solid #1a1a1a; border-radius:12px; padding:16px 20px; margin-bottom:20px; }
        .instructions-title { color:#00c853; font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin-bottom:12px; }
        .step { display:flex; align-items:flex-start; gap:12px; margin-bottom:10px; font-size:0.85rem; color:#bbb; }
        .step:last-child { margin-bottom:0; }
        .step-num {
            background:#00c853; color:#000; width:20px; height:20px; border-radius:50%;
            display:flex; align-items:center; justify-content:center;
            font-size:0.7rem; font-weight:700; flex-shrink:0; margin-top:1px;
        }
        .commands-preview { background:#0a0a0a; border:1px solid #1a1a1a; border-radius:12px; padding:16px 20px; }
        .commands-title { color:#00c853; font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin-bottom:12px; }
        .cmd-tag {
            display:inline-block; background:rgba(0,200,83,0.1); color:#00c853;
            border:1px solid rgba(0,200,83,0.3); padding:4px 10px; border-radius:6px;
            font-size:0.75rem; font-family:'Courier New',monospace; margin:0 6px 6px 0;
        }
        .loader { display:flex; justify-content:center; gap:6px; margin:20px 0; }
        .loader span { width:10px; height:10px; background:#00c853; border-radius:50%; animation:bounce 1.2s infinite; }
        .loader span:nth-child(2) { animation-delay:0.15s; }
        .loader span:nth-child(3) { animation-delay:0.3s; }
        @keyframes bounce {
            0%, 60%, 100% { transform:translateY(0); opacity:0.3; }
            30% { transform:translateY(-10px); opacity:1; }
        }
        .footer { text-align:center; color:#444; font-size:0.7rem; margin-top:20px; letter-spacing:0.5px; }
        .footer a { color:#00c853; text-decoration:none; }
    </style>
    <script>
        let counter = 10;
        let lastState = { ready: null, qr: null };

        async function poll() {
            try {
                const r = await fetch('/api/status');
                const d = await r.json();
                if (d.ready !== lastState.ready || d.qr !== lastState.qr) {
                    lastState = d;
                    render(d);
                }
            } catch (e) {}
        }

        function render(d) {
            const box = document.getElementById('content');
            if (d.ready) {
                box.innerHTML = '<div class="status ready"><span class="status-icon">✅</span><div class="status-title">Bot is running</div><div class="status-text">Linked to WhatsApp</div></div>' +
                    '<div class="instructions"><div class="instructions-title">💬 Try it now</div>' +
                    '<div class="step"><span class="step-num">1</span><span>Open any WhatsApp chat</span></div>' +
                    '<div class="step"><span class="step-num">2</span><span>Send <strong style="color:#00c853;">.menu</strong></span></div>' +
                    '<div class="step"><span class="step-num">3</span><span>Send <strong style="color:#00c853;">.ping</strong></span></div></div>' +
                    '<div class="commands-preview"><div class="commands-title">🎯 Popular</div>' +
                    '<span class="cmd-tag">.menu</span><span class="cmd-tag">.joke</span>' +
                    '<span class="cmd-tag">.ping</span><span class="cmd-tag">.calc</span>' +
                    '<span class="cmd-tag">.password</span><span class="cmd-tag">.fun</span></div>';
            } else if (d.qr) {
                box.innerHTML = '<div class="qr-wrapper"><img src="https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=' + encodeURIComponent(d.qr) + '" /></div>' +
                    '<div class="instructions"><div class="instructions-title">📋 How to scan</div>' +
                    '<div class="step"><span class="step-num">1</span><span>Open <strong>WhatsApp</strong></span></div>' +
                    '<div class="step"><span class="step-num">2</span><span>Settings → <strong>Linked Devices</strong></span></div>' +
                    '<div class="step"><span class="step-num">3</span><span>Tap <strong>Link a Device</strong></span></div>' +
                    '<div class="step"><span class="step-num">4</span><span>Point at the QR code</span></div></div>';
            } else {
                box.innerHTML = '<div class="status waiting"><span class="status-icon">⚡</span><div class="status-title">Booting up</div><div class="status-text">Chrome is launching</div></div>' +
                    '<div class="loader"><span></span><span></span><span></span></div>';
            }
        }

        setInterval(poll, 2000);
        poll();
    </script>
</head>
<body>
    <div class="card">
        <div class="logo">🤖</div>
        <h1>XITEXE BOT</h1>
        <div class="subtitle">WHATSAPP AUTOMATION</div>
        <div id="content"><div class="loader"><span></span><span></span><span></span></div></div>
        <div class="footer">Powered by <a href="#">@Xitexes</a></div>
    </div>
</body>
</html>`;
    res.send(html);
});

app.get('/api/status', (req, res) => {
    res.json({ ready: isReady, qr: latestQR });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web on ${PORT}`);
});

client.initialize();
