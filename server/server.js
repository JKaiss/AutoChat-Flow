
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
// Essential for Docker/Nginx/CloudRun environments to detect https correctly
app.set('trust proxy', true);

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

// Helper to construct redirect URI safely
const getRedirectUri = (req, path) => {
    // Priority 1: User-configured Public URL from Settings
    if (db.settings?.publicUrl) {
        const base = db.settings.publicUrl.replace(/\/$/, ''); // Remove trailing slash
        return `${base}${path}`;
    }
    
    // Priority 2: Standard detection using trust-proxy and headers
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    
    // Priority 3: Default to https if not on localhost
    const finalProto = (protocol === 'http' && !host.includes('localhost')) ? 'https' : protocol;
    
    return `${finalProto}://${host}${path}`;
};

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
        metaAppId: meta.appId,
        publicUrl: db.settings?.publicUrl
    });
});

app.post('/api/config/settings', (req, res) => {
    const { metaAppId, metaAppSecret, publicUrl } = req.body;
    db.settings = { ...db.settings, metaAppId, metaAppSecret, publicUrl };
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
    const flow = req.query.flow || 'instagram';
    if (!meta.appId || !meta.appSecret) {
        return res.redirect('/?config_error=missing_meta_keys');
    }
    
    // Build redirect URI using helper
    const callbackPath = flow === 'facebook' ? '/connect-fb' : '/connect-ig';
    const redirectUri = getRedirectUri(req, callbackPath);
    
    const scopes = 'pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_messages';
    const url = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${meta.appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${flow}`;
    res.redirect(url);
});

// Generic callback for Meta OAuth
app.get('/auth/facebook/callback', async (req, res) => {
    const { code, state } = req.query;
    const meta = getMetaConfig();
    if (!meta.appId || !meta.appSecret) return res.status(500).json({ error: 'Config missing' });
    
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
        res.status(500).json({ error: e.response?.data?.error?.message || e.message });
    }
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
