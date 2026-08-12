CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


CREATE TYPE train_status AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');

CREATE TABLE trains (
    train_id VARCHAR(20) PRIMARY KEY,                             
    train_number VARCHAR(50) NOT NULL UNIQUE,                    
    capacity INT NOT NULL CHECK (capacity > 0),                   
    coaches_count INT NOT NULL DEFAULT 6 CHECK (coaches_count > 0),
    status train_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trains_status ON trains(status);