/**
 * Express API Server for Olist Hybrid Recommendation System
 *
 * Endpoints:
 *   GET  /api/products         — full product catalog
 *   GET  /api/users            — user archetype list
 *   GET  /api/interactions     — training data for CF model
 *   GET  /api/similar          — pgvector ANN cosine similarity search (CB component)
 *   GET  /api/cf-neighbors     — CF recommendations via user embedding similarity
 *   POST /api/embeddings       — store trained user embeddings in pgvector
 *
 * Also serves static frontend files from project root.
 */

import express from 'express';
import pg from 'pg';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

// ─── DB pool ─────────────────────────────────────────────────────────────────

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'olist_recommendations',
  user: process.env.DB_USER || 'olist_user',
  password: process.env.DB_PASSWORD || 'olist_pass',
});

// ─── Top-15 categories for building query vectors from UI filters ─────────────

const TOP_CATEGORIES = [
  'bed_bath_table', 'sports_leisure', 'furniture_decor', 'health_beauty',
  'housewares', 'watches_gifts', 'telephony', 'computers_accessories',
  'auto', 'toys', 'cool_stuff', 'perfumery', 'baby', 'electronics', 'other',
];

function buildQueryVectorFromFilters({ category, priceMax, weightClass }) {
  const vec = new Array(17).fill(0);

  if (category && category !== 'all') {
    const idx = TOP_CATEGORIES.indexOf(category);
    if (idx >= 0) vec[idx] = 1.0;
    else vec[14] = 1.0;  // 'other'
  } else {
    // All categories: set all category bits to a small uniform value
    for (let i = 0; i < 15; i++) vec[i] = 1 / 15;
  }

  // priceMax normalised against assumed max of 1500 R$
  const priceNorm = Math.min(1, (Number(priceMax) || 500) / 1500);
  vec[15] = priceNorm;

  // weightClass: 0=light→0.0, 1=medium→0.5, 2=heavy→1.0
  const weightVal = weightClass === '' || weightClass === undefined || weightClass === null
    ? 1
    : Number(weightClass);
  vec[16] = Number.isFinite(weightVal) ? weightVal / 2 : 0.5;

  return vec;
}

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(express.static(__dirname));  // serve index.html + src/ + data/

// ─── GET /api/products ────────────────────────────────────────────────────────

app.get('/api/products', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, product_id, name, category, price, weight_g, price_range, weight_class FROM products ORDER BY id'
    );
    res.json(rows);
  } catch (err) {
    console.error('/api/products error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/users ───────────────────────────────────────────────────────────

app.get('/api/users', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, archetype_name, top_category, user_embedding IS NOT NULL AS has_embedding FROM user_archetypes ORDER BY id'
    );
    res.json(rows);
  } catch (err) {
    console.error('/api/users error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/interactions ────────────────────────────────────────────────────

app.get('/api/interactions', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT user_idx, product_idx, CAST(rating AS FLOAT) as rating FROM interactions'
    );

    const numUsers = (await pool.query('SELECT COUNT(*) FROM user_archetypes')).rows[0].count;
    const numProducts = (await pool.query('SELECT COUNT(*) FROM products')).rows[0].count;

    res.json({
      numUsers: Number(numUsers),
      numProducts: Number(numProducts),
      userIndices: rows.map(r => r.user_idx),
      productIndices: rows.map(r => r.product_idx),
      ratings: rows.map(r => r.rating),
    });
  } catch (err) {
    console.error('/api/interactions error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/similar ─────────────────────────────────────────────────────────
// CB component: pgvector cosine similarity search
// Query params: category, priceMax, weightClass, limit (default 12), productId (optional)

app.get('/api/similar', async (req, res) => {
  try {
    const { productId, limit = 12, category = 'all', priceMax, weightClass } = req.query;

    let queryVector;

    if (productId) {
      // Use the feature vector of the given product as query
      const { rows } = await pool.query(
        'SELECT feature_vector FROM products WHERE id = $1', [productId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Product not found' });
      queryVector = rows[0].feature_vector;
    } else {
      // Build query vector from filter selections (cold start path)
      queryVector = buildQueryVectorFromFilters({ category, priceMax, weightClass });
    }

    const vectorStr = `[${queryVector.join ? queryVector.join(',') : queryVector}]`;

    const { rows } = await pool.query(
      `SELECT id, product_id, name, category, price, weight_g, price_range, weight_class,
              ROUND(CAST(1 - (feature_vector <=> $1::vector) AS NUMERIC), 4) AS cb_score
       FROM products
       WHERE ($2 = 'all' OR category = $2)
         AND ($3::numeric IS NULL OR price <= $3::numeric)
         AND ($4::smallint IS NULL OR weight_class = $4::smallint)
       ORDER BY feature_vector <=> $1::vector
       LIMIT $5`,
      [
        vectorStr,
        category || 'all',
        priceMax ? Number(priceMax) : null,
        weightClass !== undefined && weightClass !== '' ? Number(weightClass) : null,
        Number(limit),
      ]
    );

    res.json(rows);
  } catch (err) {
    console.error('/api/similar error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/cf-neighbors ────────────────────────────────────────────────────
// CF component: find products liked by users with similar embeddings
// Query params: userId (1-based DB id), limit (default 12)

app.get('/api/cf-neighbors', async (req, res) => {
  try {
    const { userId, limit = 12 } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // Check if this user has an embedding (only available after TF.js training)
    const embCheck = await pool.query(
      'SELECT user_embedding FROM user_archetypes WHERE id = $1', [userId]
    );
    if (!embCheck.rows.length || !embCheck.rows[0].user_embedding) {
      return res.json([]);  // no CF available yet; browser falls back to CB
    }

    // Find top-10 similar users by embedding cosine similarity (excluding self)
    // Then aggregate products they rated highly, that this user hasn't interacted with
    const userIdx = Number(userId) - 1;  // 0-based index
    const { rows } = await pool.query(
      `SELECT p.id, p.product_id, p.name, p.category, p.price, p.weight_g,
              p.price_range, p.weight_class, ROUND(CAST(AVG(i.rating) AS NUMERIC), 4) AS cf_score
       FROM interactions i
       JOIN products p ON p.id = i.product_idx + 1
       WHERE i.user_idx IN (
         SELECT id - 1 FROM user_archetypes
         WHERE id != $1
           AND user_embedding IS NOT NULL
         ORDER BY user_embedding <=> (
           SELECT user_embedding FROM user_archetypes WHERE id = $1
         )
         LIMIT 10
       )
       AND i.user_idx != $2
       AND i.product_idx NOT IN (
         SELECT product_idx FROM interactions WHERE user_idx = $2
       )
       GROUP BY p.id, p.product_id, p.name, p.category, p.price, p.weight_g, p.price_range, p.weight_class
       ORDER BY cf_score DESC
       LIMIT $3`,
      [Number(userId), userIdx, Number(limit)]
    );

    res.json(rows);
  } catch (err) {
    console.error('/api/cf-neighbors error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/embeddings ─────────────────────────────────────────────────────
// Store trained CF user embeddings from TF.js browser training
// Body: { userEmbeddings: [{ userIdx: number, embedding: number[] }] }

app.post('/api/embeddings', async (req, res) => {
  try {
    const { userEmbeddings } = req.body;
    if (!Array.isArray(userEmbeddings)) {
      return res.status(400).json({ error: 'userEmbeddings array required' });
    }

    let updated = 0;
    for (const { userIdx, embedding } of userEmbeddings) {
      if (!Array.isArray(embedding) || embedding.length !== 32) continue;
      const vectorStr = `[${embedding.join(',')}]`;
      const result = await pool.query(
        `UPDATE user_archetypes SET user_embedding = $1::vector WHERE id = $2`,
        [vectorStr, userIdx + 1]
      );
      if (result.rowCount > 0) updated++;
    }

    res.json({ ok: true, updated });
  } catch (err) {
    console.error('/api/embeddings error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`\nOlist Recommendation API running at http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /api/products');
  console.log('  GET  /api/users');
  console.log('  GET  /api/interactions');
  console.log('  GET  /api/similar?category=electronics&priceMax=500');
  console.log('  GET  /api/cf-neighbors?userId=1');
  console.log('  POST /api/embeddings');
});
