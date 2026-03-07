export class RecommendationController {
  #events;
  #userService;
  #workerController;
  #currentFilters = { category: 'all', priceMax: 1500, weightClass: '' };
  #isModelTrained = false;

  constructor({ events, userService, workerController }) {
    this.#events = events;
    this.#userService = userService;
    this.#workerController = workerController;
    this.init();
  }

  static init(deps) {
    return new RecommendationController(deps);
  }

  init() {
    this.setupCallbacks();
  }

  setupCallbacks() {
    // When filters change, trigger a fresh recommendation
    this.#events.onFilterChanged(filters => {
      this.#currentFilters = filters;
      this.triggerRecommendation();
    });

    // When a user archetype is selected, update session user and recommend
    this.#events.onUserSelected(user => {
      this.triggerRecommendation();
    });

    // When a wishlist item is added, re-recommend
    this.#events.onPurchaseAdded(() => {
      this.triggerRecommendation();
    });

    // After training completes, alpha becomes non-zero; re-recommend
    this.#events.onTrainingComplete(() => {
      this.#isModelTrained = true;
      this.triggerRecommendation();
    });
  }

  triggerRecommendation() {
    const user = this.#userService.getSessionUser();
    const userIdx = user.userIdx ?? -1;
    const userId = user.id ?? null;
    const userPurchases = user.purchases ?? [];
    const hasCFUser = Number.isInteger(userIdx) && userIdx >= 0;

    // Compute dynamic alpha: 0 = pure CB, up to 0.7 for active users
    const alpha = (this.#isModelTrained && hasCFUser)
      ? Math.min(0.7, userPurchases.length * 0.14)
      : 0;

    this.#events.dispatchRecommend({
      userIdx,
      userId,
      userPurchases,
      filters: this.#currentFilters,
      alpha,
      isModelTrained: this.#isModelTrained,
    });
  }
}
