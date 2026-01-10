-- Run these commands in your Vercel Project "Storage" -> "Data" -> "Query" tab.

-- 1. Create Subscribers Table
CREATE TABLE IF NOT EXISTS subscribers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Feedback Table
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Update Feedback Table (V1.1)
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS email VARCHAR(255);
