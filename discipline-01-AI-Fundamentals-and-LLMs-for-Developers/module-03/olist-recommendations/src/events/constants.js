// DOM CustomEvents — dispatched on document
export const events = {
  userSelected: 'user:selected',
  usersUpdated: 'users:updated',
  purchaseAdded: 'purchase:added',

  filterChanged: 'filter:changed',

  modelTrain: 'training:train',
  trainingComplete: 'training:complete',
  modelProgressUpdate: 'model:progress-update',

  recommendationsReady: 'recommendations:ready',
  recommend: 'recommend',
};

// Worker postMessage action/type strings — used by modelTrainingWorker.js
export const workerEvents = {
  trainModel: 'train:model',
  trainingComplete: 'training:complete',
  trainingLog: 'training:log',
  progressUpdate: 'progress:update',
  tfVisData: 'tfvis:data',
  tfVisLogs: 'tfvis:logs',

  recommend: 'recommend',
  recommendResult: 'recommend:result',
};
