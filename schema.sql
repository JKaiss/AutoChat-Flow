
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations are the tenants
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users can belong to organizations
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON users (email);

-- Junction table for user roles within an organization
CREATE TYPE organization_role AS ENUM ('owner', 'admin', 'member');
CREATE TABLE organization_members (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role organization_role NOT NULL DEFAULT 'member',
    PRIMARY KEY (user_id, organization_id)
);
CREATE INDEX ON organization_members (organization_id);

-- Subscriptions for each tenant
CREATE TYPE plan_tier AS ENUM ('free', 'pro', 'business');
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan plan_tier NOT NULL DEFAULT 'free',
    stripe_customer_id VARCHAR(255) UNIQUE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    usage_count INTEGER NOT NULL DEFAULT 0,
    usage_limit INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON subscriptions (organization_id);

-- Connected social media accounts, scoped to an organization
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    profile_picture_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    last_error TEXT,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, platform, external_id)
);
CREATE INDEX ON accounts (organization_id);
CREATE INDEX ON accounts (platform);

-- Settings for each organization, replacing db.json settings
CREATE TABLE organization_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    meta_app_id VARCHAR(255),
    meta_app_secret TEXT,
    public_url VARCHAR(255),
    webhook_verify_token VARCHAR(255)
);
CREATE INDEX ON organization_settings (organization_id);

-- Chatbot flows, scoped to an organization
CREATE TABLE flows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    trigger_type VARCHAR(100) NOT NULL,
    trigger_keyword VARCHAR(255),
    trigger_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL, -- link to account
    active BOOLEAN NOT NULL DEFAULT FALSE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX ON flows (organization_id);

-- Nodes for each flow
CREATE TABLE flow_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    node_type VARCHAR(50) NOT NULL,
    position JSONB NOT NULL,
    data JSONB NOT NULL,
    next_id UUID REFERENCES flow_nodes(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
    false_next_id UUID REFERENCES flow_nodes(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON flow_nodes (flow_id);
