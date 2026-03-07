CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  product_id    TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  price         NUMERIC(10,2),
  weight_g      INTEGER,
  price_range   SMALLINT,       -- 0=budget(<50), 1=mid(50-200), 2=premium(>200)
  weight_class  SMALLINT,       -- 0=light(<500g), 1=medium(500-2000g), 2=heavy(>2000g)
  feature_vector vector(17)     -- CB feature: 15 category one-hot + priceNorm + weightNorm
);

CREATE TABLE IF NOT EXISTS user_archetypes (
  id              SERIAL PRIMARY KEY,
  archetype_name  TEXT NOT NULL,
  top_category    TEXT,
  user_embedding  vector(32)    -- CF embedding stored after TF.js training
);

CREATE TABLE IF NOT EXISTS interactions (
  id          SERIAL PRIMARY KEY,
  user_idx    INTEGER NOT NULL,
  product_idx INTEGER NOT NULL,
  rating      NUMERIC(3,2) NOT NULL,  -- normalized 0..1 (review_score / 5)
  UNIQUE(user_idx, product_idx)
);

-- HNSW index for fast approximate nearest-neighbor cosine similarity on product features
CREATE INDEX IF NOT EXISTS products_feature_vector_idx
  ON products USING hnsw (feature_vector vector_cosine_ops);
