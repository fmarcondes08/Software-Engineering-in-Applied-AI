export class ModelTrainingController {
  #events;
  #modelView;
  #interactions = null;

  constructor({ events, modelView }) {
    this.#events = events;
    this.#modelView = modelView;
    this.init();
  }

  static init(deps) {
    return new ModelTrainingController(deps);
  }

  async init() {
    // Load interactions from pre-generated JSON (faster than /api/interactions for training)
    try {
      const res = await fetch('/data/interactions.json');
      this.#interactions = await res.json();

      this.#modelView.updateStats({
        products: this.#interactions.numProducts,
        users: this.#interactions.numUsers,
        interactions: this.#interactions.userIndices.length,
      });
    } catch (err) {
      console.warn('Could not load interactions.json — run preprocess first:', err.message);
    }

    this.#modelView.registerTrainCallback(() => {
      if (!this.#interactions) {
        alert('No interactions data found. Please run: node scripts/preprocess.js first.');
        return;
      }
      this.#events.dispatchTrainModel(this.#interactions);
    });

    this.#events.onProgressUpdate(data => {
      this.#modelView.updateProgress(data.progress);
    });

    this.#events.onTrainingComplete(() => {
      this.#modelView.setTrainingComplete();
    });

    this.#events.onRecommend(data => {
      this.#modelView.updateModeIndicator(data.alpha ?? 0, data.isModelTrained);
    });
  }
}
