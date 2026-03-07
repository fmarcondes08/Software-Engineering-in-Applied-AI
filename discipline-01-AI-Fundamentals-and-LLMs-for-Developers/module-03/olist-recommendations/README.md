# Olist Hybrid Recommendation System

A real-time e-commerce recommendation system built with **Node.js**, **TensorFlow.js**, and **PostgreSQL + pgvector** for a postgraduate AI project.

## What it demonstrates

- **Collaborative Filtering (CF):** Neural network with user and product embeddings trained in the browser via TensorFlow.js Web Worker
- **Content-Based Filtering (CB):** pgvector cosine similarity on 17-dimensional product feature vectors, queried via HNSW index
- **Hybrid scoring:** `score = α × CF + (1-α) × CB` — alpha scales dynamically from 0 (cold start) to 0.7 (active user)
- **Store-like UX:** Category dropdown + price slider + weight filter → real-time product card recommendations

## Architecture

```
Browser (TensorFlow.js Web Worker)
  ↕  REST API (fetch)
Node.js + Express
  ↕  pg driver
PostgreSQL 16 + pgvector (Docker)
```

## Dataset

Brazilian E-Commerce Olist dataset from Kaggle:
https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce

Download the CSV files and place them in `raw-data/`.

## Setup

### 1. Prerequisites
- Node.js 18+
- Docker + Docker Compose

### 2. Install dependencies
```bash
npm install
```

### 3. Start PostgreSQL with pgvector
```bash
docker-compose up -d
```

### 4. Download Olist dataset
Download from Kaggle and place the following CSV files in `raw-data/`:
- `olist_orders_dataset.csv`
- `olist_order_items_dataset.csv`
- `olist_products_dataset.csv`
- `olist_order_reviews_dataset.csv`
- `olist_customers_dataset.csv`
- `olist_product_category_name_translation.csv`

### 5. Run preprocessing (one time)
```bash
node scripts/preprocess.js
```

This populates PostgreSQL and generates `data/products.json`, `data/users.json`, and `data/interactions.json`.

### 6. Start the server
```bash
node server.js
```

Open http://localhost:3000

## How to use

1. **Cold start:** Open the app — products appear immediately using CB (pgvector cosine similarity based on filters)
2. **Filter:** Change Category, Price, or Weight filter → product grid updates in real time
3. **Add to wishlist anytime:** Click the heart button (works for New Visitor and archetypes) → recommendations refresh using wishlist-aware CB boosts
4. **Select a user archetype** from the dropdown to use a predefined profile and enable CF personalization after training
5. **Train CF model:** Click "Train CF Model" → TensorFlow.js trains up to 60 epochs (with early stopping) in a Web Worker, then stores embeddings in pgvector
6. **After training:** Recommendations become hybrid (CF + CB weighted average) for archetype users; New Visitor remains CB-only

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | Full product catalog |
| GET | `/api/users` | User archetype list |
| GET | `/api/interactions` | CF training data |
| GET | `/api/similar` | CB: pgvector ANN cosine similarity |
| GET | `/api/cf-neighbors` | CF: products liked by similar users |
| POST | `/api/embeddings` | Store trained user embeddings |

## DB Schema

```sql
products (id, product_id, name, category, price, weight_g, price_range, weight_class, feature_vector vector(17))
user_archetypes (id, archetype_name, top_category, user_embedding vector(32))
interactions (id, user_idx, product_idx, rating)
```

HNSW index on `products.feature_vector` for fast ANN search.

## Verify after preprocessing

```bash
# Check products in DB
psql postgresql://olist_user:olist_pass@localhost:5432/olist_recommendations \
  -c "SELECT COUNT(*) FROM products;"

# Test pgvector search
curl "http://localhost:3000/api/similar?category=electronics&limit=5"
```
