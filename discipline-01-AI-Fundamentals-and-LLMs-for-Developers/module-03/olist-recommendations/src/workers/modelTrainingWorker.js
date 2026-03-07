/**
 * TensorFlow.js Web Worker — Hybrid Recommendation Model
 *
 * Handles two actions:
 *   train:model  — trains the CF embedding model, then POSTs user embeddings to pgvector
 *   recommend    — runs hybrid CF + CB scoring and returns top-12 recommendations
 *
 * CF model: matrix factorisation via neural network embeddings (user × product)
 * CB scores: fetched from the Express /api/similar endpoint (pgvector cosine similarity)
 */

import 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
import { workerEvents } from '../events/constants.js';

console.log('[Worker] Initialised');

let _cfModel = null;
let _catalog = [];          // full product list (loaded from /data/products.json)
let _numUsers = 0;
let _numProducts = 0;

async function _buildPurchaseBoostMap(userPurchases = [], numProducts = 0) {
  if (!Array.isArray(userPurchases) || userPurchases.length === 0) return {};

  const similarityLimit = Math.min(numProducts, 100);
  const sampledPurchases = userPurchases.slice(-8);
  const boostMap = {};

  await Promise.all(sampledPurchases.map(async purchase => {
    const productId = Number(purchase?.id ?? (purchase?.productIdx ?? -1) + 1);
    if (!productId || productId < 1) return;

    try {
      const res = await fetch(`/api/similar?productId=${productId}&limit=${similarityLimit}`);
      const similar = await res.json();
      if (!Array.isArray(similar)) {
        console.warn('[Worker] Purchase-boost skipped: /api/similar did not return array', similar);
        return;
      }
      similar.forEach(item => {
        const id = Number(item.id);
        const score = Number(item.cb_score) || 0;
        if (!id || score <= 0) return;
        boostMap[id] = Math.max(boostMap[id] || 0, score);
      });
    } catch (err) {
      console.error('[Worker] Purchase-boost fetch failed:', err.message);
    }
  }));

  return boostMap;
}

// ─── CF Model Definition ──────────────────────────────────────────────────────

function buildCFModel(numUsers, numProducts, embeddingDim = 32) {
  const userInput = tf.input({ shape: [1], name: 'user_input', dtype: 'int32' });
  const itemInput = tf.input({ shape: [1], name: 'item_input', dtype: 'int32' });

  const userEmbed = tf.layers.embedding({
    inputDim: numUsers,
    outputDim: embeddingDim,
    embeddingsRegularizer: tf.regularizers.l2({ l2: 1e-6 }),
    name: 'user_embedding',
  }).apply(userInput);

  const itemEmbed = tf.layers.embedding({
    inputDim: numProducts,
    outputDim: embeddingDim,
    embeddingsRegularizer: tf.regularizers.l2({ l2: 1e-6 }),
    name: 'item_embedding',
  }).apply(itemInput);

  const userFlat = tf.layers.flatten().apply(userEmbed);
  const itemFlat = tf.layers.flatten().apply(itemEmbed);

  // Dot product similarity
  const dotted = tf.layers.dot({ axes: 1 }).apply([userFlat, itemFlat]);

  // Squeeze to scalar + sigmoid to bound to [0,1]
  const output = tf.layers.dense({ units: 1, activation: 'sigmoid', name: 'output' }).apply(dotted);

  const model = tf.model({ inputs: [userInput, itemInput], outputs: output });
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
    metrics: ['mae'],
  });

  return model;
}

// ─── Train action ─────────────────────────────────────────────────────────────

async function trainModel({ interactions }) {
  const { numUsers, numProducts, userIndices, productIndices, ratings } = interactions;
  _numUsers = numUsers;
  _numProducts = numProducts;

  console.log(`[Worker] Training CF model: ${numUsers} users × ${numProducts} products, ${userIndices.length} interactions`);

  _cfModel = buildCFModel(numUsers, numProducts);

  const userTensor = tf.tensor1d(userIndices, 'int32');
  const itemTensor = tf.tensor1d(productIndices, 'int32');
  const ratingTensor = tf.tensor1d(ratings, 'float32');

  const EPOCHS = 60;
  const earlyStopping = tf.callbacks.earlyStopping({
    monitor: 'loss',
    patience: 6,
    minDelta: 0.0005,
  });
  const progressCallback = new tf.CustomCallback({
    onEpochEnd: (epoch, logs) => {
      postMessage({
        type: workerEvents.progressUpdate,
        progress: { progress: Math.round(((epoch + 1) / EPOCHS) * 100) },
      });
      postMessage({
        type: workerEvents.trainingLog,
        epoch,
        loss: logs.loss,
        mae: logs.mae,
      });
      postMessage({
        type: workerEvents.tfVisLogs,
        epoch,
        loss: logs.loss,
      });
    },
  });

  await _cfModel.fit([userTensor, itemTensor], ratingTensor, {
    epochs: EPOCHS,
    batchSize: 256,
    shuffle: true,
    callbacks: [earlyStopping, progressCallback],
  });

  tf.dispose([userTensor, itemTensor, ratingTensor]);

  // Extract trained user embeddings and store in pgvector via Express API
  await _storeEmbeddingsInDB();

  postMessage({ type: workerEvents.trainingComplete });
  console.log('[Worker] Training complete');
}

async function _storeEmbeddingsInDB() {
  const embeddingLayer = _cfModel.getLayer('user_embedding');
  const weights = embeddingLayer.getWeights()[0];
  const allEmbeddings = await weights.array();  // shape [numUsers, 32]

  const payload = allEmbeddings.map((embedding, userIdx) => ({ userIdx, embedding }));

  try {
    const response = await fetch('/api/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmbeddings: payload }),
    });
    const result = await response.json();
    console.log(`[Worker] Stored ${result.updated} embeddings in pgvector`);
  } catch (err) {
    console.error('[Worker] Failed to store embeddings:', err.message);
  }
}

// ─── Recommend action ─────────────────────────────────────────────────────────

async function recommend({ userIdx, userId, userPurchases, filters, alpha, isModelTrained }) {
  if (_catalog.length === 0) {
    await _loadCatalog();
  }

  const numProducts = _catalog.length;

  // ── CF scores ───────────────────────────────────────────────────────────────
  let cfScores = new Array(numProducts).fill(0);

  if (_cfModel && isModelTrained && userIdx >= 0 && userIdx < _numUsers) {
    const userIdxArr = new Array(numProducts).fill(userIdx);
    const productIdxArr = Array.from({ length: numProducts }, (_, i) => i);

    const userTensor = tf.tensor1d(userIdxArr, 'int32');
    const itemTensor = tf.tensor1d(productIdxArr, 'int32');

    const predictions = _cfModel.predict([userTensor, itemTensor]);
    cfScores = Array.from(await predictions.data());

    tf.dispose([userTensor, itemTensor, predictions]);
  }

  // ── CB scores from pgvector API ─────────────────────────────────────────────
  let cbScoreMap = {};

  try {
    const params = new URLSearchParams({
      category: filters?.category || 'all',
      priceMax: filters?.priceMax ?? 1500,
      weightClass: filters?.weightClass ?? '',
      limit: numProducts,
    });
    const cbRes = await fetch(`/api/similar?${params}`);
    const cbProducts = await cbRes.json();
    if (Array.isArray(cbProducts)) {
      cbScoreMap = Object.fromEntries(cbProducts.map(p => [p.id, Number(p.cb_score)]));
    } else {
      console.warn('[Worker] CB fetch returned non-array payload:', cbProducts);
      cbScoreMap = {};
    }
  } catch (err) {
    console.error('[Worker] CB fetch failed:', err.message);
  }

  const purchaseBoostMap = await _buildPurchaseBoostMap(userPurchases, numProducts);
  const purchasedIds = new Set((userPurchases || [])
    .map(p => Number(p?.id ?? (p?.productIdx ?? -1) + 1))
    .filter(id => id > 0));
  const categoryCounts = {};
  for (const id of purchasedIds) {
    const purchased = _catalog.find(p => Number(p.id) === id);
    if (!purchased?.category) continue;
    categoryCounts[purchased.category] = (categoryCounts[purchased.category] || 0) + 1;
  }
  const maxCategoryCount = Math.max(0, ...Object.values(categoryCounts));

  // ── Hybrid combination ───────────────────────────────────────────────────────
  // alpha=0 → pure CB (cold start), alpha=0.7 max → heavy CF weight
  const hybridProducts = _catalog.map((product, i) => {
    const cf = cfScores[i] ?? 0;
    const cbBase = cbScoreMap[product.id] ?? 0;
    const cbBoost = purchaseBoostMap[product.id] ?? 0;
    const categoryAffinity = maxCategoryCount > 0
      ? (categoryCounts[product.category] || 0) / maxCategoryCount
      : 0;
    const affinityBoost = filters?.category === 'all' ? categoryAffinity * 0.15 : 0;
    const cb = userPurchases?.length
      ? (0.40 * cbBase + 0.60 * cbBoost + affinityBoost)
      : cbBase;
    const hybrid = alpha * cf + (1 - alpha) * cb;

    return {
      ...product,
      score: hybrid,
      cf_score: cf,
      cb_score: cb,
    };
  });

  // Apply client-side filter by price (CB query already filters in DB, but catalog may differ)
  const filtered = hybridProducts.filter(p => {
    if (purchasedIds.has(Number(p.id))) return false;
    if (filters?.category && filters.category !== 'all' && p.category !== filters.category) return false;
    if (filters?.priceMax && p.price > filters.priceMax) return false;
    if (filters?.weightClass !== '' && filters?.weightClass !== undefined &&
        String(p.weight_class) !== String(filters.weightClass)) return false;
    return true;
  });

  const top12 = filtered
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  postMessage({ type: workerEvents.recommendResult, recommendations: top12 });
}

async function _loadCatalog() {
  try {
    const res = await fetch('/data/products.json');
    _catalog = await res.json();
    console.log(`[Worker] Loaded catalog: ${_catalog.length} products`);
  } catch (err) {
    console.error('[Worker] Could not load catalog:', err.message);
  }
}

// ─── Message handler ──────────────────────────────────────────────────────────

const handlers = {
  [workerEvents.trainModel]: trainModel,
  [workerEvents.recommend]: recommend,
};

self.onmessage = e => {
  const { action, ...data } = e.data;
  if (handlers[action]) {
    handlers[action](data).catch(err => {
      console.error(`[Worker] Error in handler "${action}":`, err);
    });
  } else {
    console.warn('[Worker] Unknown action:', action);
  }
};
