
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
} else {
    console.log("[Server] No .env file found at:", rootEnvPath);
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
    // Real Meta Auth Config
    FB_APP_ID: process.env.FACEBOOK_APP_ID,
    FB_APP_SECRET: process.env.FACEBOOK_APP_SECRET
};

const app = express();

// Determine Stripe Mode
const isStripeLive = CONFIG.STRIPE_KEY && !CONFIG.STRIPE_KEY.includes('placeholder') && !CONFIG.STRIPE_KEY.includes('mock');
const stripe = isStripeLive ? new Stripe(CONFIG.STRIPE_KEY) : null;

app.use(cors());

// Stripe Webhook needs raw body
app.post('/webhook/stripe', bodyParser.raw({ type: 'application/json' }), handleStripeWebhook);

// All other routes use JSON
app.use(bodyParser.json());

// ==========================================
// 0. DATABASE SIMULATION (JSON File)
// ==========================================
const DB_FILE = path.resolve(__dirname, 'db.json');
// Default DB structure
const defaultDb = { users: [], subscriptions: [], usage: [], accounts: [] };
let db = { ...defaultDb };

function loadDb() {
    if (fs.existsSync(DB_FILE)) {
        try {
            const rawData = fs.readFileSync(DB_FILE, 'utf8');
            if (!rawData.trim()) {
                console.log("[DB] db.json is empty, initializing defaults.");
                saveDb();
            } else {
                const loaded = JSON.parse(rawData);
                db = { ...defaultDb, ...loaded };
            }
        } catch (e) {
            console.error("[DB] Failed to parse db.json, backing up and resetting.", e);
            try { fs.renameSync(DB_FILE, DB_FILE + '.bak'); } catch(err) {}
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

// --- DB Helpers ---
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
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
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

// ==========================================
// 1. AUTHENTICATION
// ==========================================

app.post('/api/auth/register', (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`[Auth] Register attempt for: ${email}`);
        
        if (!email || !password) {
             return res.status(400).json({ error: 'Email and password required' });
        }

        if (findUser(email)) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        
        const user = createUser(email, password);
        const token = jwt.sign({ id: user.id }, CONFIG.JWT_SECRET);
        console.log(`[Auth] User created: ${user.id}`);
        res.json({ user: { id: user.id, email: user.email, plan: user.plan }, token });
    } catch (e) {
        console.error("[Auth] Register Error:", e);
        res.status(500).json({ error: 'Internal Server Error: ' + e.message });
    }
});

app.post('/api/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;
        
        // --- FAILSAFE FOR DEMO USER ---
        // Ensures the "Instant Demo Login" always works, fixing the "User exists but password wrong" loop
        if (email === 'demo@autochat.com' && password === 'demo123') {
            let user = findUser(email);
            if (!user) {
                user = createUser(email, password);
            } else {
                // Ensure password matches if DB was stale
                if (!bcrypt.compareSync(password, user.password)) {
                     user.password = bcrypt.hashSync(password, 8);
                     saveDb();
                }
            }
            const token = jwt.sign({ id: user.id }, CONFIG.JWT_SECRET);
            return res.json({ user: { id: user.id, email: user.email, plan: user.plan }, token });
        }
        // ------------------------------

        const user = findUser(email);
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user.id }, CONFIG.JWT_SECRET);
        res.json({ user: { id: user.id, email: user.email, plan: user.plan }, token });
    } catch (e) {
        console.error("[Auth] Login Error:", e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
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
    const currentAccounts = db.accounts.length; 

    res.json({
        user: { id: req.user.id, email: req.user.email, plan: req.user.plan },
        usage: {
            transactions: usage.count,
            limit: planConfig.limit,
            aiEnabled: planConfig.ai,
            maxAccounts: planConfig.accounts,
            currentAccounts
        }
    });
});

// ==========================================
// 2. SOCIAL AUTH (REAL ONLY)
// ==========================================

app.get('/auth/facebook/login', (req, res) => {
    const flow = req.query.flow || 'instagram';
    
    console.log('[Auth] Initiating Real Meta Login. Flow:', flow);

    // STRICT CHECK: Fail if no keys are present.
    if (!CONFIG.FB_APP_ID || !CONFIG.FB_APP_SECRET) {
        console.error('[Auth] Error: Missing FACEBOOK_APP_ID or FACEBOOK_APP_SECRET in .env');
        return res.status(500).send(`
            <html>
                <body style="font-family: sans-serif; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
                    <div style="background: #1e293b; padding: 2rem; border-radius: 1rem; border: 1px solid #334155; max-width: 600px;">
                        <h1 style="color: #ef4444; margin-top: 0;">Configuration Error</h1>
                        <p style="color: #94a3b8;">The server cannot connect to Meta because the App ID and Secret are missing.</p>
                        
                        <div style="background: #0f172a; padding: 1rem; border-radius: 0.5rem; margin: 1.5rem 0; font-family: monospace; border: 1px solid #334155;">
                            FACEBOOK_APP_ID=your_id_here<br/>
                            FACEBOOK_APP_SECRET=your_secret_here
                        </div>
                        
                        <p style="color: #94a3b8;">Please create a <strong>.env</strong> file in your project root with these values and restart the server.</p>
                        
                        <a href="/" style="display: inline-block; background: #2563eb; color: white; padding: 0.75rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: bold; margin-top: 1rem;">Go Back to App</a>
                    </div>
                </body>
            </html>
        `);
    }
    
    // Redirect URI must point back to client (or server middleware)
    const redirectUri = flow === 'instagram' 
        ? '/connect-ig' 
        : '/connect-fb';
        
    // Use the host from the request to build absolute URL for redirect
    const host = req.get('host');
    const protocol = req.protocol;
    const fullRedirectUri = `${protocol}://${host}${redirectUri}`;

    const scopes = [
        'pages_show_list',
        'pages_read_engagement', 
        'pages_manage_metadata',
        'instagram_basic',
        'instagram_manage_messages',
        'business_management'
    ].join(',');

    const url = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${CONFIG.FB_APP_ID}&redirect_uri=${fullRedirectUri}&state=${flow}&scope=${scopes}`;
    res.redirect(url);
});

app.get('/auth/facebook/callback', async (req, res) => {
    const { code, state } = req.query;

    if (!CONFIG.FB_APP_ID || !CONFIG.FB_APP_SECRET) {
        return res.status(500).json({ error: 'Server configuration missing (FACEBOOK_APP_ID)' });
    }

    if (!code) {
        return res.status(400).json({ error: 'No authorization code provided' });
    }

    try {
        const redirectPath = (state === 'instagram_mock' || state === 'instagram') 
            ? '/connect-ig' 
            : '/connect-fb';
        
        const host = req.get('host');
        const protocol = req.protocol;
        const redirectUri = `${protocol}://${host}${redirectPath}`;

        console.log('[Auth] Exchanging code with Meta...');

        // 1. Exchange Code for User Access Token
        const tokenRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
            params: {
                client_id: CONFIG.FB_APP_ID,
                client_secret: CONFIG.FB_APP_SECRET,
                redirect_uri: redirectUri,
                code: code
            }
        });
        const userAccessToken = tokenRes.data.access_token;

        // 2. Debug: Check User & Permissions
        const debugRes = await axios.get('https://graph.facebook.com/v21.0/me', {
            params: { 
                access_token: userAccessToken, 
                fields: 'id,name,permissions' 
            }
        });
        const metaUser = debugRes.data;
        console.log(`[Auth] Meta User: ${metaUser.name} (${metaUser.id})`);
        
        // 3. Get Pages
        const pagesRes = await axios.get('https://graph.facebook.com/v21.0/me/accounts', {
            params: {
                access_token: userAccessToken,
                fields: 'id,name,access_token,picture,instagram_business_account'
            }
        });

        const pages = pagesRes.data.data.map(p => ({
            id: p.id,
            name: p.name,
            access_token: p.access_token,
            instagram_id: p.instagram_business_account ? p.instagram_business_account.id : null,
            picture: p.picture
        }));

        console.log(`[Auth] Retrieved ${pages.length} pages.`);
        
        if (pages.length === 0) {
            console.log("[Auth] 0 Pages found. Returning debug info to client.");
            return res.json({ 
                pages: [], 
                debug: { 
                    user: metaUser.name, 
                    id: metaUser.id,
                    permissions: metaUser.permissions?.data 
                } 
            });
        }

        return res.json({ pages });

    } catch (e) {
        console.error("Facebook Auth Error:", e.response?.data || e.message);
        
        if (e.response?.data?.error?.code === 100 && e.response?.data?.error?.error_subcode === 36009) {
             return res.status(409).json({ error: 'Authorization code already used. Please retry.' });
        }

        return res.status(500).json({ 
            error: 'Failed to exchange token with Meta', 
            details: e.response?.data?.error?.message || e.message
        });
    }
});


// ==========================================
// 3. USAGE & EXECUTION
// ==========================================

app.post('/api/flow/execute-check', authMiddleware, (req, res) => {
    const { usesAI } = req.body;
    const planConfig = CONFIG.PLANS[req.user.plan] || CONFIG.PLANS.free;
    const usage = getUsage(req.user.id);

    if (usesAI && !planConfig.ai) {
        return res.status(403).json({ error: 'AI_DISABLED', upgrade: true });
    }
    if (usage.count >= planConfig.limit) {
        return res.status(403).json({ error: 'LIMIT_REACHED', upgrade: true });
    }
    incrementUsage(req.user.id);
    res.json({ status: 'ok', remaining: planConfig.limit - usage.count });
});

app.post('/api/ai/generate-flow', authMiddleware, async (req, res) => {
    try {
        const { prompt } = req.body;
        const apiKey = process.env.API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'Server misconfiguration: API_KEY missing' });

        const planConfig = CONFIG.PLANS[req.user.plan] || CONFIG.PLANS.free;
        if (!planConfig.ai) return res.status(403).json({ error: 'AI features require Pro or Business plan' });

        const usage = getUsage(req.user.id);
        if (usage.count >= planConfig.limit) return res.status(403).json({ error: 'Monthly usage limit reached' });

        const ai = new GoogleGenAI({ apiKey });
        const systemPrompt = `
            You are an expert chatbot automation architect.
            Create a JSON array of nodes based on the user's description.
            RULES: Return ONLY valid JSON.
            Structure: { "id", "type", "data": {}, "nextId" }
            Layout: Start x:100, y:100. Vertical spacing 150px.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `User Request: ${prompt}`,
            config: { systemInstruction: systemPrompt, responseMimeType: 'application/json' }
        });

        incrementUsage(req.user.id);
        const jsonText = response.text || '[]';
        const cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        res.json({ nodes: JSON.parse(cleanJson) });
    } catch (e) {
        console.error("[AI] Generation Failed:", e);
        res.status(500).json({ error: 'AI Generation failed' });
    }
});

// ==========================================
// 4. BILLING
// ==========================================

app.post('/api/billing/checkout', authMiddleware, async (req, res) => {
    const { priceId } = req.body;
    
    // For local or production mock mode
    if (!isStripeLive) {
        const targetPlan = priceId.includes('biz') ? 'business' : 'pro';
        // Use relative URL for redirect to keep domain context
        return res.json({ url: `/?billing_success=true&mock_plan=${targetPlan}` });
    }
    try {
        let customerId = req.user.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({ email: req.user.email });
            req.user.stripeCustomerId = customer.id;
            customerId = customer.id;
            saveDb();
        }
        
        const host = req.get('host');
        const protocol = req.protocol;
        const domain = `${protocol}://${host}`;

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${domain}/?billing_success=true`,
            cancel_url: `${domain}/?billing_cancel=true`,
        });
        res.json({ url: session.url });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// 5. ACCOUNTS & MESSAGING
// ==========================================

const upsertAccount = (account) => {
    const existingIndex = db.accounts.findIndex(a => a.externalId === account.externalId);
    if (existingIndex >= 0) {
        db.accounts[existingIndex] = { ...db.accounts[existingIndex], ...account };
    } else {
        db.accounts.push(account);
    }
    saveDb();
};

app.post('/api/register-account', authMiddleware, (req, res) => {
    const { externalId, accessToken, platform, name } = req.body;
    if (externalId) upsertAccount({ externalId, accessToken, platform, name, userId: req.user.id });
    res.sendStatus(200);
});

app.post('/api/instagram/verify', async (req, res) => {
    let { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ valid: false });
    accessToken = accessToken.replace(/\s/g, '');
    try {
        // Updated to use graph.facebook.com for Page Access Tokens
        const mePage = await axios.get(`https://graph.facebook.com/v21.0/me`, { params: { access_token: accessToken, fields: 'id,name,instagram_business_account' } });
        
        if (mePage.data.instagram_business_account) {
            res.json({ 
                valid: true, 
                data: { 
                    id: mePage.data.id, 
                    name: mePage.data.name, 
                    instagram_business_account: mePage.data.instagram_business_account 
                } 
            });
        } else {
             res.json({ valid: true, data: { id: mePage.data.id, name: mePage.data.name } });
        }
    } catch (e) {
        res.status(400).json({ valid: false, error: e.message });
    }
});

// Route for "Scan IDs" feature
app.post('/api/instagram/conversations', async (req, res) => {
    // Make pageId let so we can update it
    let { accessToken, igId, pageId } = req.body;

    // Check for Mock Mode
    if (!accessToken || accessToken.startsWith('mock_')) {
        return res.json({
            participants: [
                { id: 'mock_123456', username: 'demo_user_one' },
                { id: 'mock_987654', username: 'demo_user_two' }
            ]
        });
    }

    const extractParticipants = (data, myId) => {
        const parts = [];
        if (data && data.data) {
             data.data.forEach(thread => {
                if (thread.participants && thread.participants.data) {
                    thread.participants.data.forEach(p => {
                        if (p.id !== myId) parts.push({ id: p.id, username: p.username });
                    });
                }
            });
        }
        return parts;
    };

    try {
        // Attempt 1: Standard IG API
        const response = await axios.get(`https://graph.facebook.com/v21.0/${igId}/conversations`, {
            params: {
                access_token: accessToken,
                fields: 'participants,updated_time'
            }
        });
        
        res.json({ participants: extractParticipants(response.data, igId) });
    } catch (e) {
        // Reduced LOG NOISE: Simple warning instead of stack trace
        console.warn(`[IG Scan] Primary method failed for ${igId}. Code: ${e.response?.data?.error?.code || 'Unknown'}`);

        // Attempt 2: Fallback to Page API
        if (!pageId) {
             try {
                 const me = await axios.get(`https://graph.facebook.com/v21.0/me?access_token=${accessToken}`);
                 pageId = me.data.id;
             } catch(err) { /* silent */ }
        }

        if (pageId) {
            try {
                const fallbackResponse = await axios.get(`https://graph.facebook.com/v21.0/${pageId}/conversations`, {
                    params: {
                        access_token: accessToken,
                        platform: 'instagram',
                        fields: 'participants,updated_time'
                    }
                });
                return res.json({ participants: extractParticipants(fallbackResponse.data, igId) });
            } catch (e2) {
                // Reduced LOG NOISE: Just the message
                console.warn(`[IG Scan] Fallback method failed. Message: ${e2.response?.data?.error?.message}`);
                
                // CRITICAL FIX: Return 200 OK with empty list + Warning field
                // This prevents the frontend from freaking out with 400/500 errors.
                return res.json({ 
                    participants: [], 
                    warning: "Meta API restricted scan access. This is common in Dev mode or without 'instagram_manage_messages' permission." 
                });
            }
        }

        return res.json({ 
            participants: [], 
            warning: "Meta API Error: " + (e.response?.data?.error?.message || e.message)
        });
    }
});

app.post('/api/instagram/check-messages', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const accounts = db.accounts.filter(a => a.userId === userId && a.platform === 'instagram');
    let allMessages = [];

    for (const acc of accounts) {
        // Skip mocks
        if (acc.accessToken && acc.accessToken.startsWith('mock_')) continue;

        try {
            // Updated to graph.facebook.com
            // FIX: Remove 'platform: instagram' as it is not supported on this edge for IG Business Account
            const url = `https://graph.facebook.com/v21.0/${acc.externalId}/conversations`;
            const resp = await axios.get(url, {
                params: { 
                    access_token: acc.accessToken, 
                    fields: 'messages.limit(5){id,message,created_time,from},participants', 
                    limit: 5 
                }
            });
            const threads = resp.data.data || [];
            for (const thread of threads) {
                 if (thread.messages && thread.messages.data) {
                     for (const msg of thread.messages.data) {
                         if (msg.from && msg.from.id !== acc.externalId) {
                             allMessages.push({
                                 id: msg.id, text: msg.message, sender: { id: msg.from.id, username: msg.from.username }, accountId: acc.externalId, timestamp: msg.created_time
                             });
                         }
                     }
                 }
            }
        } catch (e) { /* ignore */ }
    }
    allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    res.json({ messages: allMessages });
});

// Updated to save pageId
app.post('/api/instagram/connect', authMiddleware, (req, res) => {
    const { igId, accessToken, name, pageId } = req.body;
    upsertAccount({ externalId: igId, accessToken, platform: 'instagram', name, userId: req.user.id, pageId });
    res.json({status: 'connected'});
});

app.post('/api/facebook/connect', authMiddleware, (req, res) => {
    const { pageId, accessToken, name } = req.body;
    upsertAccount({ externalId: pageId, accessToken, platform: 'facebook', name, userId: req.user.id });
    res.json({status: 'connected'});
});

app.post('/api/instagram/send', async (req, res) => {
    const { to, text, accountId } = req.body;
    const account = db.accounts.find(a => a.externalId === accountId);
    
    if (account && account.accessToken && !account.accessToken.startsWith('mock_')) {
        try {
            // Updated to graph.facebook.com
            await axios.post(`https://graph.facebook.com/v21.0/${accountId}/messages`, {
                recipient: { id: to }, message: { text: text }
            }, { params: { access_token: account.accessToken } });
            return res.json({ status: 'sent', provider: 'graph_api' });
        } catch (e) {
            console.error("[IG API Error]", e.response?.data || e.message);
            const metaError = e.response?.data?.error;
            return res.status(500).json({ 
                error: metaError ? metaError.message : e.message,
                code: metaError ? metaError.code : 'UNKNOWN',
                details: metaError 
            });
        }
    }
    return res.json({ status: 'sent', mock: true });
});

app.post('/api/dev/upgrade-mock', authMiddleware, (req, res) => {
    const { plan } = req.body;
    if (req.user) {
        req.user.plan = plan;
        saveDb();
        res.json({ success: true, plan });
    } else {
        res.status(401).json({ error: 'Not logged in' });
    }
});

// --- HELPER FUNCTION FOR STRIPE ---
async function handleStripeWebhook(req, res) {
    if (!stripe) return res.sendStatus(200);
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const user = db.users.find(u => u.stripeCustomerId === session.customer);
        if (user) {
            user.plan = 'pro';
            saveDb();
        }
    }
    res.json({received: true});
}

// ==========================================
// SERVE STATIC ASSETS (PRODUCTION)
// ==========================================
// This section allows the Node server to serve the React app, fixing 404s
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
    console.log(`[Server] Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    
    // Catch-all handler for SPA (React Router)
    app.get('*', (req, res) => {
        // Do not return index.html for API calls that 404
        if (req.path.startsWith('/api')) {
             return res.status(404).json({ error: 'API Endpoint Not Found' });
        }
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    console.log("[Server] Warning: 'dist' folder not found. Ensure 'npm run build' is run before start.");
}

app.listen(CONFIG.PORT, () => {
    console.log(`\n🚀 Backend running on port ${CONFIG.PORT}`);
    console.log(`-> Stripe Mode: ${isStripeLive ? 'LIVE' : 'MOCK'}`);
    console.log(`-> Facebook Auth: ${CONFIG.FB_APP_ID ? 'LIVE' : 'DISABLED (Missing Credentials)'}`);
});
