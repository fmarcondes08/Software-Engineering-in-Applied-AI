/**
 * Olist E-Commerce Preprocessing Script
 *
 * Reads raw Olist CSV files from ./raw-data/, joins them, and:
 * 1. Populates PostgreSQL (products, user_archetypes, interactions tables)
 * 2. Exports data/products.json and data/users.json for the browser
 * 3. Exports data/interactions.json for the CF model training
 *
 * Usage: node scripts/preprocess.js
 * Requires: raw-data/ folder with Olist CSV files (from Kaggle)
 */

import { createReadStream } from 'fs';
import { writeFileSync, mkdirSync } from 'fs';
import { parse } from 'csv-parse';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const RAW_DATA = path.join(ROOT, 'raw-data');
const DATA_OUT = path.join(ROOT, 'data');

// 15-slot category basis used in feature vectors.
// Keep this list aligned with server.js TOP_CATEGORIES.
// Any non-listed category maps to 'other' (index 14).
const TOP_CATEGORIES = [
  'bed_bath_table',
  'sports_leisure',
  'furniture_decor',
  'health_beauty',
  'housewares',
  'watches_gifts',
  'telephony',
  'computers_accessories',
  'auto',
  'toys',
  'cool_stuff',
  'perfumery',
  'baby',
  'electronics',
  'other',
];

const CATEGORY_IDX = Object.fromEntries(TOP_CATEGORIES.map((c, i) => [c, i]));

// Archetype names for display in the UI
const ARCHETYPE_DISPLAY_NAMES = [
  'Electronics Enthusiast',
  'Fashion & Accessories Buyer',
  'Home & Appliances Shopper',
  'Sports & Leisure Fan',
  'Tech & Computers Buyer',
  'Furniture & Decor Lover',
  'Baby Products Parent',
  'Toys & Kids Buyer',
  'Beauty & Health Seeker',
  'Auto Parts Buyer',
  'Food & Drink Shopper',
  'Books & Music Fan',
  'Budget Shopper',
  'Mid-Range Shopper',
  'Premium Shopper',
];

// ─── DB connection ──────────────────────────────────────────────────────────

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'olist_recommendations',
  user: process.env.DB_USER || 'olist_user',
  password: process.env.DB_PASSWORD || 'olist_pass',
});

// ─── CSV parsing helper ──────────────────────────────────────────────────────

function parseCSV(filename) {
  return new Promise((resolve, reject) => {
    const rows = [];
    createReadStream(path.join(RAW_DATA, filename))
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true, bom: true }))
      .on('data', row => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

// ─── Feature vector helpers ──────────────────────────────────────────────────

function normalise(value, min, max) {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function buildFeatureVector(categoryEn, priceNorm, weightNorm) {
  const vec = new Array(17).fill(0);
  const catKey = categoryEn?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'other';
  const idx = CATEGORY_IDX[catKey] ?? CATEGORY_IDX['other'];
  vec[idx] = 1;
  vec[15] = priceNorm;
  vec[16] = weightNorm;
  return vec;
}

function categorise(categoryEn) {
  const key = categoryEn?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'other';
  return TOP_CATEGORIES.includes(key) ? key : 'other';
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Loading CSV files...');

  const [orders, orderItems, products, reviews, customers, categoryTranslations] =
    await Promise.all([
      parseCSV('olist_orders_dataset.csv'),
      parseCSV('olist_order_items_dataset.csv'),
      parseCSV('olist_products_dataset.csv'),
      parseCSV('olist_order_reviews_dataset.csv'),
      parseCSV('olist_customers_dataset.csv'),
      parseCSV('olist_product_category_name_translation.csv'),
    ]);

  console.log(
    `Loaded: ${orders.length} orders, ${orderItems.length} items, ` +
    `${products.length} products, ${reviews.length} reviews`
  );

  // ─── Build lookup maps ─────────────────────────────────────────────────────

  // order_id → customer_id
  const orderToCustomer = new Map(orders.map(o => [o.order_id, o.customer_id]));

  // customer_id → customer_unique_id
  const customerToUnique = new Map(customers.map(c => [c.customer_id, c.customer_unique_id]));

  // product_id → product row
  const productMap = new Map(products.map(p => [p.product_id, p]));

  // Portuguese category name → English
  const catTranslation = new Map(
    categoryTranslations.map(r => [
      r.product_category_name,
      r.product_category_name_english,
    ])
  );

  // order_id → review_score (take first review if multiple)
  const orderToReview = new Map();
  for (const r of reviews) {
    if (!orderToReview.has(r.order_id) && r.review_score) {
      orderToReview.set(r.order_id, Number(r.review_score));
    }
  }

  // ─── Build flat interaction records ───────────────────────────────────────

  console.log('Joining records...');
  const interactionRecords = [];

  for (const item of orderItems) {
    const customerId = orderToCustomer.get(item.order_id);
    if (!customerId) continue;

    const customerUid = customerToUnique.get(customerId);
    if (!customerUid) continue;

    const product = productMap.get(item.product_id);
    if (!product) continue;

    const reviewScore = orderToReview.get(item.order_id);
    if (!reviewScore) continue;  // skip unreviewed orders

    const catPt = product.product_category_name;
    const catEn = catTranslation.get(catPt) || 'other';

    interactionRecords.push({
      customerUid,
      productId: item.product_id,
      reviewScore,
      categoryEn: catEn,
      price: Number(item.price) || 0,
      weightG: Number(product.product_weight_g) || 0,
    });
  }

  console.log(`Built ${interactionRecords.length} interaction records`);

  // ─── Select top 500 products by interaction count ─────────────────────────

  const productInteractionCount = new Map();
  for (const r of interactionRecords) {
    productInteractionCount.set(r.productId, (productInteractionCount.get(r.productId) || 0) + 1);
  }

  const top500ProductIds = [...productInteractionCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 500)
    .map(([id]) => id);

  const productIdToIdx = new Map(top500ProductIds.map((id, i) => [id, i]));

  // Filter interactions to only top-500 products
  const filteredInteractions = interactionRecords.filter(r =>
    productIdToIdx.has(r.productId)
  );

  console.log(`Filtered to ${filteredInteractions.length} interactions for top-500 products`);

  // ─── Compute price/weight normalisation bounds ────────────────────────────

  const prices = top500ProductIds.map(id => {
    const recs = filteredInteractions.filter(r => r.productId === id);
    return recs.length ? recs[0].price : 0;
  });
  const weights = top500ProductIds.map(id => {
    const p = productMap.get(id);
    return Number(p?.product_weight_g) || 0;
  });

  const priceMin = Math.min(...prices);
  const priceMax = Math.max(...prices);
  const weightMin = Math.min(...weights);
  const weightMax = Math.max(...weights);

  // ─── Build product objects ────────────────────────────────────────────────

  const productObjects = top500ProductIds.map((productId, idx) => {
    const raw = productMap.get(productId);
    const catPt = raw?.product_category_name || '';
    const catEn = catTranslation.get(catPt) || 'other';
    const category = categorise(catEn);

    const price = filteredInteractions.find(r => r.productId === productId)?.price || 0;
    const weightG = Number(raw?.product_weight_g) || 0;

    const priceNorm = normalise(price, priceMin, priceMax);
    const weightNorm = normalise(weightG, weightMin, weightMax);

    const priceRange = price < 50 ? 0 : price < 200 ? 1 : 2;
    const weightClass = weightG < 500 ? 0 : weightG < 2000 ? 1 : 2;

    const featureVector = buildFeatureVector(category, priceNorm, weightNorm);
    const shortId = productId.slice(0, 8).toUpperCase();
    const name = `${category.replace(/_/g, ' ')} #${shortId}`;

    return {
      idx,
      product_id: productId,
      name,
      category,
      price: Math.round(price * 100) / 100,
      weight_g: weightG,
      price_range: priceRange,
      weight_class: weightClass,
      feature_vector: featureVector,
    };
  });

  // ─── Group customers into 200 archetypes ─────────────────────────────────
  //
  // Simple percentile bucketing: first split by dominant purchase category
  // (15 categories), then split each group into budget/mid/premium tiers.
  // This avoids k-means but produces meaningfully different archetypes.

  console.log('Building customer archetypes...');

  // customer_uid → their filtered interactions
  const customerInteractions = new Map();
  for (const r of filteredInteractions) {
    if (!customerInteractions.has(r.customerUid)) {
      customerInteractions.set(r.customerUid, []);
    }
    customerInteractions.get(r.customerUid).push(r);
  }

  // For each customer: find dominant category and average price
  const customerProfiles = [...customerInteractions.entries()].map(([uid, recs]) => {
    const categoryCounts = {};
    let totalPrice = 0;
    for (const r of recs) {
      const cat = categorise(r.categoryEn);
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      totalPrice += r.price;
    }
    const dominantCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0][0];
    const avgPrice = totalPrice / recs.length;
    return { uid, dominantCategory, avgPrice, recs };
  });

  // Group by dominant category
  const categoryGroups = {};
  for (const profile of customerProfiles) {
    const cat = profile.dominantCategory;
    if (!categoryGroups[cat]) categoryGroups[cat] = [];
    categoryGroups[cat].push(profile);
  }

  // For each category group, split into up to 3 price tiers (budget/mid/premium)
  // to produce up to 15*3=45 archetypes. Then take up to 200.
  const archetypes = [];
  let archetypeIdx = 0;

  for (const [category, profiles] of Object.entries(categoryGroups)) {
    const avgPrices = profiles.map(p => p.avgPrice).sort((a, b) => a - b);
    const p33 = avgPrices[Math.floor(avgPrices.length * 0.33)];
    const p66 = avgPrices[Math.floor(avgPrices.length * 0.66)];

    const tiers = [
      { label: 'Budget', customers: profiles.filter(p => p.avgPrice <= p33) },
      { label: 'Mid-Range', customers: profiles.filter(p => p.avgPrice > p33 && p.avgPrice <= p66) },
      { label: 'Premium', customers: profiles.filter(p => p.avgPrice > p66) },
    ].filter(t => t.customers.length > 0);

    for (const tier of tiers) {
      if (archetypeIdx >= 200) break;

      // Aggregate all purchases for this archetype
      const allRecs = tier.customers.flatMap(c => c.recs);

      // Deduplicate: for same product, take max review score
      const productRatings = new Map();
      for (const r of allRecs) {
        const idx = productIdToIdx.get(r.productId);
        if (idx === undefined) continue;
        const existing = productRatings.get(idx) || 0;
        productRatings.set(idx, Math.max(existing, r.reviewScore));
      }

      const purchases = [...productRatings.entries()].map(([productIdx, score]) => ({
        productIdx,
        product_id: top500ProductIds[productIdx],
        name: productObjects[productIdx]?.name || '',
        review_score: score,
      }));

      const catDisplay = category.replace(/_/g, ' ');
      const displayIdx = archetypeIdx % ARCHETYPE_DISPLAY_NAMES.length;

      archetypes.push({
        id: archetypeIdx + 1,
        userIdx: archetypeIdx,
        archetype_name: `${catDisplay} – ${tier.label}`,
        name: ARCHETYPE_DISPLAY_NAMES[displayIdx] || `Archetype ${archetypeIdx + 1}`,
        top_category: category,
        purchases,
      });

      archetypeIdx++;
    }
  }

  console.log(`Created ${archetypes.length} archetypes`);

  // ─── Build interactions for CF model training ─────────────────────────────

  const trainingUserIndices = [];
  const trainingProductIndices = [];
  const trainingRatings = [];

  for (const archetype of archetypes) {
    for (const purchase of archetype.purchases) {
      trainingUserIndices.push(archetype.userIdx);
      trainingProductIndices.push(purchase.productIdx);
      trainingRatings.push(purchase.review_score / 5);  // normalize to 0..1
    }
  }

  console.log(`Training interactions: ${trainingUserIndices.length}`);

  // ─── Write to PostgreSQL ──────────────────────────────────────────────────

  console.log('Writing to PostgreSQL...');

  // Clear existing data
  await pool.query('TRUNCATE interactions, user_archetypes, products RESTART IDENTITY CASCADE');

  // Insert products
  for (const p of productObjects) {
    await pool.query(
      `INSERT INTO products (product_id, name, category, price, weight_g, price_range, weight_class, feature_vector)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::vector)`,
      [
        p.product_id, p.name, p.category, p.price, p.weight_g,
        p.price_range, p.weight_class,
        `[${p.feature_vector.join(',')}]`,
      ]
    );
  }
  console.log(`Inserted ${productObjects.length} products`);

  // Insert archetypes (without embeddings — these come after TF.js training)
  for (const a of archetypes) {
    await pool.query(
      `INSERT INTO user_archetypes (archetype_name, top_category) VALUES ($1,$2)`,
      [a.archetype_name, a.top_category]
    );
  }
  console.log(`Inserted ${archetypes.length} user archetypes`);

  // Insert interactions
  for (let i = 0; i < trainingUserIndices.length; i++) {
    await pool.query(
      `INSERT INTO interactions (user_idx, product_idx, rating) VALUES ($1,$2,$3)
       ON CONFLICT (user_idx, product_idx) DO UPDATE SET rating = GREATEST(interactions.rating, EXCLUDED.rating)`,
      [trainingUserIndices[i], trainingProductIndices[i], trainingRatings[i]]
    );
  }
  console.log(`Inserted ${trainingUserIndices.length} interactions`);

  // ─── Write JSON files for browser ─────────────────────────────────────────

  mkdirSync(DATA_OUT, { recursive: true });

  // products.json — catalog for product grid
  const productsForBrowser = productObjects.map(p => ({
    id: p.idx + 1,         // matches DB serial id
    productIdx: p.idx,
    product_id: p.product_id,
    name: p.name,
    category: p.category,
    price: p.price,
    weight_g: p.weight_g,
    price_range: p.price_range,
    weight_class: p.weight_class,
  }));
  writeFileSync(
    path.join(DATA_OUT, 'products.json'),
    JSON.stringify(productsForBrowser, null, 2)
  );

  // users.json — archetype list with purchase history for the browser user selector
  const usersForBrowser = archetypes.map(a => ({
    id: a.id,
    userIdx: a.userIdx,
    name: a.name,
    archetype_name: a.archetype_name,
    top_category: a.top_category,
    purchases: a.purchases.slice(0, 20),  // limit to 20 for browser display
  }));
  writeFileSync(
    path.join(DATA_OUT, 'users.json'),
    JSON.stringify(usersForBrowser, null, 2)
  );

  // interactions.json — training data for CF model
  writeFileSync(
    path.join(DATA_OUT, 'interactions.json'),
    JSON.stringify({
      numUsers: archetypes.length,
      numProducts: productObjects.length,
      userIndices: trainingUserIndices,
      productIndices: trainingProductIndices,
      ratings: trainingRatings,
    })
  );

  console.log('JSON files written to data/');
  console.log('\n✓ Preprocessing complete!');
  console.log(`  Products: ${productObjects.length}`);
  console.log(`  Archetypes: ${archetypes.length}`);
  console.log(`  Training interactions: ${trainingUserIndices.length}`);

  await pool.end();
}

main().catch(err => {
  console.error('Preprocessing failed:', err);
  process.exit(1);
});
