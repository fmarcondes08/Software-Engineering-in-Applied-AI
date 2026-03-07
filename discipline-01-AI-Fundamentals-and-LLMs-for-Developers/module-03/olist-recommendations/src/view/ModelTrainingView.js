import { View } from './View.js';

export class ModelTrainingView extends View {
  #maxEpochs = 60;
  #trainBtn = document.querySelector('#trainModelBtn');
  #progressContainer = document.querySelector('#trainingProgress');
  #progressBar = document.querySelector('#progressBar');
  #progressLabel = document.querySelector('#progressLabel');
  #modeIndicator = document.querySelector('#modeIndicator');
  #alphaValue = document.querySelector('#alphaValue');
  #recommendationMode = document.querySelector('#recommendationMode');
  #statProducts = document.querySelector('#statProducts');
  #statUsers = document.querySelector('#statUsers');
  #statInteractions = document.querySelector('#statInteractions');
  #onTrain;

  constructor() {
    super();
  }

  registerTrainCallback(callback) {
    this.#onTrain = callback;
    this.#trainBtn.addEventListener('click', () => {
      this.#trainBtn.disabled = true;
      this.#progressContainer.style.display = 'block';
      this.#progressBar.style.width = '0%';
      callback();
    });
  }

  updateProgress(percent) {
    const p = Math.round(percent);
    const epoch = Math.round((p / 100) * this.#maxEpochs);
    this.#progressBar.style.width = `${p}%`;
    this.#progressLabel.textContent = `Epoch ${epoch} / ${this.#maxEpochs}`;
  }

  setTrainingComplete() {
    this.#progressBar.style.width = '100%';
    this.#progressLabel.textContent = 'Training complete!';
    this.#trainBtn.disabled = false;
    this.#trainBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Retrain Model';
  }

  updateModeIndicator(alpha, isModelTrained) {
    const cfPct = Math.round(alpha * 100);
    const cbPct = 100 - cfPct;

    if (!isModelTrained || alpha === 0) {
      this.#modeIndicator.className = 'alert p-2 small mb-2 cb-only';
      this.#modeIndicator.innerHTML = '<i class="bi bi-info-circle"></i> Cold Start — using CB only';
      this.#recommendationMode.className = 'badge bg-warning text-dark';
      this.#recommendationMode.textContent = 'CB only';
    } else {
      this.#modeIndicator.className = 'alert p-2 small mb-2 hybrid';
      this.#modeIndicator.innerHTML =
        `<i class="bi bi-diagram-3"></i> Hybrid — CF ${cfPct}% / CB ${cbPct}%`;
      this.#recommendationMode.className = 'badge bg-success';
      this.#recommendationMode.textContent = `Hybrid ${cfPct}/${cbPct}`;
    }

    this.#alphaValue.textContent = alpha.toFixed(2);
  }

  updateStats({ products, users, interactions }) {
    if (this.#statProducts) this.#statProducts.textContent = products ?? '—';
    if (this.#statUsers) this.#statUsers.textContent = users ?? '—';
    if (this.#statInteractions) this.#statInteractions.textContent = interactions ?? '—';
  }
}
