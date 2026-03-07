export class TFVisorController {
  #events;
  #lossHistory = [];
  #surface;

  constructor({ events }) {
    this.#events = events;
    this.init();
  }

  static init(deps) {
    return new TFVisorController(deps);
  }

  init() {
    this.#events.onTFVisLogs(data => {
      this.#lossHistory.push({ x: data.epoch + 1, y: data.loss });
      this.#renderLossChart();
    });

    this.#events.onTrainingComplete(() => {
      console.log('[TFVisor] Training complete. Final loss:', this.#lossHistory.at(-1)?.y);
    });
  }

  #renderLossChart() {
    if (typeof tfvis === 'undefined') return;

    const surface = tfvis.visor().surface({
      name: 'CF Model Training Loss',
      tab: 'Training',
    });

    tfvis.render.linechart(
      surface,
      { values: [this.#lossHistory], series: ['MSE Loss'] },
      { xLabel: 'Epoch', yLabel: 'Loss', width: 400, height: 250 }
    );
  }
}
