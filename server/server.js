
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
app.use(cors());
app.post('/webhook/stripe', bodyParser.raw({ type: 'application/json' }), (req, res) => res.json({received: true}));
app.use(bodyParser.json());

const DB_FILE = path.resolve(__dirname, 'db.json');
const defaultDb = { users: [], subscriptions: [], usage: [], accounts: [], settings: {} };
let db = { ...defaultDb };

function loadDb() {
    if (fs.existsSync(DB_FILE)) {
        try {
            const rawData = fs.readFileSync(DB_FILE, 'utf8');
            db = rawData.trim() ? { ...defaultDb, ...JSON.parse(rawData) } : { ...defaultDb };
        } catch (e) {
            db = { ...defaultDb };
        }
    }
}
loadDb();

function saveDb() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Config helper that checks process.env OR the database settings
const getMetaConfig = () => ({
    appId: process.env.FACEBOOK_APP_ID || db.settings?.metaAppId,
    appSecret: process.env.FACEBOOK_APP_SECRET || db.settings?.metaAppSecret
});

const getGeminiKey = () => process.env.API_KEY || db.settings?.geminiKey;

const CONFIG = {
    PORT: process.env.PORT || 3000,
    JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_key_123',
    STRIPE_KEY: process.env.STRIPE_SECRET_KEY,
    PLANS: {
        free: { limit: 100, ai: false, accounts: 1 },
        pro: { limit: 5000, ai: true, accounts: 5 },
        business: { limit: 25000, ai: true, accounts: 999 }
    }
};

const findUser = (email) => db.users.find(u => u.email === email);
const getUserById = (id) => db.users.find(u => u.id === id);
const createUser = (email, password) => {
    const newUser = {
        id: crypto.randomUUID(),
        email,
        password: bcrypt.hashSync(password, 8),
        plan: 'free',
        createdAt: Date.now()
    };
    db.users.push(newUser);
    saveDb();
    return newUser;
};

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

// --- ROUTES ---

app.get('/api/config/status', (req, res) => {
    const meta = getMetaConfig();
    res.json({
        metaConfigured: !!(meta.appId && meta.appSecret),
        aiConfigured: !!getGeminiKey(),
        stripeConfigured: !!(CONFIG.STRIPE_KEY && !CONFIG.STRIPE_KEY.includes('placeholder')),
        metaAppId: meta.appId
    });
});

app.post('/api/config/settings', (req, res) => {
    const { metaAppId, metaAppSecret } = req.body;
    db.settings = { ...db.settings, metaAppId, metaAppSecret };
    saveDb();
    res.json({ status: 'ok' });
});

app.post('/api/auth/register', (req, res) => {
    const { email, password } = req.body;
    if (findUser(email)) return res.status(400).json({ error: 'User exists' });
    const user = createUser(email, password);
    const token = jwt.sign({ id: user.id }, CONFIG.JWT_SECRET);
    res.json({ user, token });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'demo@autochat.com' && password === 'demo123') {
        const user = findUser(email) || createUser(email, password);
        const token = jwt.sign({ id: user.id }, CONFIG.JWT_SECRET);
        return res.json({ user, token });
    }
    const user = findUser(email);
    if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Auth failed' });
    const token = jwt.sign({ id: user.id }, CONFIG.JWT_SECRET);
    res.json({ user, token });
});

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

app.get('/api/auth/me', authMiddleware, (req, res) => {
    const usage = getUsage(req.user.id);
    const plan = CONFIG.PLANS[req.user.plan] || CONFIG.PLANS.free;
    res.json({ user: req.user, usage: { ...usage, limit: plan.limit, aiEnabled: plan.ai, maxAccounts: plan.accounts } });
});

app.get('/auth/facebook/login', (req, res) => {
    const meta = getMetaConfig();
    if (!meta.appId || !meta.appSecret) {
        return res.redirect('/?config_error=missing_meta_keys');
    }
    const redirectUri = `${req.protocol}://${req.get('host')}/auth/facebook/callback`;
    const scopes = 'pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_messages';
    res.redirect(`https://www.facebook.com/v21.0/dialog/oauth?client_id=${meta.appId}&redirect_uri=${redirectUri}&scope=${scopes}`);
});

app.post('/api/register-account', authMiddleware, (req, res) => {
    const { externalId, platform, name, accessToken } = req.body;
    const idx = db.accounts.findIndex(a => a.externalId === externalId);
    const acc = { externalId, platform, name, accessToken, userId: req.user.id };
    if (idx >= 0) db.accounts[idx] = acc;
    else db.accounts.push(acc);
    saveDb();
    res.sendStatus(200);
});

app.post('/api/ai/generate-flow', authMiddleware, async (req, res) => {
    const apiKey = getGeminiKey();
    if (!apiKey) return res.status(500).json({ error: 'AI_KEY_MISSING' });
    try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: req.body.prompt,
            config: { responseMimeType: 'application/json' }
        });
        res.json({ nodes: JSON.parse(response.text) });
    } catch (e) { res.status(500).json({ error: 'AI failed' }); }
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
