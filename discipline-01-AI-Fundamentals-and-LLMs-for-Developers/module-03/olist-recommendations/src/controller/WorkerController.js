import { workerEvents } from '../events/constants.js';

export class WorkerController {
  #worker;
  #events;
  #alreadyTrained = false;

  constructor({ worker, events }) {
    this.#worker = worker;
    this.#events = events;
    this.init();
  }

  static init(deps) {
    return new WorkerController(deps);
  }

  async init() {
    this.setupCallbacks();
  }

  setupCallbacks() {
    // When the UI triggers train, pass interactions to the worker
    this.#events.onTrainModel(data => {
      this.#alreadyTrained = false;
      this.triggerTrain(data);
    });

    this.#events.onTrainingComplete(() => {
      this.#alreadyTrained = true;
    });

    // When a recommendation is requested, forward to the worker
    this.#events.onRecommend(data => {
      this.triggerRecommend(data);
    });

    // Route worker messages to CustomEvents
    const silentTypes = [
      workerEvents.progressUpdate,
      workerEvents.trainingLog,
      workerEvents.tfVisData,
      workerEvents.tfVisLogs,
      workerEvents.trainingComplete,
      workerEvents.recommendResult,
    ];

    this.#worker.onmessage = event => {
      const { type } = event.data;
      if (!silentTypes.includes(type)) console.log('[Worker]', event.data);

      if (type === workerEvents.progressUpdate) {
        this.#events.dispatchProgressUpdate(event.data.progress);
      }

      if (type === workerEvents.trainingComplete) {
        this.#events.dispatchTrainingComplete(event.data);
      }

      if (type === workerEvents.tfVisData) {
        this.#events.dispatchTFVisorData(event.data.data);
      }

      if (type === workerEvents.trainingLog) {
        this.#events.dispatchTFVisLogs(event.data);
      }

      if (type === workerEvents.recommendResult) {
        this.#events.dispatchRecommendationsReady(event.data);
      }
    };
  }

  triggerTrain(interactions) {
    this.#worker.postMessage({ action: workerEvents.trainModel, interactions });
  }

  triggerRecommend(data) {
    this.#worker.postMessage({ action: workerEvents.recommend, ...data });
  }

  get isModelTrained() {
    return this.#alreadyTrained;
  }
}
