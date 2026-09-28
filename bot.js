const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

let latestQR = null;
let isReady = false;

// WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: 'new',
        // Use the system Chromium installed by the Dockerfile
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

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

client.on('authenticated', () => {
    console.log('🔐 Authenticated');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Auth failed:', msg);
});

client.on('disconnected', (reason) => {
    console.log('⚠️ Disconnected:', reason);
    isReady = false;
});

// Command handler
client.on('message', async (msg) => {
    const raw = msg.body.trim();
    const text = raw.toLowerCase();
    const cmd = text.split(' ')[0];

    try {
        if (cmd === '!ping') {
            await msg.reply('pong 🏓');
        }
        else if (cmd === '!hi' || cmd === '!hello') {
            await msg.reply('Hello 👋');
        }
        else if (cmd === '!time') {
            await msg.reply(`🕐 ${new Date().toLocaleString()}`);
        }
        else if (cmd === '!date') {
            await msg.reply(`📅 ${new Date().toDateString()}`);
        }
        else if (cmd === '!joke') {
            const jokes = [
                "Why do programmers prefer dark mode? Light attracts bugs 🐛",
                "Why did the dev go broke? He used up all his cache 💸",
                "I'd tell you a UDP joke, but you might not get it 📡"
            ];
            await msg.reply(jokes[Math.floor(Math.random() * jokes.length)]);
        }
        else if (cmd === '!calc') {
            const expr = raw.slice(6).trim();
            if (!expr) return msg.reply('Usage: !calc 2+2');
            if (!/^[0-9+\-*/().\s]+$/.test(expr)) return msg.reply('❌ Only numbers allowed');
            try {
                await msg.reply(`🧮 ${expr} = ${eval(expr)}`);
            } catch {
                await msg.reply('❌ Invalid');
            }
        }
        else if (cmd === '!help') {
            await msg.reply(
                '📋 Commands:\n' +
                '!ping - pong\n' +
                '!hi - hello\n' +
                '!time - current time\n' +
                '!date - today\n' +
                '!joke - random joke\n' +
                '!calc 2+2 - math\n' +
                '!help - this menu'
            );
        }
    } catch (e) {
        console.error(e);
    }
});

// Web page for QR code
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp Bot</title>
            <meta http-equiv="refresh" content="3">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {
                    background: #0a0a0a;
                    color: #00ff00;
                    font-family: monospace;
                    text-align: center;
                    padding: 20px;
                }
                h1 { color: #ff00ff; }
                img {
                    border: 3px solid #00ff00;
                    border-radius: 10px;
                    margin: 20px 0;
                }
                .ok { color: #00ff00; font-size: 2rem; }
                .wait { color: #ffaa00; }
            </style>
        </head>
        <body>
            ${isReady ? `
                <h1 class="ok">✅ Bot is running!</h1>
                <p>Send !help to your bot on WhatsApp</p>
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
