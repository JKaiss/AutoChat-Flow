
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });

const CONFIG = {
    PORT: process.env.PORT || 3000,
    JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_key_123',
    STRIPE_KEY: process.env.STRIPE_SECRET_KEY,
    PLANS: {
        free: { limit: 100, ai: false, accounts: 1 },
        pro: { limit: 5000, ai: true, accounts: 5 },
        business: { limit: 25000, ai: true, accounts: 999 }
    },
    PRICE_MAP: {
        [process.env.STRIPE_PRICE_PRO || 'price_pro']: 'pro',
        [process.env.STRIPE_PRICE_BIZ || 'price_biz']: 'business'
    }
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
// 2. SOCIAL MOCK AUTH (Simulates Facebook Login)
// ==========================================

const MOCK_PAGES = [
    { id: 'page_101', name: 'AutoChat Test Page', access_token: 'mock_token_123', instagram_id: 'ig_201', picture: { data: { url: 'https://ui-avatars.com/api/?name=Test+Page&background=random' } } },
    { id: 'page_102', name: 'Demo Fashion Store', access_token: 'mock_token_456', instagram_id: 'ig_202', picture: { data: { url: 'https://ui-avatars.com/api/?name=Demo+Store&background=random' } } },
    { id: 'page_103', name: 'Just Facebook Page', access_token: 'mock_token_789', instagram_id: null, picture: { data: { url: 'https://ui-avatars.com/api/?name=FB+Only&background=random' } } }
];

app.get('/auth/facebook/login', (req, res) => {
    const flow = req.query.flow; 
    const mockCode = 'mock_auth_code_' + Date.now();
    const baseUrl = 'http://localhost:5173';
    
    if (flow === 'instagram') {
        res.redirect(`${baseUrl}/connect-ig?code=${mockCode}&state=instagram_mock`);
    } else {
        res.redirect(`${baseUrl}/connect-fb?code=${mockCode}&state=fb_connect`);
    }
});

app.get('/auth/facebook/callback', (req, res) => {
    setTimeout(() => {
        res.json({ pages: MOCK_PAGES });
    }, 500);
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

// ==========================================
// 4. BILLING (MOCK + REAL)
// ==========================================

app.post('/api/billing/checkout', authMiddleware, async (req, res) => {
    const { priceId } = req.body;

    // --- MOCK MODE: If using placeholder key, simulate success immediately ---
    if (!isStripeLive) {
        console.log("[Billing] Mock Mode: Simulating checkout success");
        // We simulate the success redirect URL
        // In a real scenario, Stripe calls a webhook to update the DB. 
        // Here, we'll manually update the user plan for testing immediately if they hit the success link
        // We pass the plan name so the frontend can call the dev upgrade endpoint
        const targetPlan = priceId.includes('biz') ? 'business' : 'pro';
        return res.json({ url: `http://localhost:5173/?billing_success=true&mock_plan=${targetPlan}` });
    }

    // --- REAL MODE ---
    try {
        let customerId = req.user.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({ email: req.user.email });
            req.user.stripeCustomerId = customer.id;
            customerId = customer.id;
            saveDb();
        }
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: 'http://localhost:5173/?billing_success=true',
            cancel_url: 'http://localhost:5173/?billing_cancel=true',
        });
        res.json({ url: session.url });
    } catch (e) {
        console.error("Stripe Error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/billing/portal', authMiddleware, async (req, res) => {
    if (!isStripeLive) {
         // In mock mode, portal just alerts
         return res.status(400).json({ error: 'Billing Portal not available in Test Mode' });
    }
    try {
        if (!req.user.stripeCustomerId) throw new Error("No billing history");
        const session = await stripe.billingPortal.sessions.create({
            customer: req.user.stripeCustomerId,
            return_url: 'http://localhost:5173/',
        });
        res.json({ url: session.url });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

async function handleStripeWebhook(req, res) {
    if (!stripe) return res.sendStatus(200);
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Simple Webhook Logic for Real Stripe
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const user = db.users.find(u => u.stripeCustomerId === session.customer);
        if (user) {
            // Very naive plan assignment for MVP
            user.plan = 'pro'; 
            saveDb();
        }
    }
    res.json({received: true});
}

// ==========================================
// 5. ACCOUNT SYNC & CONNECT ENDPOINTS
// ==========================================

app.post('/api/register-account', authMiddleware, (req, res) => {
    // In a real app, we would validate usage limits here
    res.sendStatus(200);
});

// Mock endpoints for simulators
app.post('/api/whatsapp/connect', (req, res) => res.json({status: 'connected'}));
app.post('/api/facebook/connect', (req, res) => res.json({status: 'connected'}));
app.post('/api/instagram/connect', (req, res) => res.json({status: 'connected'}));
app.post('/api/whatsapp/send', (req, res) => res.json({status: 'sent'}));
app.post('/api/messenger/send', (req, res) => res.json({status: 'sent'}));
app.post('/api/instagram/send', (req, res) => res.json({status: 'sent'}));

// Handle Mock Plan Upgrade via URL (for localhost testing)
app.post('/api/dev/upgrade-mock', authMiddleware, (req, res) => {
    const { plan } = req.body;
    if (req.user) {
        console.log(`[Billing] Mock Upgrading user ${req.user.email} to ${plan}`);
        req.user.plan = plan;
        saveDb();
        res.json({ success: true, plan });
    } else {
        res.status(401).json({ error: 'Not logged in' });
    }
});

app.listen(CONFIG.PORT, () => {
    console.log(`\n🚀 Backend running on http://localhost:${CONFIG.PORT}`);
    console.log(`-> Stripe Mode: ${isStripeLive ? 'LIVE (Real API)' : 'MOCK (Test Mode)'}`);
});
