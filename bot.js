const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// State
let latestQR = null;
let latestPairingCode = null;
let isReady = false;
let botPassword = process.env.BOT_PASSWORD || null;
let phoneNumber = null;
let usePairingCode = false;
let client = null;

const authedChats = new Set();

// ===== CREATE CLIENT =====
function createClient(usePairing, phone) {
    if (client) {
        try { client.destroy(); } catch (e) {}
    }

    usePairingCode = usePairing;
    phoneNumber = phone;
    isReady = false;
    latestQR = null;
    latestPairingCode = null;

    const clientOptions = {
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--disable-gpu'
            ]
        }
    };

    if (usePairing && phone) {
        clientOptions.pairWithPhoneNumber = {
            phoneNumber: phone.replace(/\D/g, ''),
            showNotification: true,
            intervalMs: 180000
        };
    }

    client = new Client(clientOptions);

    client.on('qr', qr => {
        if (!usePairingCode) {
            latestQR = qr;
            console.log('📱 QR code ready');
            qrcode.generate(qr, { small: true });
        }
    });

    client.on('code', code => {
        latestPairingCode = code;
        console.log('🔐 Pairing code ready:', code);
    });

    client.on('ready', () => {
        isReady = true;
        latestQR = null;
        latestPairingCode = null;
        console.log('✅ WhatsApp bot ready');
    });

    client.on('auth_failure', msg => console.error('❌ Auth failed:', msg));
    client.on('disconnected', reason => {
        console.log('⚠️ Disconnected:', reason);
        isReady = false;
    });

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
                return msg.reply('✅ Password correct! Type .menu to see commands.');
            }
            return msg.reply('🔒 This bot is password protected. Send the password.');
        }

        if (!cmd.startsWith('.') && !cmd.startsWith('!')) return;

        const command = cmd.slice(1);
        const arg = args.slice(1).join(' ');

        if (COMMANDS[command]) {
            try {
                await COMMANDS[command](msg, arg);
            } catch (e) {
                console.error('Command error:', e.message);
                msg.reply('❌ Error running command.');
            }
        } else {
            msg.reply(`❌ Unknown: ${cmd}\nType .menu`);
        }
    });

    client.initialize();
}

// ===== DATA =====
const DATA = {
    jokes: ["Why do programmers prefer dark mode? Light attracts bugs 🐛","Why did the dev go broke? He used up all his cache 💸","How many programmers to change a bulb? None, it's hardware 💡","A SQL query walks into a bar: 'Can I join you?' 🍻","Recursion: see Recursion 🔁"],
    quotes: ["The best way to predict the future is to invent it. — Alan Kay","Code is like humor. When you have to explain it, it's bad. — Cory House"],
    facts: ["Octopuses have three hearts 🐙","Honey never spoils 🍯","A day on Venus is longer than a year on Venus 🪐","Bananas are berries, strawberries aren't 🍌"],
    truths: ["What's your most embarrassing moment?","Who's your secret crush?","What's the biggest lie you've told?"],
    dares: ["Send the last photo in your gallery.","Type your name with your eyes closed.","Voice note yourself singing."],
    roasts: ["You're the reason they put instructions on shampoo bottles.","Your code is like your face — buggy."],
    compliments: ["You're doing great.","Your existence makes the world better.","You're smarter than you think."],
    vibes: ["🔥 Immaculate vibes.","✨ Chill vibes.","⚡ Chaotic energy."],
    sectips: ["*Tip:* Use a password manager.","*Tip:* Enable 2FA.","*Tip:* Never reuse passwords."],
    phishing: ["*Phishing Signs:* Urgent language, wrong domain, asking for passwords/OTP."],
    advice: ["Talk less. Listen more.","Save 10% of everything you earn."]
};

const rand = arr => arr[Math.floor(Math.random() * arr.length)];

const CATEGORIES = {
    fun: { emoji: '🎮', title: 'FUN', commands: {
        'joke': 'Random joke', 'quote': 'Random quote', 'fact': 'Random fact', 'dice': 'Roll dice',
        'coinflip': 'Heads or tails', '8ball': 'Magic 8-ball', 'truth': 'Truth question',
        'dare': 'Dare challenge', 'roast': 'Roast someone', 'compliment': 'Give a compliment',
        'vibe': 'Vibe check', 'yesno': 'Yes or no', 'lucky': 'Lucky number',
        'ship': 'Compatibility score', 'rate': 'Rate anything', 'advice': 'Random advice',
        'pick': 'Pick from list', 'roll': 'Dice notation', 'riddle': 'Puzzle riddle'
    }},
    util: { emoji: '🛠️', title: 'UTILITY', commands: {
        'time': 'Current time', 'date': "Today's date", 'week': 'Day of week', 'month': 'Month name',
        'calc': 'Calculator', 'random': 'Random number', 'password': 'Generate password',
        'uuid': 'UUID generator', 'reverse': 'Reverse text', 'upper': 'Uppercase', 'lower': 'Lowercase',
        'len': 'Character count', 'count': 'Word count', 'spell': 'Spell letters',
        'slugify': 'URL slugify', 'shuffle': 'Shuffle letters', 'caesar': 'Caesar cipher',
        'vowels': 'Vowel count', 'morse': 'Text to Morse', 'binary': 'To binary', 'hex': 'To hex',
        'octal': 'To octal', 'primes': 'Prime numbers', 'fibonacci': 'Fibonacci',
        'factorial': 'Factorial', 'gcd': 'GCD calculator', 'bmi': 'BMI calculator',
        'tip': 'Tip calculator', 'split': 'Split bill', 'percent': 'Percentage',
        'age': 'Age calculator', 'daysuntil': 'Days until date', 'countdown': 'Countdown',
        'unixtime': 'Unix timestamp', 'hexcolor': 'Hex color info', 'rgb': 'RGB to hex',
        'mood': 'Log your mood', 'goal': 'Set daily goal', 'mygoal': 'Show goal'
    }},
    sec: { emoji: '🛡️', title: 'SECURITY', commands: {
        'strength': 'Password strength', 'scamcheck': 'Scam analysis', 'linkcheck': 'Link safety',
        'sectips': 'Security tip', 'phishing': 'Phishing signs', 'randpin': 'Random PIN',
        'otp': 'OTP safety rules', 'linuxcmd': 'Linux command help', 'sha256': 'SHA256 hash',
        'md5': 'MD5 hash', 'b64encode': 'Base64 encode', 'b64decode': 'Base64 decode'
    }},
    info: { emoji: 'ℹ️', title: 'INFO', commands: {
        'ping': 'Check bot latency', 'menu': 'Show this menu', 'help': 'Same as menu'
    }}
};

function sendMenu(ctx) {
    let total = 0;
    for (const cat of Object.values(CATEGORIES)) total += Object.keys(cat.commands).length;
    let text = `╔══════════════════════════╗\n║   🤖  *XITEXE BOT*   🤖   ║\n╚══════════════════════════╝\n\n`;
    text += `⚡ *${total}+ commands* across 4 categories\n📱 Prefix: \`.\` or \`!\`\n\n`;
    text += `*📂 Categories:*\n`;
    for (const [key, cat] of Object.entries(CATEGORIES)) {
        const count = Object.keys(cat.commands).length;
        text += `${cat.emoji} \`.${key}\` — ${cat.title} (${count})\n`;
    }
    text += `\n*🔥 Quick start:*\n• \`.ping\` — test the bot\n• \`.joke\` — get a laugh\n• \`.calc 5*8\` — do math\n• \`.password 20\` — strong password`;
    return ctx.reply(text);
}

function sendCategory(ctx, catKey) {
    const cat = CATEGORIES[catKey];
    if (!cat) return ctx.reply('❌ Unknown category');
    const count = Object.keys(cat.commands).length;
    let text = `╔══════════════════════════╗\n║  ${cat.emoji}  *${cat.title}* (${count})\n╚══════════════════════════╝\n\n`;
    for (const [cmd, desc] of Object.entries(cat.commands)) text += `▸ \`.${cmd}\`\n   _${desc}_\n`;
    return ctx.reply(text);
}

const COMMANDS = {
    menu: sendMenu, help: sendMenu,
    fun: ctx => sendCategory(ctx, 'fun'),
    util: ctx => sendCategory(ctx, 'util'),
    sec: ctx => sendCategory(ctx, 'sec'),
    info: ctx => sendCategory(ctx, 'info'),
    joke: ctx => ctx.reply('😄 ' + rand(DATA.jokes)),
    quote: ctx => ctx.reply('💬 ' + rand(DATA.quotes)),
    fact: ctx => ctx.reply('🧠 ' + rand(DATA.facts)),
    dice: ctx => ctx.reply(`🎲 ${Math.floor(Math.random() * 6) + 1}`),
    coinflip: ctx => ctx.reply(Math.random() < 0.5 ? 'Heads 🪙' : 'Tails 🪙'),
    '8ball': ctx => ctx.reply('🎱 ' + rand(["Yes ✅","No ❌","Maybe 🤔","Definitely 💯"])),
    truth: ctx => ctx.reply('💬 ' + rand(DATA.truths)),
    dare: ctx => ctx.reply('🔥 ' + rand(DATA.dares)),
    roast: ctx => ctx.reply('🔥 ' + rand(DATA.roasts)),
    compliment: ctx => ctx.reply('💚 ' + rand(DATA.compliments)),
    vibe: ctx => ctx.reply('✨ ' + rand(DATA.vibes)),
    yesno: ctx => ctx.reply(rand(['YES ✅','NO ❌','MAYBE 🤔'])),
    lucky: ctx => { const n = Math.floor(Math.random() * 100) + 1; ctx.reply(`🍀 ${n}`); },
    ship: (ctx, arg) => { const n = arg.split(/\s+and\s+/i); if (n.length < 2) return ctx.reply('Usage: .ship A and B'); ctx.reply(`💘 ${n[0].trim()} × ${n[1].trim()}\n${Math.floor(Math.random() * 100) + 1}%`); },
    rate: (ctx, arg) => ctx.reply(`⭐ ${arg || 'it'}: ${Math.floor(Math.random() * 10) + 1}/10`),
    advice: ctx => ctx.reply('💡 ' + rand(DATA.advice)),
    pick: (ctx, arg) => { const o = arg.split(',').filter(Boolean); if (o.length < 2) return ctx.reply('Usage: .pick pizza, burger'); ctx.reply(`🎯 ${rand(o).trim()}`); },
    roll: (ctx, arg) => { const m = arg.match(/^(\d+)d(\d+)$/); if (!m) return ctx.reply('Usage: .roll 2d6'); let t = 0; for (let i = 0; i < Math.min(parseInt(m[1]), 20); i++) t += Math.floor(Math.random() * parseInt(m[2])) + 1; ctx.reply(`🎲 Total: ${t}`); },
    riddle: async ctx => { const r = rand([{ q: "What has keys but can't open locks?", a: "A piano" },{ q: "What gets wetter the more it dries?", a: "A towel" }]); await ctx.reply(`🧩 ${r.q}`); setTimeout(() => ctx.reply(`💡 ${r.a}`), 20000); },
    time: ctx => ctx.reply(`🕐 ${new Date().toLocaleString()}`),
    date: ctx => ctx.reply(`📅 ${new Date().toDateString()}`),
    week: ctx => ctx.reply(`📅 ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()]}`),
    month: ctx => ctx.reply(`📅 ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][new Date().getMonth()]}`),
    calc: (ctx, arg) => { if (!arg) return ctx.reply('Usage: .calc 2+2'); if (!/^[0-9+\-*/().\s]+$/.test(arg)) return ctx.reply('❌ Only numbers'); try { ctx.reply(`🧮 ${arg} = ${eval(arg)}`); } catch { ctx.reply('❌ Invalid'); } },
    random: (ctx, arg) => { const a = arg.split(' '); const min = parseInt(a[0]) || 1; const max = parseInt(a[1]) || 100; ctx.reply(`🎲 ${Math.floor(Math.random() * (max - min + 1)) + min}`); },
    password: (ctx, arg) => { const len = Math.min(parseInt(arg) || 16, 64); const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'; let p = ''; for (let i = 0; i < len; i++) p += chars[Math.floor(Math.random() * chars.length)]; ctx.reply(`🔐 ${p}`); },
    uuid: ctx => { const u = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }); ctx.reply(`🆔 ${u}`); },
    reverse: (ctx, arg) => ctx.reply(arg ? arg.split('').reverse().join('') : 'Usage: .reverse hello'),
    upper: (ctx, arg) => ctx.reply(arg ? arg.toUpperCase() : 'Usage'),
    lower: (ctx, arg) => ctx.reply(arg ? arg.toLowerCase() : 'Usage'),
    len: (ctx, arg) => ctx.reply(`Length: ${arg.length}`),
    count: (ctx, arg) => ctx.reply(`📊 Chars: ${arg.length} | Words: ${arg.split(/\s+/).filter(Boolean).length}`),
    spell: (ctx, arg) => ctx.reply(arg ? arg.split('').join(' - ') : 'Usage'),
    slugify: (ctx, arg) => ctx.reply(arg ? arg.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'Usage'),
    shuffle: (ctx, arg) => { if (!arg) return ctx.reply('Usage'); const arr = arg.split(''); for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } ctx.reply(`🔀 ${arr.join('')}`); },
    caesar: (ctx, arg) => { const p = arg.split(' '); const shift = parseInt(p[0]) || 3; const t = p.slice(1).join(' '); if (!t) return ctx.reply('Usage: .caesar 3 hello'); ctx.reply(`🔐 ${t.replace(/[a-z]/gi, c => { const base = c <= 'Z' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - base + shift + 26) % 26 + base); })}`); },
    vowels: (ctx, arg) => ctx.reply(`🔤 Vowels: ${(arg.toLowerCase().match(/[aeiou]/g) || []).length}`),
    morse: (ctx, arg) => { const t = arg.toLowerCase(); const map = { a:'.-', b:'-...', c:'-.-.', d:'-..', e:'.', f:'..-.', g:'--.', h:'....', i:'..', j:'.---', k:'-.-', l:'.-..', m:'--', n:'-.', o:'---', p:'.--.', q:'--.-', r:'.-.', s:'...', t:'-', u:'..-', v:'...-', w:'.--', x:'-..-', y:'-.--', z:'--..', ' ':'/' }; ctx.reply(`📡 ${t.split('').map(c => map[c] || c).join(' ')}`); },
    sha256: (ctx, arg) => ctx.reply(arg ? `🔐 ${crypto.createHash('sha256').update(arg).digest('hex')}` : 'Usage'),
    md5: (ctx, arg) => ctx.reply(arg ? `🔐 ${crypto.createHash('md5').update(arg).digest('hex')}` : 'Usage'),
    b64encode: (ctx, arg) => ctx.reply(arg ? Buffer.from(arg).toString('base64') : 'Usage'),
    b64decode: (ctx, arg) => { try { ctx.reply(Buffer.from(arg, 'base64').toString()); } catch { ctx.reply('❌ Invalid'); } },
    binary: (ctx, arg) => { const n = parseInt(arg); isNaN(n) ? ctx.reply('Usage') : ctx.reply(`🔢 ${n.toString(2)}`); },
    hex: (ctx, arg) => { const n = parseInt(arg); isNaN(n) ? ctx.reply('Usage') : ctx.reply(`🔢 ${n.toString(16).toUpperCase()}`); },
    octal: (ctx, arg) => { const n = parseInt(arg); isNaN(n) ? ctx.reply('Usage') : ctx.reply(`🔢 ${n.toString(8)}`); },
    primes: (ctx, arg) => { const n = Math.min(parseInt(arg) || 20, 500); const primes = []; for (let i = 2; i <= n; i++) { let p = true; for (let j = 2; j <= Math.sqrt(i); j++) if (i % j === 0) { p = false; break; } if (p) primes.push(i); } ctx.reply(`🔢 ${primes.join(', ')}`); },
    fibonacci: (ctx, arg) => { const n = Math.min(parseInt(arg) || 10, 50); const fib = [0, 1]; for (let i = 2; i < n; i++) fib.push(fib[i - 1] + fib[i - 2]); ctx.reply(`🔢 ${fib.slice(0, n).join(', ')}`); },
    factorial: (ctx, arg) => { const n = parseInt(arg); if (isNaN(n) || n < 0 || n > 170) return ctx.reply('Usage'); let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; ctx.reply(`🔢 ${n}! = ${r}`); },
    gcd: (ctx, arg) => { const a = arg.split(/\s+/).map(Number); if (a.length < 2) return ctx.reply('Usage'); const gcd = (x, y) => y ? gcd(y, x % y) : x; ctx.reply(`🔢 GCD: ${a.reduce(gcd)}`); },
    bmi: (ctx, arg) => { const p = arg.split(' '); const w = parseFloat(p[0]), h = parseFloat(p[1]); if (!w || !h) return ctx.reply('Usage: .bmi 70 1.75'); const bmi = (w / (h * h)).toFixed(1); ctx.reply(`⚖️ BMI: ${bmi}`); },
    tip: (ctx, arg) => { const p = arg.split(' '); const bill = parseFloat(p[0]), pct = parseFloat(p[1]) || 10; if (!bill) return ctx.reply('Usage'); ctx.reply(`💵 Tip: ${(bill * pct / 100).toFixed(2)}`); },
    split: (ctx, arg) => { const p = arg.split(' '); const bill = parseFloat(p[0]), people = parseInt(p[1]); if (!bill || !people) return ctx.reply('Usage'); ctx.reply(`💵 ${(bill / people).toFixed(2)} each`); },
    percent: (ctx, arg) => { const p = arg.split(' '); const num = parseFloat(p[0]), pct = parseFloat(p[1]); if (!num || !pct) return ctx.reply('Usage'); ctx.reply(`📊 ${(num * pct / 100).toFixed(2)}`); },
    age: (ctx, arg) => { const d = new Date(arg); if (isNaN(d)) return ctx.reply('Usage'); let years = new Date().getFullYear() - d.getFullYear(); const m = new Date().getMonth() - d.getMonth(); if (m < 0 || (m === 0 && new Date().getDate() < d.getDate())) years--; ctx.reply(`🎂 ${years} years`); },
    daysuntil: (ctx, arg) => { const d = new Date(arg); if (isNaN(d)) return ctx.reply('Usage'); const days = Math.ceil((d - new Date()) / 86400000); ctx.reply(days < 0 ? `Was ${-days} days ago` : `⏳ ${days} days`); },
    countdown: (ctx, arg) => { const d = new Date(arg); if (isNaN(d)) return ctx.reply('Usage'); const days = Math.ceil((d - new Date()) / 86400000); ctx.reply(days < 0 ? `Was ${-days} days ago` : `⏳ ${days} days`); },
    unixtime: ctx => ctx.reply(`🕐 ${Math.floor(Date.now() / 1000)}`),
    hexcolor: (ctx, arg) => { const hex = arg.replace('#', ''); if (!/^[0-9a-fA-F]{6}$/.test(hex)) return ctx.reply('Usage'); ctx.reply(`🎨 #${hex.toUpperCase()}`); },
    rgb: (ctx, arg) => { const a = arg.split(/[\s,]+/).map(Number); if (a.length < 3) return ctx.reply('Usage'); ctx.reply(`🎨 #${a.slice(0, 3).map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`); },
    mood: (ctx, arg) => ctx.reply(arg ? `💭 ${arg}` : 'Usage'),
    goal: (ctx, arg) => arg ? ctx.reply(`🎯 ${arg}`) : ctx.reply('Usage'),
    mygoal: ctx => ctx.reply('Use .goal'),
    strength: (ctx, arg) => { if (!arg) return ctx.reply('Usage'); const score = [arg.length >= 8, arg.length >= 12, /[a-z]/.test(arg), /[A-Z]/.test(arg), /[0-9]/.test(arg), /[^a-zA-Z0-9]/.test(arg)].filter(Boolean).length; ctx.reply(`🔐 ${score >= 5 ? 'Very Strong 🟢' : score >= 4 ? 'Strong 🟡' : score >= 3 ? 'Medium 🟠' : 'Weak 🔴'}`); },
    scamcheck: (ctx, arg) => { const t = arg.toLowerCase(); const f = []; if (/urgent|immediately/.test(t)) f.push('Urgency'); if (/click here/.test(t)) f.push('Click bait'); if (/otp|password|pin/.test(t)) f.push('Sensitive info'); ctx.reply(`🔍 ${f.length ? f.join(', ') : '✅ None'}`); },
    linkcheck: (ctx, arg) => { const u = arg.toLowerCase(); const f = []; if (/bit\.ly|tinyurl/.test(u)) f.push('Shortener'); if (!/^https:\/\//.test(u)) f.push('Not HTTPS'); ctx.reply(`🔗 ${f.length ? f.join(', ') : '✅ No risks'}`); },
    sectips: ctx => ctx.reply('🔒 ' + rand(DATA.sectips)),
    phishing: ctx => ctx.reply(rand(DATA.phishing)),
    randpin: (ctx, arg) => { const len = Math.min(parseInt(arg) || 6, 12); let pin = ''; for (let i = 0; i < len; i++) pin += Math.floor(Math.random() * 10); ctx.reply(`🔢 ${pin}`); },
    otp: ctx => ctx.reply('🔐 Never share an OTP.'),
    linuxcmd: (ctx, arg) => { const c = arg.toLowerCase(); const cmds = { 'ls': 'List files', 'cd': 'Change dir', 'chmod': 'Permissions', 'grep': 'Search text', 'ssh': 'Remote connect', 'tar': 'Archive' }; ctx.reply(cmds[c] ? `🐧 ${c}: ${cmds[c]}` : 'Try: ls, cd, chmod, grep, ssh, tar'); },
    ping: async ctx => { const t = Date.now(); await ctx.reply('🏓 Pong!'); ctx.reply(`⚡ ${Date.now() - t}ms`); }
};

// ===== STYLED QR / PAIRING PAGE =====
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
    <title>XITEXE WhatsApp Bot</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
            background: #0a0a0a;
            color: #e0e0e0;
            font-family: 'Segoe UI', system-ui, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background-image:
                radial-gradient(circle at 20% 50%, rgba(0, 200, 83, 0.08) 0%, transparent 50%),
                radial-gradient(circle at 80% 50%, rgba(255, 0, 255, 0.05) 0%, transparent 50%);
        }
        .card {
            background: #121212;
            border: 1px solid #222;
            border-radius: 20px;
            padding: 40px 30px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
            position: relative;
            overflow: hidden;
        }
        .card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 3px;
            background: linear-gradient(90deg, #00c853, #ff00ff, #00c853);
            background-size: 200% 100%;
            animation: shimmer 3s linear infinite;
        }
        @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
        .logo { text-align: center; font-size: 3rem; margin-bottom: 10px; }
        h1 { text-align: center; font-size: 1.4rem; color: #00c853; margin-bottom: 6px; font-weight: 700; letter-spacing: 1px; }
        .subtitle { text-align: center; color: #666; font-size: 0.8rem; margin-bottom: 25px; letter-spacing: 0.5px; }
        .tabs { display: flex; gap: 8px; margin-bottom: 25px; background: #0a0a0a; padding: 6px; border-radius: 12px; border: 1px solid #1a1a1a; }
        .tab {
            flex: 1;
            padding: 12px;
            text-align: center;
            background: transparent;
            color: #888;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 600;
            transition: 0.2s;
            text-decoration: none;
            display: block;
        }
        .tab:hover { color: #ccc; }
        .tab.active { background: #00c853; color: #000; }
        .status { text-align: center; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
        .status.ready { background: rgba(0, 200, 83, 0.08); border: 1px solid rgba(0, 200, 83, 0.3); }
        .status.waiting { background: rgba(255, 170, 0, 0.08); border: 1px solid rgba(255, 170, 0, 0.3); }
        .status-icon { font-size: 3rem; display: block; margin-bottom: 10px; }
        .status-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 6px; }
        .status.ready .status-title { color: #00c853; }
        .status.waiting .status-title { color: #ffaa00; }
        .status-text { color: #888; font-size: 0.85rem; }
        .live-box {
            background: #0a0a0a;
            border: 1px solid #1a1a1a;
            border-radius: 14px;
            padding: 25px;
            margin-bottom: 20px;
            text-align: center;
        }
        .live-label {
            color: #00c853;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 15px;
        }
        .counter-display {
            font-family: 'Courier New', monospace;
            font-size: 3rem;
            font-weight: 700;
            color: #00c853;
            margin-bottom: 10px;
            text-shadow: 0 0 20px rgba(0, 200, 83, 0.5);
            letter-spacing: 4px;
        }
        .counter-line {
            color: #bbb;
            font-size: 1rem;
            font-family: 'Courier New', monospace;
            margin-bottom: 8px;
        }
        .counter-line .arrow { color: #ff00ff; font-weight: 700; margin: 0 8px; }
        .counter-line .result { color: #00c853; font-weight: 700; }
        .progress-bar {
            background: #1a1a1a;
            height: 4px;
            border-radius: 2px;
            overflow: hidden;
            margin-top: 20px;
        }
        .progress-fill {
            background: linear-gradient(90deg, #00c853, #ff00ff);
            height: 100%;
            width: 0%;
            animation: progress 3s ease-in-out infinite;
        }
        @keyframes progress {
            0% { width: 10%; }
            50% { width: 80%; }
            100% { width: 10%; }
        }
        .fact-text {
            color: #888;
            font-size: 0.8rem;
            margin-top: 15px;
            font-style: italic;
        }
        .qr-wrapper {
            background: #ffffff;
            border-radius: 16px;
            padding: 20px;
            margin: 0 auto 20px;
            width: fit-content;
            box-shadow: 0 0 40px rgba(0, 200, 83, 0.15);
        }
        .qr-wrapper img { display: block; width: 280px; height: 280px; }
        .code-display {
            background: #0a0a0a;
            border: 2px dashed #00c853;
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 20px;
            text-align: center;
        }
        .code-value {
            font-family: 'Courier New', monospace;
            font-size: 2.5rem;
            font-weight: 700;
            color: #00c853;
            letter-spacing: 8px;
            margin-bottom: 10px;
        }
        .code-hint { color: #888; font-size: 0.8rem; }
        .instructions { background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; }
        .instructions-title { color: #00c853; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
        .step { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 10px; font-size: 0.85rem; color: #bbb; }
        .step:last-child { margin-bottom: 0; }
        .step-num { background: #00c853; color: #000; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
        .commands-preview { background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 12px; padding: 16px 20px; }
        .commands-title { color: #00c853; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
        .cmd-tag { display: inline-block; background: rgba(0, 200, 83, 0.1); color: #00c853; border: 1px solid rgba(0, 200, 83, 0.3); padding: 4px 10pxpx; border solid-radius: 6px; font-size: 0.75rem; font-family: 'Courier New', monospace; margin: 0 6px 6px 0; }
        .footer { text-align: center; color: #444; font-size: 0.7rem; margin-top: 20px; letter-spacing: 0.5px; }
        .footer a { color: #00c853; text-decoration: none; }
        .phone-input {
            width: 100%;
            padding: 14px;
            background: #0a0a0a;
            border: 1 #333;
            border-radius: 8px;
            color: #fff;
            font-size: 1rem;
            margin-bottom: 10px;
            font-family: 'Courier New', monospace;
            letter-spacing: 1px;
        }
        .phone-input:focus { outline: none; border-color: #00c853; }
        .submit-btn {
            width: 100%;
            padding: 14px;
            background: #00c853;
            color: #000;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: bold;
            cursor: pointer;
        }
        .submit-btn:hover { background: #00e676; }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">🤖</div>
        <h1>XITEXE BOT</h1>
        <div class="subtitle">WHATSAPP AUTOMATION</div>
        <div id="content"></div>
        <div class="footer">Powered by <a href="#">@Xitexes</a></div>
    </div>

    <script>
        const facts = [
            "Did you know? Octopuses have three hearts 🐙",
            "Did you know? Honey never spoils 🍯",
            "Did you know? A day on Venus is longer than a year on Venus 🪐",
            "Did you know? Bananas are berries, strawberries aren't 🍌",
            "Did you know? Sharks existed before trees 🦈",
            "Did you know? Butterflies taste with their feet 🦋",
            "Did you know? The first computer bug was a real moth 🦋",
            "Did you know? A group of flamingos is called a flamboyance 🦩",
            "Did you know? Water makes up ~60% of the human body 💧",
            "Did you know? The shortest war lasted 38 minutes ⚔️"
        ];

        let counter = 10;
        let state = { isReady: false, qr: null, pairingCode: null };

        function getMode() {
            return new URLSearchParams(window.location.search).get('mode') || 'qr';
        }

        function renderWaitingCounter() {
            const fact = facts[counter % facts.length];
            return '<div class="status waiting">' +
                '<span class="status-icon">⚡</span>' +
                '<div class="status-title">Booting up</div>' +
                '<div class="status-text">Launching Chrome and connecting</div>' +
                '</div>' +
                '<div class="live-box">' +
                '<div class="live-label">Live counter</div>' +
                '<div class="counter-display">' + counter + '</div>' +
                '<div class="counter-line">' +
                '<span>' + counter + '</span>' +
                '<span class="arrow">+</span>' +
                '<span>1</span>' +
                '<span class="arrow">=</span>' +
                '<span class="result">' + (counter + 1) + '</span>' +
                '</div>' +
                '<div class="progress-bar"><div class="progress-fill"></div></div>' +
                '<div class="fact-text">' + fact + '</div>' +
                '</div>';
        }

        function renderWaitingPairing() {
            const fact = facts[counter % facts.length];
            return '<div class="status waiting">' +
                '<span class="status-icon">📱</span>' +
                '<div class="status-title">Enter your phone number</div>' +
                '<div class="status-text">Include country code — e.g. 2348012345678</div>' +
                '</div>' +
                '<form method="POST" action="/start-pair">' +
                '<input type="tel" name="phone" class="phone-input" placeholder="2348012345678" required />' +
                '<button type="submit" class="submit-btn">🔐 Generate Pairing Code</button>' +
                '</form>' +
                '<div class="live-box" style="margin-top:20px;">' +
                '<div class="live-label">Live counter</div>' +
                '<div class="counter-display">' + counter + '</div>' +
                '<div class="counter-line">' +
                '<span>' + counter + '</span>' +
                '<span class="arrow">+</span>' +
                '<span>1</span>' +
                '<span class="arrow">=</span>' +
                '<span class="result">' + (counter + 1) + '</span>' +
                '</div>' +
                '<div class="fact-text">' + fact + '</div>' +
                '</div>';
        }

        function renderReady() {
            return '<div class="status ready">' +
                '<span class="status-icon">✅</span>' +
                '<div class="status-title">Bot is running</div>' +
                '<div class="status-text">Linked to WhatsApp — ready to use</div>' +
                '</div>' +
                '<div class="instructions">' +
                '<div class="instructions-title">💬 Try it now</div>' +
                '<div class="step"><span class="step-num">1</span><span>Open any WhatsApp chat</span></div>' +
                '<div class="step"><span class="step-num">2</span><span>Send <strong style="color:#00c853;">.menu</strong> to see all commands</span></div>' +
                '<div class="step"><span class="step-num">3</span><span>Send <strong style="color:#00c853;">.ping</strong> to check the bot is alive</span></div>' +
                '</div>' +
                '<div class="commands-preview">' +
                '<div class="commands-title">🎯 Popular Commands</div>' +
                '<span class="cmd-tag">.menu</span>' +
                '<span class="cmd-tag">.joke</span>' +
                '<span class="cmd-tag">.ping</span>' +
                '<span class="cmd-tag">.calc</span>' +
                '<span class="cmd-tag">.password</span>' +
                '<span class="cmd-tag">.fun</span>' +
                '<span class="cmd-tag">.util</span>' +
                '<span class="cmd-tag">.sec</span>' +
                '</div>';
        }

        function renderQR() {
            return '<div class="qr-wrapper">' +
                '<img src="https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=' + encodeURIComponent(state.qr) + '" alt="QR" />' +
                '</div>' +
                '<div class="instructions">' +
                '<div class="instructions-title">📋 How to scan</div>' +
                '<div class="step"><span class="step-num">1</span><span>Open <strong>WhatsApp</strong> on your phone</span></div>' +
                '<div class="step"><span class="step-num">2</span><span>Tap <strong>Settings</strong> → <strong>Linked Devices</strong></span></div>' +
                '<div class="step"><span class="step-num">3</span><span>Tap <strong>Link a Device</strong></span></div>' +
                '<div class="step"><span class="step-num">4</span><span>Point your phone at the QR code</span></div>' +
                '</div>';
        }

        function renderPairingCode() {
            const formatted = state.pairingCode.match(/.{1,4}/g).join(' ');
            return '<div class="status waiting">' +
                '<span class="status-icon">🔐</span>' +
                '<div class="status-title">Enter this code in WhatsApp</div>' +
                '<div class="status-text">Settings → Linked Devices → Link with phone number</div>' +
                '</div>' +
                '<div class="code-display">' +
                '<div class="code-value">' + formatted + '</div>' +
                '<div class="code-hint">Expires in a few minutes</div>' +
                '</div>' +
                '<div class="instructions">' +
                '<div class="instructions-title">📋 How to use</div>' +
                '<div class="step"><span class="step-num">1</span><span>Open <strong>WhatsApp</strong> on your phone</span></div>' +
                '<div class="step"><span class="step-num">2</span><span>Tap <strong>Settings</strong> → <strong>Linked Devices</strong></span></div>' +
                '<div class="step"><span class="step-num">3</span><span>Tap <strong>Link with phone number</strong></span></div>' +
                '<div class="step"><span class="step-num">4</span><span>Enter the code above</span></div>' +
                '</div>';
        }

        function renderTabs() {
            const mode = getMode();
            return '<div class="tabs">' +
                '<a href="/?mode=qr" class="tab ' + (mode === 'qr' ? 'active' : '') + '">📱 QR Code</a>' +
                '<a href="/?mode=pair" class="tab ' + (mode === 'pair' ? 'active' : '') + '">🔐 Pairing Code</a>' +
                '</div>';
        }

        function render() {
            const content = document.getElementById('content');
            const mode = getMode();
            let html = '';

            if (state.isReady) {
                html = renderReady();
            } else {
                html = renderTabs();
                if (mode === 'pair') {
                    if (state.pairingCode) {
                        html += renderPairingCode();
                    } else {
                        html += renderWaitingPairing();
                    }
                } else {
                    if (state.qr) {
                        html += renderQR();
                    } else {
                        html += renderWaitingCounter();
                    }
                }
            }

            content.innerHTML = html;
        }

        async function poll() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                const changed =
                    data.isReady !== state.isReady ||
                    data.qr !== state.qr ||
                    data.pairingCode !== state.pairingCode;
                state = data;
                if (changed) render();
            } catch (e) {}
        }

        function tick() {
            counter++;
            const display = document.querySelector('.counter-display');
            if (display) {
                display.textContent = counter;
                const line = display.nextElementSibling;
                if (line && line.classList.contains('counter-line')) {
                    line.innerHTML = '<span>' + counter + '</span><span class="arrow">+</span><span>1</span><span class="arrow">=</span><span class="result">' + (counter + 1) + '</span>';
                }
            }
            const factsEl = document.querySelector('.fact-text');
            if (factsEl) factsEl.textContent = facts[counter % facts.length];
        }

        // Initial render + start polling and ticking
        render();
        setInterval(tick, 1000);
        setInterval(poll, 2000);
        poll();
    </script>
</body>
</html>`);
});

// Status API for polling
app.get('/api/status', (req, res) => {
    res.json({
        isReady,
        qr: latestQR,
        pairingCode: latestPairingCode
    });
});

// Initiate pairing mode
app.post('/start-pair', (req, res) => {
    const phone = (req.body.phone || '').replace(/\D/g, '');
    if (!phone || phone.length < 10) return res.redirect('/?mode=pair');
    createClient(true, phone);
    res.redirect('/?mode=pair');
});

// Reset to QR mode
app.get('/reset', (req, res) => {
    createClient(false);
    res.redirect('/');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

// Start in QR mode by default
createClient(false);
