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
    console.log("[Server] Loaded .env configuration");
}

const CONFIG = {
    PORT: process.env.PORT || 3000,
    JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_key_123',
    STRIPE_KEY: process.env.STRIPE_SECRET_KEY,
    PLANS: {
        free: { limit: 100, ai: false, accounts: 1 },
        pro: { limit: 5000, ai: true, accounts: 5 },
        business: { limit: 25000, ai: true, accounts: 999 }
    },
    FB_APP_ID: process.env.FACEBOOK_APP_ID,
    FB_APP_SECRET: process.env.FACEBOOK_APP_SECRET
};

const app = express();
const isStripeLive = CONFIG.STRIPE_KEY && !CONFIG.STRIPE_KEY.includes('placeholder') && !CONFIG.STRIPE_KEY.includes('mock');
const stripe = isStripeLive ? new Stripe(CONFIG.STRIPE_KEY) : null;

app.use(cors());
app.post('/webhook/stripe', bodyParser.raw({ type: 'application/json' }), handleStripeWebhook);
app.use(bodyParser.json());

const DB_FILE = path.resolve(__dirname, 'db.json');
const defaultDb = { users: [], subscriptions: [], usage: [], accounts: [] };
let db = { ...defaultDb };

function loadDb() {
    if (fs.existsSync(DB_FILE)) {
        try {
            const rawData = fs.readFileSync(DB_FILE, 'utf8');
            db = rawData.trim() ? { ...defaultDb, ...JSON.parse(rawData) } : { ...defaultDb };
        } catch (e) {
            db = { ...defaultDb };
            saveDb();
        }
    } else {
        saveDb();
    }
}

function saveDb() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error("[DB] Failed to save DB:", e);
    }
}
loadDb();

const findUser = (email) => db.users.find(u => u.email === email);
const getUserById = (id) => db.users.find(u => u.id === id);
const createUser = (email, password) => {
    const newUser = {
        id: crypto.randomUUID(),
        email,
        password: bcrypt.hashSync(password, 8),
        plan: 'free',
        stripeCustomerId: null,
        createdAt: Date.now()
    };
    db.users.push(newUser);
    saveDb();
    return newUser;
};

const getUsage = (userId) => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    let record = db.usage.find(u => u.userId === userId && u.month === currentMonth);
    if (!record) {
        record = { id: crypto.randomUUID(), userId, month: currentMonth, count: 0 };
        db.usage.push(record);
        saveDb();
    }
    return record;
};

const incrementUsage = (userId) => {
    const record = getUsage(userId);
    record.count++;
    saveDb();
    return record.count;
};

app.post('/api/auth/register', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (findUser(email)) return res.status(400).json({ error: 'Email already exists' });
    const user = createUser(email, password);
    const token = jwt.sign({ id: user.id }, CONFIG.JWT_SECRET);
    res.json({ user: { id: user.id, email: user.email, plan: user.plan }, token });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'demo@autochat.com' && password === 'demo123') {
        let user = findUser(email) || createUser(email, password);
        const token = jwt.sign({ id: user.id }, CONFIG.JWT_SECRET);
        return res.json({ user: { id: user.id, email: user.email, plan: user.plan }, token });
    }
    const user = findUser(email);
    if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id }, CONFIG.JWT_SECRET);
    res.json({ user: { id: user.id, email: user.email, plan: user.plan }, token });
});

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, CONFIG.JWT_SECRET);
        req.user = getUserById(decoded.id);
        if (!req.user) throw new Error();
        next();
    } catch (e) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

app.get('/api/auth/me', authMiddleware, (req, res) => {
    const usage = getUsage(req.user.id);
    const planConfig = CONFIG.PLANS[req.user.plan] || CONFIG.PLANS.free;
    res.json({
        user: { id: req.user.id, email: req.user.email, plan: req.user.plan },
        usage: {
            transactions: usage.count,
            limit: planConfig.limit,
            aiEnabled: planConfig.ai,
            maxAccounts: planConfig.accounts,
            currentAccounts: db.accounts.filter(a => a.userId === req.user.id).length
        }
    });
});

app.get('/auth/facebook/login', (req, res) => {
    const flow = req.query.flow || 'instagram';
    if (!CONFIG.FB_APP_ID || !CONFIG.FB_APP_SECRET) {
        return res.status(400).json({ error: 'Missing Meta App Credentials. Please check your .env file.' });
    }
    const host = req.get('host');
    const protocol = req.protocol;
    const redirectUri = `${protocol}://${host}/${flow === 'instagram' ? 'connect-ig' : 'connect-fb'}`;
    const scopes = ['pages_show_list', 'pages_read_engagement', 'pages_manage_metadata', 'instagram_basic', 'instagram_manage_messages', 'business_management'].join(',');
    const url = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${CONFIG.FB_APP_ID}&redirect_uri=${redirectUri}&state=${flow}&scope=${scopes}`;
    res.redirect(url);
});

app.get('/auth/facebook/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!CONFIG.FB_APP_ID || !CONFIG.FB_APP_SECRET) return res.status(500).json({ error: 'Server configuration missing' });
    if (!code) return res.status(400).json({ error: 'No authorization code provided' });

    try {
        const host = req.get('host');
        const protocol = req.protocol;
        const redirectUri = `${protocol}://${host}/${state === 'instagram' ? 'connect-ig' : 'connect-fb'}`;

        const tokenRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
            params: { client_id: CONFIG.FB_APP_ID, client_secret: CONFIG.FB_APP_SECRET, redirect_uri: redirectUri, code: code }
        });
        const userAccessToken = tokenRes.data.access_token;
        const pagesRes = await axios.get('https://graph.facebook.com/v21.0/me/accounts', {
            params: { access_token: userAccessToken, fields: 'id,name,access_token,picture,instagram_business_account' }
        });

        const pages = pagesRes.data.data.map(p => ({
            id: p.id, name: p.name, access_token: p.access_token,
            instagram_id: p.instagram_business_account ? p.instagram_business_account.id : null,
            picture: p.picture
        }));

        res.json({ pages });
    } catch (e) {
        res.status(500).json({ error: 'Failed to exchange token with Meta', details: e.response?.data?.error?.message || e.message });
    }
});

app.post('/api/flow/execute-check', authMiddleware, (req, res) => {
    const { usesAI } = req.body;
    const planConfig = CONFIG.PLANS[req.user.plan] || CONFIG.PLANS.free;
    const usage = getUsage(req.user.id);

    if (usesAI && !planConfig.ai) return res.status(403).json({ error: 'AI_DISABLED', upgrade: true });
    if (usage.count >= planConfig.limit) return res.status(403).json({ error: 'LIMIT_REACHED', upgrade: true });
    incrementUsage(req.user.id);
    res.json({ status: 'ok', remaining: planConfig.limit - usage.count });
});

app.post('/api/ai/generate-flow', authMiddleware, async (req, res) => {
    try {
        const { prompt } = req.body;
        const apiKey = process.env.API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'API_KEY missing' });

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `User Request: ${prompt}`,
            config: { 
                systemInstruction: "Expert chatbot architect. Return ONLY valid JSON array of nodes: {id, type, data: {content, label}, nextId}.",
                responseMimeType: 'application/json' 
            }
        });

        incrementUsage(req.user.id);
        res.json({ nodes: JSON.parse(response.text.replace(/```json/g, '').replace(/```/g, '').trim()) });
    } catch (e) {
        res.status(500).json({ error: 'AI Generation failed' });
    }
});

app.post('/api/billing/checkout', authMiddleware, async (req, res) => {
    const { priceId } = req.body;
    if (!isStripeLive) return res.json({ url: `/?billing_success=true&mock_plan=${priceId.includes('biz') ? 'business' : 'pro'}` });
    try {
        const domain = `${req.protocol}://${req.get('host')}`;
        const session = await stripe.checkout.sessions.create({
            customer: req.user.stripeCustomerId || (await stripe.customers.create({ email: req.user.email })).id,
            mode: 'subscription', payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${domain}/?billing_success=true`,
            cancel_url: `${domain}/?billing_cancel=true`,
        });
        res.json({ url: session.url });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/register-account', authMiddleware, (req, res) => {
    const { externalId, accessToken, platform, name } = req.body;
    const idx = db.accounts.findIndex(a => a.externalId === externalId);
    if (idx >= 0) db.accounts[idx] = { ...db.accounts[idx], accessToken, platform, name, userId: req.user.id };
    else db.accounts.push({ externalId, accessToken, platform, name, userId: req.user.id });
    saveDb();
    res.sendStatus(200);
});

app.post('/api/instagram/send', async (req, res) => {
    const { to, text, accountId } = req.body;
    const account = db.accounts.find(a => a.externalId === accountId);
    if (account && account.accessToken && !account.accessToken.startsWith('mock_')) {
        try {
            await axios.post(`https://graph.facebook.com/v21.0/${accountId}/messages`, { recipient: { id: to }, message: { text } }, { params: { access_token: account.accessToken } });
            return res.json({ status: 'sent' });
        } catch (e) {
            return res.status(500).json({ error: e.response?.data?.error?.message || e.message });
        }
    }
    res.json({ status: 'sent', mock: true });
});

const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API Not Found' });
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

async function handleStripeWebhook(req, res) {
    res.json({received: true});
}

app.listen(CONFIG.PORT, () => {
    console.log(`🚀 Server on port ${CONFIG.PORT} | Stripe: ${isStripeLive ? 'LIVE' : 'MOCK'} | Meta: ${CONFIG.FB_APP_ID ? 'READY' : 'KEY MISSING'}`);
});