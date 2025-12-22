
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import crypto from 'crypto';
import { GoogleGenAI } from "@google/genai";
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath });
}

const app = express();

// --- PROXY FIX ---
app.set('trust proxy', true);

app.use(cors());
app.post('/webhook/stripe', bodyParser.raw({ type: 'application/json' }), (req, res) => res.json({received: true}));
app.use(bodyParser.json());

const DB_FILE = path.resolve(__dirname, 'db.json');
const defaultDb = { users: [], subscriptions: [], usage: [], accounts: [], settings: {}, incoming_events: [] };
let db = { ...defaultDb };

function loadDb() {
    if (fs.existsSync(DB_FILE)) {
        try {
            const rawData = fs.readFileSync(DB_FILE, 'utf8');
            db = rawData.trim() ? { ...defaultDb, ...JSON.parse(rawData) } : { ...defaultDb };
            if (!db.incoming_events) db.incoming_events = [];
        } catch (e) {
            db = { ...defaultDb };
        }
    }
}
loadDb();

function saveDb() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const getRedirectUri = (req, path) => {
    if (db.settings?.publicUrl) {
        const base = db.settings.publicUrl.replace(/\/$/, '');
        return `${base}${path}`;
    }
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const finalProto = (protocol === 'http' && !host.includes('localhost')) ? 'https' : protocol;
    return `${finalProto}://${host}${path}`;
};

const getMetaConfig = () => ({
    appId: process.env.FACEBOOK_APP_ID || db.settings?.metaAppId,
    appSecret: process.env.FACEBOOK_APP_SECRET || db.settings?.metaAppSecret,
    verifyToken: process.env.WEBHOOK_VERIFY_TOKEN || db.settings?.webhookVerifyToken || 'autochat_verify_token'
});

const CONFIG = {
    PORT: process.env.PORT || 3000,
    JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_key_123',
    STRIPE_KEY: process.env.STRIPE_SECRET_KEY,
    PLANS: {
        free: { limit: 100, ai: false, accounts: 1, priceId: '' },
        pro: { limit: 5000, ai: true, accounts: 5, priceId: 'price_pro_dummy' },
        business: { limit: 25000, ai: true, accounts: 999, priceId: 'price_biz_dummy' }
    }
};

const stripe = CONFIG.STRIPE_KEY ? new Stripe(CONFIG.STRIPE_KEY) : null;

const findUser = (email) => db.users.find(u => u.email === email);
const getUserById = (id) => db.users.find(u => u.id === id);

const getUsage = (userId) => {
    const month = new Date().toISOString().slice(0, 7);
    let rec = db.usage.find(u => u.userId === userId && u.month === month);
    if (!rec) {
        rec = { userId, month, count: 0 };
        db.usage.push(rec);
        saveDb();
    }
    return rec;
};

// --- AUTH MIDDLEWARE ---
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, CONFIG.JWT_SECRET);
        req.user = getUserById(decoded.id);
        if (!req.user) throw new Error();
        next();
    } catch (e) { res.status(401).json({ error: 'Invalid token' }); }
};

// --- API ROUTES ---

app.get('/api/config/status', (req, res) => {
    const meta = getMetaConfig();
    res.json({
        metaConfigured: !!(meta.appId && meta.appSecret),
        aiConfigured: !!process.env.API_KEY,
        stripeConfigured: !!(CONFIG.STRIPE_KEY && !CONFIG.STRIPE_KEY.includes('placeholder')),
        metaAppId: meta.appId,
        publicUrl: db.settings?.publicUrl,
        verifyToken: meta.verifyToken
    });
});

app.post('/api/config/settings', (req, res) => {
    const { metaAppId, metaAppSecret, publicUrl, webhookVerifyToken } = req.body;
    db.settings = { ...db.settings, metaAppId, metaAppSecret, publicUrl, webhookVerifyToken };
    saveDb();
    res.json({ status: 'ok' });
});

// --- BILLING ENDPOINTS ---

app.post('/api/billing/checkout', authMiddleware, async (req, res) => {
    const { priceId } = req.body;
    const planKey = Object.keys(CONFIG.PLANS).find(key => CONFIG.PLANS[key].priceId === priceId);
    
    if (!planKey) return res.status(400).json({ error: 'Invalid plan selected' });

    // If Stripe is configured, create a real session. Otherwise, use a mock redirect.
    if (stripe && !CONFIG.STRIPE_KEY.includes('placeholder')) {
        try {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{ price: priceId, quantity: 1 }],
                mode: 'subscription',
                success_url: getRedirectUri(req, `/?billing_success=true&plan=${planKey}`),
                cancel_url: getRedirectUri(req, '/'),
                customer_email: req.user.email,
            });
            return res.json({ url: session.url });
        } catch (e) {
            console.error("Stripe Error", e);
            // Fallback to mock if stripe fails during dev
        }
    }

    // Mock Flow for MVP / Development
    const mockUrl = getRedirectUri(req, `/?billing_success=true&mock_plan=${planKey}`);
    res.json({ url: mockUrl });
});

app.post('/api/dev/upgrade-mock', authMiddleware, (req, res) => {
    const { plan } = req.body;
    if (CONFIG.PLANS[plan]) {
        req.user.plan = plan;
        saveDb();
        return res.json({ status: 'ok', plan });
    }
    res.status(400).json({ error: 'Invalid plan' });
});

// --- META WEBHOOK HANDLERS ---

app.get('/api/webhook', (req, res) => {
    const meta = getMetaConfig();
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === meta.verifyToken) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

app.post('/api/webhook', (req, res) => {
    const body = req.body;
    if (body.object === 'page' || body.object === 'instagram') {
        body.entry?.forEach(entry => {
            const webhook_event = entry.messaging?.[0];
            if (webhook_event && webhook_event.message) {
                db.incoming_events.push({
                    id: webhook_event.message.mid || crypto.randomUUID(),
                    text: webhook_event.message.text,
                    timestamp: entry.time || Date.now(),
                    accountId: entry.id,
                    senderId: webhook_event.sender.id,
                    platform: body.object
                });
                if (db.incoming_events.length > 100) db.incoming_events.shift();
                saveDb();
            }
        });
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'demo@autochat.com' && password === 'demo123') {
        let user = findUser(email);
        if (!user) {
            user = { id: crypto.randomUUID(), email, plan: 'free', createdAt: Date.now() };
            db.users.push(user);
            saveDb();
        }
        const token = jwt.sign({ id: user.id }, CONFIG.JWT_SECRET);
        return res.json({ user, token });
    }
    const user = findUser(email);
    if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Auth failed' });
    const token = jwt.sign({ id: user.id }, CONFIG.JWT_SECRET);
    res.json({ user, token });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
    const usage = getUsage(req.user.id);
    const plan = CONFIG.PLANS[req.user.plan] || CONFIG.PLANS.free;
    res.json({ user: req.user, usage: { ...usage, limit: plan.limit, aiEnabled: plan.ai, maxAccounts: plan.accounts } });
});

// --- META OAUTH ---

app.get('/auth/facebook/login', (req, res) => {
    const meta = getMetaConfig();
    const flow = req.query.flow || 'instagram';
    const callbackPath = flow === 'facebook' ? '/connect-fb' : '/connect-ig';
    const redirectUri = getRedirectUri(req, callbackPath);
    const scopes = 'pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_messages,public_profile';
    const url = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${meta.appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${flow}`;
    res.redirect(url);
});

app.get('/auth/facebook/callback', async (req, res) => {
    const { code, state } = req.query;
    const meta = getMetaConfig();
    try {
        const callbackPath = state === 'facebook' ? '/connect-fb' : '/connect-ig';
        const redirectUri = getRedirectUri(req, callbackPath);
        const tokenRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
            params: { client_id: meta.appId, client_secret: meta.appSecret, redirect_uri: redirectUri, code }
        });
        const userAccessToken = tokenRes.data.access_token;
        const pagesRes = await axios.get('https://graph.facebook.com/v21.0/me/accounts', {
            params: { access_token: userAccessToken, fields: 'id,name,access_token,picture,instagram_business_account' }
        });
        res.json({ pages: pagesRes.data.data });
    } catch (e) {
        console.error("Meta Callback Error", e.response?.data || e.message);
        res.status(500).json({ error: e.response?.data?.error?.message || e.message });
    }
});

// --- AUTOMATION ENGINE API ---

app.post('/api/register-account', authMiddleware, (req, res) => {
    const { externalId, platform, name, accessToken } = req.body;
    const idx = db.accounts.findIndex(a => a.externalId === externalId);
    const acc = { externalId, platform, name, accessToken, userId: req.user.id, status: 'active', lastChecked: Date.now() };
    if (idx >= 0) db.accounts[idx] = { ...db.accounts[idx], ...acc };
    else db.accounts.push(acc);
    saveDb();
    res.sendStatus(200);
});

async function getSenderProfile(senderId, accessToken, platform) {
    try {
        const url = `https://graph.facebook.com/v21.0/${senderId}`;
        const params = { access_token: accessToken, fields: 'name,first_name,last_name,profile_pic' };
        const res = await axios.get(url, { params });
        return {
            id: String(senderId),
            username: res.data.name || res.data.first_name || 'User',
            picture: res.data.profile_pic || null
        };
    } catch (e) {
        return { id: String(senderId), username: 'User', picture: null };
    }
}

app.post('/api/instagram/check-messages', authMiddleware, async (req, res) => {
    const userAccounts = db.accounts.filter(a => a.userId === req.user.id && a.platform === 'instagram');
    const allMessages = [];
    let dbUpdated = false;

    // Webhook simulation check
    const webhookEvents = db.incoming_events.filter(e => e.platform === 'instagram');
    for (const event of webhookEvents) {
        const acc = userAccounts.find(a => a.externalId === event.accountId);
        if (acc) {
            allMessages.push({
                id: event.id,
                text: event.text,
                timestamp: event.timestamp,
                accountId: event.accountId,
                sender: { id: event.senderId, username: 'Webhook User' }
            });
        }
    }
    db.incoming_events = db.incoming_events.filter(e => e.platform !== 'instagram');
    dbUpdated = true;

    // Polling logic refined based on Meta developer docs
    for (const acc of userAccounts) {
        try {
            const convRes = await axios.get(`https://graph.facebook.com/v21.0/me/conversations`, {
                params: { 
                    access_token: acc.accessToken, 
                    fields: 'participants,messages.limit(1){message,from,created_time},unread_count', 
                    platform: 'instagram' 
                }
            });

            if (acc.status !== 'active') {
                acc.status = 'active';
                acc.lastError = undefined;
                dbUpdated = true;
            }
            acc.lastChecked = Date.now();

            const conversations = convRes.data.data || [];
            for (const conv of conversations) {
                const otherParticipant = conv.participants?.data?.find(p => p.id !== acc.externalId);
                const lastMsg = conv.messages?.data?.[0];
                
                if (lastMsg && otherParticipant && lastMsg.from.id !== acc.externalId) {
                    const profile = await getSenderProfile(otherParticipant.id, acc.accessToken, 'instagram');
                    allMessages.push({
                        id: lastMsg.id,
                        text: lastMsg.message,
                        timestamp: lastMsg.created_time,
                        accountId: acc.externalId,
                        sender: profile
                    });
                }
            }
        } catch (e) {
            const errData = e.response?.data?.error;
            acc.status = 'error';
            acc.lastChecked = Date.now();
            
            if (errData?.error_subcode === 2207085 || errData?.code === 10) {
                acc.lastError = `Access Denied (2207085). Please enable 'Allow Access to Messages' in Instagram App settings.`;
            } else if (errData?.code === 190) {
                acc.lastError = `Access Token Expired. Please re-connect the account.`;
            } else {
                acc.lastError = errData?.message || e.message;
            }
            dbUpdated = true;
        }
    }
    
    if (dbUpdated) saveDb();
    res.json({ messages: allMessages });
});

app.post('/api/flow/execute-check', authMiddleware, (req, res) => {
    const { usesAI } = req.body;
    const usage = getUsage(req.user.id);
    const plan = CONFIG.PLANS[req.user.plan] || CONFIG.PLANS.free;
    
    if (usage.count >= plan.limit) return res.status(403).json({ error: 'Limit reached' });
    if (usesAI && !plan.ai) return res.status(403).json({ error: 'Upgrade for AI' });
    
    usage.count++;
    saveDb();
    res.sendStatus(200);
});

const handleSend = async (req, res, platform) => {
    const { to, text, accountId } = req.body;
    const account = db.accounts.find(a => a.externalId === accountId);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    
    try {
        let url = '';
        let body = {};
        const recipientId = String(to);
        const messageText = String(text);

        if (platform === 'facebook' || platform === 'instagram') {
            url = `https://graph.facebook.com/v21.0/me/messages?access_token=${account.accessToken}`;
            body = { 
                recipient: { id: recipientId }, 
                message: { text: messageText },
                messaging_type: "RESPONSE" 
            };
        } else if (platform === 'whatsapp') {
            url = `https://graph.facebook.com/v21.0/${account.externalId}/messages?access_token=${account.accessToken}`;
            body = { messaging_product: "whatsapp", to: recipientId, text: { body: messageText } };
        }
        
        const graphRes = await axios.post(url, body);
        res.json({ success: true, message_id: graphRes.data.message_id || graphRes.data.id });
    } catch (e) {
        const metaErrorObj = e.response?.data?.error;
        const subcode = metaErrorObj?.error_subcode;
        if (subcode === 2207085) {
            account.status = 'error';
            account.lastError = `Access Denied. Trace: ${metaErrorObj?.fbtrace_id || 'N/A'}`;
            saveDb();
        }
        res.status(500).json({ error: metaErrorObj?.message || e.message });
    }
};

app.post('/api/facebook/send', authMiddleware, (req, res) => handleSend(req, res, 'facebook'));
app.post('/api/instagram/send', authMiddleware, (req, res) => handleSend(req, res, 'instagram'));
app.post('/api/whatsapp/send', authMiddleware, (req, res) => handleSend(req, res, 'whatsapp'));

app.post('/api/ai/generate-flow', authMiddleware, async (req, res) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'AI_KEY_MISSING' });
    try {
        const ai = new GoogleGenAI({ apiKey });
        const systemInstruction = `You are a chatbot expert. Return a JSON array of FlowNodes. 
        Each node MUST match this structure: { "id": "string", "type": "message|delay|question|condition|ai_generate", "position": {"x":0, "y":0}, "data": {"content": "...", "variable": "...", "delayMs": 1000}, "nextId": "optional_id" }. 
        Connect nodes logically. Ensure valid JSON only.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Generate a chatbot flow for: ${req.body.prompt}`,
            config: { 
                systemInstruction,
                responseMimeType: 'application/json' 
            }
        });
        res.json({ nodes: JSON.parse(response.text || '[]') });
    } catch (e) { 
        console.error("AI Generation Error:", e);
        res.status(500).json({ error: 'AI failed to generate valid nodes.' }); 
    }
});

const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api') && !req.path.startsWith('/auth')) {
            res.sendFile(path.join(distPath, 'index.html'));
        }
    });
}

app.listen(CONFIG.PORT, () => {
    console.log(`🚀 Server ready on port ${CONFIG.PORT}`);
});
