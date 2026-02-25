-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  password_hash TEXT NOT NULL,
  phone_number TEXT,
  notify_via_email BOOLEAN DEFAULT FALSE,
  notify_via_sms BOOLEAN DEFAULT FALSE,
  role TEXT CHECK (role IN ('cast', 'copro', 'leader', 'admin')) DEFAULT 'cast',
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  suggested_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, name)
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  suggested_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User proficiencies junction table
CREATE TABLE IF NOT EXISTS user_proficiencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, location_id, role_id)
);

-- Shifts table (offers)
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  shift_title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_trade BOOLEAN DEFAULT FALSE,
  is_giveaway BOOLEAN DEFAULT FALSE,
  is_overtime_approved BOOLEAN DEFAULT FALSE,
  comments TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ GENERATED ALWAYS AS (start_time - INTERVAL '30 minutes') STORED
);

-- Requests table
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  preferred_times TEXT[] NOT NULL CHECK (preferred_times <@ ARRAY['morning', 'afternoon', 'evening', 'late']),
  requested_date DATE NOT NULL,
  comments TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ GENERATED ALWAYS AS ((requested_date + INTERVAL '1 day' - INTERVAL '1 second')::TIMESTAMPTZ) STORED
);

-- Flags table
CREATE TABLE IF NOT EXISTS flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flagged_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_type TEXT CHECK (target_type IN ('post', 'user')) NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'resolved', 'dismissed')) DEFAULT 'pending',
  resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Black listed emails table
CREATE TABLE IF NOT EXISTS black_listed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  failed_attempts INTEGER DEFAULT 0 CHECK (failed_attempts >= 0),
  blocked BOOLEAN DEFAULT FALSE,
  ip_address INET,
  origin_country TEXT,
  origin_city TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes per PRD Section 6
CREATE INDEX IF NOT EXISTS idx_shifts_active_time ON shifts(is_active, start_time, created_at);
CREATE INDEX IF NOT EXISTS idx_requests_active_date ON requests(is_active, requested_date);
CREATE INDEX IF NOT EXISTS idx_flags_status_time ON flags(status, created_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, is_active);
CREATE INDEX IF NOT EXISTS idx_user_proficiencies_user ON user_proficiencies(user_id, location_id, role_id);
CREATE INDEX IF NOT EXISTS idx_black_listed_email ON black_listed(email);

-- Auto-update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to black_listed
CREATE TRIGGER update_black_listed_updated_at
  BEFORE UPDATE ON black_listed
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-expire shifts function
CREATE OR REPLACE FUNCTION expire_shifts()
RETURNS void AS $$
  UPDATE shifts
  SET is_active = FALSE
  WHERE is_active = TRUE
  AND expires_at <= NOW();
$$ LANGUAGE sql;

-- Auto-expire requests function
CREATE OR REPLACE FUNCTION expire_requests()
RETURNS void AS $$
  UPDATE requests
  SET is_active = FALSE
  WHERE is_active = TRUE
  AND expires_at <= NOW();
$$ LANGUAGE sql;

-- Seed Properties
INSERT INTO properties (name) VALUES
  ('Magic Kingdom'),
  ('EPCOT'),
  ('Animal Kingdom'),
  ('Resorts'),
  ('Disney Springs'),
  ('Hollywood Studios')
ON CONFLICT (name) DO NOTHING;
