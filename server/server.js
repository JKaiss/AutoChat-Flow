
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
import pg from 'pg';

// --- ENV & STARTUP CHECKS (HARDENED) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath });
}

const requiredEnv = ['DATABASE_URL', 'JWT_SECRET'];
let isConfigured = true;
for (const varName of requiredEnv) {
    if (!process.env[varName]) {
        console.error(`❌ FATAL ERROR: Environment variable ${varName} is not set. Server cannot start properly.`);
        isConfigured = false;
    }
}

const CONFIG = {
    PORT: process.env.PORT || 3000,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: '7d',
    STATE_TOKEN_SECRET: process.env.JWT_SECRET + '-state', // Use a derivative for state tokens
    STRIPE_KEY: process.env.STRIPE_SECRET_KEY,
    PLANS: {
        free: { limit: 100, ai: false, accounts: 1, priceId: '' },
        pro: { limit: 5000, ai: true, accounts: 5, priceId: 'price_pro_dummy' },
        business: { limit: 25000, ai: true, accounts: 999, priceId: 'price_biz_dummy' }
    }
};

const app = express();

// --- DATABASE CONNECTION ---
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});

if (isConfigured) {
    pool.query('SELECT NOW()').then(res => console.log('🐘 PostgreSQL connected:', res.rows[0].now)).catch(err => {
        console.error('❌ Database connection error. The application will not function correctly.', err.stack);
    });
} else {
    console.error('❌ Skipping database connection check due to missing environment variables.');
}


// --- MIDDLEWARE ---
app.set('trust proxy', true);
app.use(cors());
app.post('/webhook/stripe', bodyParser.raw({ type: 'application/json' }), (req, res) => res.json({received: true}));
app.use(bodyParser.json());

// --- AUTH MIDDLEWARE (HARDENED) ---
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization token required' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, CONFIG.JWT_SECRET);
        req.auth = {
            userId: decoded.userId,
            organizationId: decoded.organizationId
        };
        next();
    } catch (e) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// --- API HELPERS ---
const getSettings = async (organizationId) => {
    const res = await pool.query('SELECT * FROM organization_settings WHERE organization_id = $1', [organizationId]);
    return res.rows[0] || {};
};

const getRedirectUri = (req, settings, path) => {
    const publicUrl = process.env.PUBLIC_URL || settings.public_url;
    if (publicUrl) return `${publicUrl.replace(/\/$/, '')}${path}`;
    const protocol = req.protocol === 'http' && !req.get('host').includes('localhost') ? 'https' : req.protocol;
    return `${protocol}://${req.get('host')}${path}`;
};


// --- AUTH ROUTES (IMPLEMENTED) ---
app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const orgName = email.split('@')[0] + "'s Organization";
        const orgResult = await client.query('INSERT INTO organizations (name) VALUES ($1) RETURNING id', [orgName]);
        const organizationId = orgResult.rows[0].id;

        const userResult = await client.query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email', [email, passwordHash]);
        const newUser = userResult.rows[0];

        await client.query('INSERT INTO organization_members (user_id, organization_id, role) VALUES ($1, $2, $3)', [newUser.id, organizationId, 'owner']);
        await client.query('INSERT INTO subscriptions (organization_id, plan, usage_limit) VALUES ($1, $2, $3)', [organizationId, 'free', CONFIG.PLANS.free.limit]);

        const token = jwt.sign({ userId: newUser.id, organizationId }, CONFIG.JWT_SECRET, { expiresIn: CONFIG.JWT_EXPIRES_IN });

        await client.query('COMMIT');
        res.status(201).json({ token, user: { ...newUser, plan: 'free' } });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Registration error:', e);
        res.status(500).json({ error: 'Registration failed' });
    } finally {
        client.release();
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    try {
        const userResult = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = userResult.rows[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const memberResult = await pool.query('SELECT organization_id FROM organization_members WHERE user_id = $1', [user.id]);
        if (memberResult.rows.length === 0) {
            return res.status(500).json({ error: 'User is not associated with an organization' });
        }
        const organizationId = memberResult.rows[0].organization_id;
        
        const subResult = await pool.query('SELECT plan FROM subscriptions WHERE organization_id = $1', [organizationId]);
        const plan = subResult.rows[0]?.plan || 'free';

        const token = jwt.sign({ userId: user.id, organizationId }, CONFIG.JWT_SECRET, { expiresIn: CONFIG.JWT_EXPIRES_IN });
        
        res.json({ token, user: { id: user.id, email: user.email, plan } });
    } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
    const { userId, organizationId } = req.auth;
    try {
        const userRes = await pool.query('SELECT id, email FROM users WHERE id = $1', [userId]);
        const subRes = await pool.query('SELECT plan, usage_count, usage_limit FROM subscriptions WHERE organization_id = $1', [organizationId]);
        const accRes = await pool.query('SELECT COUNT(*) as count FROM accounts WHERE organization_id = $1', [organizationId]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        
        const user = userRes.rows[0];
        const subscription = subRes.rows[0] || { plan: 'free', usage_count: 0, usage_limit: CONFIG.PLANS.free.limit };
        const planDetails = CONFIG.PLANS[subscription.plan] || CONFIG.PLANS.free;
        
        res.json({
            user: { ...user, plan: subscription.plan },
            usage: {
                transactions: subscription.usage_count,
                limit: subscription.usage_limit,
                aiEnabled: planDetails.ai,
                maxAccounts: planDetails.accounts,
                currentAccounts: parseInt(accRes.rows[0].count, 10)
            }
        });
    } catch (e) { res.status(500).json({ error: 'Failed to fetch user data' }); }
});

// --- SETTINGS API (NEW - REPLACES /api/config/*) ---
app.get('/api/settings', authMiddleware, async (req, res) => {
    const { organizationId } = req.auth;
    try {
        const settings = await getSettings(organizationId);
        const hasAiKey = !!process.env.API_KEY; // This is a global setting for now
        res.json({
            metaConfigured: !!(settings.meta_app_id && settings.meta_app_secret),
            aiConfigured: hasAiKey,
            stripeConfigured: !!(CONFIG.STRIPE_KEY && !CONFIG.STRIPE_KEY.includes('placeholder')),
            metaAppId: settings.meta_app_id || '',
            publicUrl: settings.public_url || '',
            webhookVerifyToken: settings.webhook_verify_token || 'autochat_verify_token'
        });
    } catch (e) { res.status(500).json({ error: 'Failed to fetch settings' }); }
});

app.put('/api/settings', authMiddleware, async (req, res) => {
    const { organizationId } = req.auth;
    const { metaAppId, metaAppSecret, publicUrl, webhookVerifyToken } = req.body;
    try {
        await pool.query(
            `INSERT INTO organization_settings (organization_id, meta_app_id, meta_app_secret, public_url, webhook_verify_token)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (organization_id) DO UPDATE SET
             meta_app_id = EXCLUDED.meta_app_id, meta_app_secret = EXCLUDED.meta_app_secret,
             public_url = EXCLUDED.public_url, webhook_verify_token = EXCLUDED.webhook_verify_token`,
            [organizationId, metaAppId, metaAppSecret, publicUrl, webhookVerifyToken]
        );
        res.json({ message: 'Settings saved' });
    } catch (e) { res.status(500).json({ error: 'Failed to save settings' }); }
});


// --- ACCOUNTS API (NEW - REPLACES /api/register-account) ---
app.get('/api/accounts', authMiddleware, async (req, res) => {
    const { organizationId } = req.auth;
    const { platform } = req.query;
    try {
        let query = 'SELECT id, platform, external_id as "externalId", name, profile_picture_url as "profilePictureUrl", status, last_error as "lastError", connected_at as "connectedAt" FROM accounts WHERE organization_id = $1';
        const params = [organizationId];
        if (platform) {
            query += ' AND platform = $2';
            params.push(platform);
        }
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: 'Failed to fetch accounts' }); }
});

app.delete('/api/accounts/:id', authMiddleware, async (req, res) => {
    const { organizationId } = req.auth;
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM accounts WHERE id = $1 AND organization_id = $2', [id, organizationId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Account not found or access denied' });
        res.status(204).send();
    } catch (e) { res.status(500).json({ error: 'Failed to delete account' }); }
});

// --- FLOWS API (IMPLEMENTED) ---
app.get('/api/flows', authMiddleware, async (req, res) => {
    const { organizationId } = req.auth;
    try {
        const result = await pool.query(
            'SELECT id, name, trigger_type as "triggerType", active FROM flows WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC',
            [organizationId]
        );
        res.json(result.rows);
    } catch (e) {
        console.error('Failed to fetch flows', e);
        res.status(500).json({ error: 'Failed to fetch flows' });
    }
});

app.get('/api/flows/:id', authMiddleware, async (req, res) => {
    const { organizationId } = req.auth;
    const { id } = req.params;
    try {
        const flowRes = await pool.query(
            'SELECT id, name, trigger_type as "triggerType", trigger_keyword as "triggerKeyword", trigger_account_id as "triggerAccountId", active FROM flows WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
            [id, organizationId]
        );
        if (flowRes.rowCount === 0) return res.status(404).json({ error: 'Flow not found' });

        const nodesRes = await pool.query(
            'SELECT id, node_type as "type", position, data, next_id as "nextId", false_next_id as "falseNextId" FROM flow_nodes WHERE flow_id = $1 ORDER BY created_at ASC', [id]
        );
        
        res.json({
            ...flowRes.rows[0],
            nodes: nodesRes.rows
        });
    } catch (e) {
        console.error('Failed to fetch flow details', e);
        res.status(500).json({ error: 'Failed to fetch flow details' });
    }
});

app.post('/api/flows', authMiddleware, async (req, res) => {
    const { organizationId } = req.auth;
    const { name, triggerType, triggerKeyword, triggerAccountId, nodes = [] } = req.body;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const flowResult = await client.query(
            `INSERT INTO flows (organization_id, name, trigger_type, trigger_keyword, trigger_account_id, active)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [organizationId, name, triggerType, triggerKeyword, triggerAccountId, false]
        );
        const newFlow = flowResult.rows[0];

        const tempToPermIdMap = new Map();
        for (const node of nodes) {
            const nodeRes = await client.query(
                `INSERT INTO flow_nodes (flow_id, node_type, position, data) VALUES ($1, $2, $3, $4) RETURNING id`,
                [newFlow.id, node.type, JSON.stringify(node.position || {x:0, y:0}), JSON.stringify(node.data || {})]
            );
            tempToPermIdMap.set(node.id, nodeRes.rows[0].id);
        }

        for (const node of nodes) {
            const permId = tempToPermIdMap.get(node.id);
            const nextPermId = node.nextId ? tempToPermIdMap.get(node.nextId) : null;
            const falseNextPermId = node.falseNextId ? tempToPermIdMap.get(node.falseNextId) : null;
            if (nextPermId || falseNextPermId) {
                await client.query(
                    `UPDATE flow_nodes SET next_id = $1, false_next_id = $2 WHERE id = $3`,
                    [nextPermId, falseNextPermId, permId]
                );
            }
        }
        
        await client.query('COMMIT');
        res.status(201).json({ ...newFlow, nodes });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Failed to create flow', e);
        res.status(500).json({ error: 'Failed to create flow' });
    } finally {
        client.release();
    }
});

app.put('/api/flows/:id', authMiddleware, async (req, res) => {
    const { organizationId } = req.auth;
    const { id } = req.params;
    const { name, triggerType, triggerKeyword, triggerAccountId, nodes = [], active } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const flowCheck = await client.query('SELECT id FROM flows WHERE id = $1 AND organization_id = $2', [id, organizationId]);
        if (flowCheck.rowCount === 0) {
            throw new Error('Flow not found or access denied');
        }

        await client.query(
            `UPDATE flows SET name = $1, trigger_type = $2, trigger_keyword = $3, trigger_account_id = $4, active = $5, updated_at = NOW()
             WHERE id = $6`,
            [name, triggerType, triggerKeyword, triggerAccountId, active, id]
        );

        await client.query('DELETE FROM flow_nodes WHERE flow_id = $1', [id]);
        
        const tempToPermIdMap = new Map();
        for (const node of nodes) {
            const nodeRes = await client.query(
                `INSERT INTO flow_nodes (flow_id, node_type, position, data) VALUES ($1, $2, $3, $4) RETURNING id`,
                [id, node.type, JSON.stringify(node.position || {x:0, y:0}), JSON.stringify(node.data || {})]
            );
            tempToPermIdMap.set(node.id, nodeRes.rows[0].id);
        }

        for (const node of nodes) {
            const permId = tempToPermIdMap.get(node.id);
            const nextPermId = node.nextId ? tempToPermIdMap.get(node.nextId) : null;
            const falseNextPermId = node.falseNextId ? tempToPermIdMap.get(node.falseNextId) : null;
            if (nextPermId || falseNextPermId) {
                await client.query(
                    `UPDATE flow_nodes SET next_id = $1, false_next_id = $2 WHERE id = $3`,
                    [nextPermId, falseNextPermId, permId]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Flow updated' });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Failed to update flow', e);
        if (e.message.includes('not found')) return res.status(404).json({ error: e.message });
        res.status(500).json({ error: 'Failed to update flow' });
    } finally {
        client.release();
    }
});

app.delete('/api/flows/:id', authMiddleware, async (req, res) => {
    const { organizationId } = req.auth;
    const { id } = req.params;
    try {
        const result = await pool.query(
            'UPDATE flows SET deleted_at = NOW() WHERE id = $1 AND organization_id = $2',
            [id, organizationId]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Flow not found or access denied' });
        res.status(204).send();
    } catch (e) {
        console.error('Failed to delete flow', e);
        res.status(500).json({ error: 'Failed to delete flow' });
    }
});

// --- META OAUTH (REVISED WITH SECURE STATE) ---
app.get('/auth/facebook/login', authMiddleware, async (req, res) => {
    const { organizationId } = req.auth;
    const { flow = 'instagram' } = req.query;
    try {
        const settings = await getSettings(organizationId);
        if (!settings.meta_app_id) return res.status(400).send('Meta App ID is not configured for this organization.');
        
        const callbackPath = flow === 'facebook' ? '/connect-fb' : '/connect-ig';
        const redirectUri = getRedirectUri(req, settings, callbackPath);
        
        // Create a short-lived JWT to securely pass the organizationId
        const stateToken = jwt.sign({ organizationId, flow }, CONFIG.STATE_TOKEN_SECRET, { expiresIn: '10m' });
        
        const scopes = 'pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_messages,public_profile';
        const url = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${settings.meta_app_id}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${stateToken}`;
        res.redirect(url);
    } catch (e) { res.status(500).send('Server error during auth initiation.'); }
});

app.get('/auth/facebook/callback', async (req, res) => {
    const { code, state } = req.query;
    try {
        const { organizationId, flow } = jwt.verify(state, CONFIG.STATE_TOKEN_SECRET);
        const settings = await getSettings(organizationId);
        
        const callbackPath = flow === 'facebook' ? '/connect-fb' : '/connect-ig';
        const redirectUri = getRedirectUri(req, settings, callbackPath);

        const tokenRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
            params: { client_id: settings.meta_app_id, client_secret: settings.meta_app_secret, redirect_uri: redirectUri, code }
        });
        const userAccessToken = tokenRes.data.access_token;
        
        const pagesRes = await axios.get('https://graph.facebook.com/v21.0/me/accounts', {
            params: { access_token: userAccessToken, fields: 'id,name,access_token,picture,instagram_business_account' }
        });

        // Save accounts to the database, linked to the correct organization
        for (const page of pagesRes.data.data) {
            if (flow === 'instagram' && page.instagram_business_account) {
                await pool.query(
                    `INSERT INTO accounts (organization_id, platform, external_id, name, access_token, profile_picture_url)
                     VALUES ($1, 'instagram', $2, $3, $4, $5)
                     ON CONFLICT (organization_id, platform, external_id) DO UPDATE SET
                     name = EXCLUDED.name, access_token = EXCLUDED.access_token, profile_picture_url = EXCLUDED.profile_picture_url`,
                    [organizationId, page.instagram_business_account.id, `${page.name} (IG)`, page.access_token, page.picture?.data?.url]
                );
            } else if (flow === 'facebook') {
                 await pool.query(
                    `INSERT INTO accounts (organization_id, platform, external_id, name, access_token, profile_picture_url)
                     VALUES ($1, 'facebook', $2, $3, $4, $5)
                     ON CONFLICT (organization_id, platform, external_id) DO UPDATE SET
                     name = EXCLUDED.name, access_token = EXCLUDED.access_token, profile_picture_url = EXCLUDED.profile_picture_url`,
                    [organizationId, page.id, page.name, page.access_token, page.picture?.data?.url]
                );
            }
        }
        res.send(`<script>window.close();</script>`);
    } catch (e) {
        console.error("Meta Callback Error", e.response?.data || e.message);
        res.status(500).send('OAuth callback failed. Please try again.');
    }
});


// --- WEBHOOKS & SENDING (Now DB-driven) ---
app.get('/api/webhook', (req, res) => { /* ... unchanged ... */ });
app.post('/api/webhook', (req, res) => { /* ... unchanged for now ... */ res.status(200).send('EVENT_RECEIVED'); });

const handleSend = async (req, res, platform) => {
    const { organizationId } = req.auth;
    const { to, text, accountId } = req.body;
    try {
        const accRes = await pool.query('SELECT access_token FROM accounts WHERE external_id = $1 AND organization_id = $2', [accountId, organizationId]);
        if (accRes.rows.length === 0) return res.status(404).json({ error: 'Sending account not found or access denied.'});
        const accessToken = accRes.rows[0].access_token;
        // ... Actual sending logic would use accessToken ...
        console.log(`[SEND] To: ${to}, From Account: ${accountId}, Via: ${platform}, Token: ${accessToken.slice(0,10)}...`);
        res.json({ status: 'ok' });
    } catch(e) { res.status(500).json({error: 'Failed to send message'}); }
};

app.post('/api/facebook/send', authMiddleware, (req, res) => handleSend(req, res, 'facebook'));
app.post('/api/instagram/send', authMiddleware, (req, res) => handleSend(req, res, 'instagram'));
app.post('/api/whatsapp/send', authMiddleware, (req, res) => handleSend(req, res, 'whatsapp'));


// ... Other routes (billing, AI, etc.) remain as stubs for now ...
app.post('/api/billing/checkout', authMiddleware, async (req, res) => { /* ... */ });
app.post('/api/dev/upgrade-mock', authMiddleware, (req, res) => { /* ... */ });
app.post('/api/instagram/check-messages', authMiddleware, async (req, res) => res.json({ messages: [] }));
app.post('/api/flow/execute-check', authMiddleware, (req, res) => res.sendStatus(200));

app.post('/api/ai/generate-flow', authMiddleware, async (req, res) => {
    const { prompt } = req.body;
    if (!process.env.API_KEY) {
        return res.status(500).json({ error: 'AI is not configured on the server.' });
    }
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required.' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const systemInstruction = `You are an expert chatbot flow designer. Your task is to convert a user's natural language prompt into a valid JSON structure representing a chatbot flow.
        The JSON output must conform to this structure: { "name": "Flow Name", "triggerType": "valid_trigger_type", "triggerKeyword": "optional_keyword", "nodes": [ { "id": "node_unique_id", "type": "valid_node_type", "data": { ... }, "nextId": "next_node_id" } ] }.
        - Node IDs must be unique strings like "node_1", "node_2".
        - 'nextId' must point to a valid subsequent node ID. The last node should have no 'nextId'.
        - For 'condition' nodes, you must provide both 'nextId' (for true) and 'falseNextId' (for false).
        - Valid trigger types: keyword, instagram_comment, instagram_dm, instagram_story_mention, whatsapp_message, messenger_text. Choose the most appropriate one.
        - Valid node types: message, delay, question, condition, ai_generate.
        - For 'question' nodes, define a 'variable' name in 'data' to store the answer.
        - For 'condition' nodes, define 'conditionVar' and 'conditionValue' in 'data'.
        - Keep content concise and conversational.
        - The flow must be logical and complete based on the prompt.
        - Always return ONLY the raw JSON object, with no markdown formatting or explanations.`;

        const fullPrompt = `Generate a chatbot flow for the following prompt: "${prompt}"`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: fullPrompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
            }
        });

        const generatedJsonText = response.text;
        if (!generatedJsonText) {
            throw new Error("AI returned an empty response.");
        }
        
        const cleanJson = generatedJsonText.replace(/```json/g, '').replace(/```/g, '').trim();
        const flow = JSON.parse(cleanJson);

        if (!flow.name || !flow.triggerType || !Array.isArray(flow.nodes)) {
            throw new Error("Generated JSON has an invalid structure.");
        }

        res.json({ flow });

    } catch (e) {
        console.error("[AI Flow Gen Error]", e);
        res.status(500).json({ error: 'Failed to generate flow with AI.' });
    }
});


// --- STATIC SERVING ---
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
