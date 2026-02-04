-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create initial schema (Prisma will handle migrations, but this ensures UUID support)
SELECT 'Database initialized with UUID support' AS status;
