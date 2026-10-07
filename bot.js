const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const PORT = process.env.PORT || 10000;

let latestQR = null;
let latestPairingCode = null;
let isReady = false;
let usePairingCode = false;
let client = null;

// ===== CREATE CLIENT =====
function createClient(usePairing, phone) {
    if (client) {
        try { client.destroy(); } catch (e) {}
    }

    usePairingCode = usePairing;
    isReady = false;
    latestQR = null;
    latestPairingCode = null;

    const options = {
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
    };

    if (usePairing && phone) {
        options.pairWithPhoneNumber = {
            phoneNumber: phone.replace(/\D/g, ''),
            showNotification: true,
            intervalMs: 180000
        };
    }

    client = new Client(options);

    client.on('qr', qr => {
        if (!usePairingCode) {
            latestQR = qr;
            console.log('📱 QR ready');
        }
    });

    client.on('code', code => {
        latestPairingCode = code;
        console.log('🔐 Pairing code:', code);
    });

    client.on('ready', () => {
        isReady = true;
        latestQR = null;
        latestPairingCode = null;
        console.log('✅ Ready');
    });

    client.on('auth_failure', m => console.error('❌ Auth:', m));
    client.on('disconnected', r => {
        console.log('⚠️ Disconnected:', r);
        isReady = false;
    });

    client.on('message', async msg => {
        if (msg.fromMe) return;
        const text = msg.body.trim().toLowerCase();
        if (!text.startsWith('.') && !text.startsWith('!')) return;

        const cmd = text.slice(1).split(' ')[0];

        switch (cmd) {
            case 'ping':
                return msg.reply('🏓 Pong!');
            case 'hi':
                return msg.reply('👋 Hello!');
            case 'time':
                return msg.reply(`🕐 ${new Date().toLocaleString()}`);
            case 'joke':
                return msg.reply('😄 Why do programmers prefer dark mode? Light attracts bugs 🐛');
            case 'menu':
                return msg.reply(
                    `╔══════════════════════╗\n` +
                    `║   🤖  *XITEXE BOT*   ║\n` +
                    `╚══════════════════════╝\n\n` +
                    `▸ \`.ping\` — Test the bot\n` +
                    `▸ \`.hi\` — Say hello\n` +
                    `▸ \`.time\` — Current time\n` +
                    `▸ \`.joke\` — Random joke\n` +
                    `▸ \`.menu\` — This menu`
                );
            default:
                return msg.reply(`❌ Unknown: ${cmd}\nType .menu`);
        }
    });

    client.initialize();
}

// ===== STYLED PAGE =====
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
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
        .tabs { display:flex; gap:8px; margin-bottom:25px; background:#0a0a0a; padding:6px; border-radius:12px; border:1px solid #1a1a1a; }
        .tab {
            flex:1; padding:12px; text-align:center; background:transparent;
            color:#888; border:none; border-radius:8px; cursor:pointer;
            font-size:0.85rem; font-weight:600; transition:0.2s; text-decoration:none; display:block;
        }
        .tab:hover { color:#ccc; }
        .tab.active { background:#00c853; color:#000; }
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
        .code-display {
            background:#0a0a0a; border:2px dashed #00c853; border-radius:16px;
            padding:30px; margin-bottom:20px; text-align:center;
        }
        .code-value {
            font-family:'Courier New',monospace; font-size:2.5rem;
            font-weight:700; color:#00c853; letter-spacing:8px; margin-bottom:10px;
        }
        .code-hint { color:#888; font-size:0.8rem; }
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
        .phone-input {
            width:100%; padding:14px; background:#0a0a0a; border:1px solid #333;
            border-radius:8px; color:#fff; font-size:1rem; margin-bottom:10px;
            font-family:'Courier New',monospace; letter-spacing:1px;
        }
        .phone-input:focus { outline:none; border-color:#00c853; }
        .submit-btn {
            width:100%; padding:14px; background:#00c853; color:#000;
            border:none; border-radius:8px; font-size:1rem; font-weight:bold; cursor:pointer;
        }
        .submit-btn:hover { background:#00e676; }
        .footer { text-align:center; color:#444; font-size:0.7rem; margin-top:20px; letter-spacing:0.5px; }
        .footer a { color:#00c853; text-decoration:none; }
    </style>
    <script>
        let lastState = { ready: null, qr: null, code: null };

        function getMode() {
            return new URLSearchParams(window.location.search).get('mode') || 'qr';
        }

        async function poll() {
            try {
                const r = await fetch('/api/status');
                const d = await r.json();
                if (d.ready !== lastState.ready || d.qr !== lastState.qr || d.code !== lastState.code) {
                    lastState = d;
                    render(d);
                }
            } catch (e) {}
        }

        function render(d) {
            const box = document.getElementById('content');
            const mode = getMode();

            if (d.ready) {
                box.innerHTML = '<div class="status ready"><span class="status-icon">✅</span><div class="status-title">Bot is running</div><div class="status-text">Linked to WhatsApp</div></div>' +
                    '<div class="instructions"><div class="instructions-title">💬 Try it now</div>' +
                    '<div class="step"><span class="step-num">1</span><span>Open any WhatsApp chat</span></div>' +
                    '<div class="step"><span class="step-num">2</span><span>Send <strong style="color:#00c853;">.menu</strong></span></div>' +
                    '<div class="step"><span class="step-num">3</span><span>Send <strong style="color:#00c853;">.ping</strong></span></div></div>' +
                    '<div class="commands-preview"><div class="commands-title">🎯 Commands</div>' +
                    '<span class="cmd-tag">.menu</span><span class="cmd-tag">.ping</span>' +
                    '<span class="cmd-tag">.hi</span><span class="cmd-tag">.time</span>' +
                    '<span class="cmd-tag">.joke</span></div>';
                return;
            }

            const tabs = '<div class="tabs">' +
                '<a href="/?mode=qr" class="tab ' + (mode === 'qr' ? 'active' : '') + '">📱 QR Code</a>' +
                '<a href="/?mode=pair" class="tab ' + (mode === 'pair' ? 'active' : '') + '">🔐 Pairing Code</a>' +
                '</div>';

            if (mode === 'pair') {
                if (d.code) {
                    const formatted = d.code.match(/.{1,4}/g).join(' ');
                    box.innerHTML = tabs +
                        '<div class="status waiting"><span class="status-icon">🔐</span><div class="status-title">Enter this code in WhatsApp</div><div class="status-text">Settings → Linked Devices → Link with phone number</div></div>' +
                        '<div class="code-display"><div class="code-value">' + formatted + '</div><div class="code-hint">Expires in a few minutes</div></div>' +
                        '<div class="instructions"><div class="instructions-title">📋 How to use</div>' +
                        '<div class="step"><span class="step-num">1</span><span>Open <strong>WhatsApp</strong></span></div>' +
                        '<div class="step"><span class="step-num">2</span><span>Settings → <strong>Linked Devices</strong></span></div>' +
                        '<div class="step"><span class="step-num">3</span><span>Tap <strong>Link with phone number</strong></span></div>' +
                        '<div class="step"><span class="step-num">4</span><span>Enter the code above</span></div></div>';
                } else {
                    box.innerHTML = tabs +
                        '<div class="status waiting"><span class="status-icon">📱</span><div class="status-title">Enter your phone number</div><div class="status-text">Include country code — e.g. 2348012345678</div></div>' +
                        '<form method="POST" action="/start-pair">' +
                        '<input type="tel" name="phone" class="phone-input" placeholder="2348012345678" required />' +
                        '<button type="submit" class="submit-btn">🔐 Generate Pairing Code</button>' +
                        '</form>';
                }
                return;
            }

            // QR mode
            if (d.qr) {
                box.innerHTML = tabs +
                    '<div class="qr-wrapper"><img src="https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=' + encodeURIComponent(d.qr) + '" /></div>' +
                    '<div class="instructions"><div class="instructions-title">📋 How to scan</div>' +
                    '<div class="step"><span class="step-num">1</span><span>Open <strong>WhatsApp</strong></span></div>' +
                    '<div class="step"><span class="step-num">2</span><span>Settings → <strong>Linked Devices</strong></span></div>' +
                    '<div class="step"><span class="step-num">3</span><span>Tap <strong>Link a Device</strong></span></div>' +
                    '<div class="step"><span class="step-num">4</span><span>Point at the QR code</span></div></div>';
            } else {
                box.innerHTML = tabs +
                    '<div class="status waiting"><span class="status-icon">⚡</span><div class="status-title">Booting up</div><div class="status-text">Chrome is launching</div></div>' +
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
</html>`);
});

app.get('/api/status', (req, res) => {
    res.json({
        ready: isReady,
        qr: latestQR,
        code: latestPairingCode
    });
});

// Start pairing mode
app.post('/start-pair', (req, res) => {
    const phone = (req.body.phone || '').replace(/\D/g, '');
    if (!phone || phone.length < 10) return res.redirect('/?mode=pair');
    createClient(true, phone);
    res.redirect('/?mode=pair');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web on ${PORT}`);
});

// Start in QR mode
createClient(false);
