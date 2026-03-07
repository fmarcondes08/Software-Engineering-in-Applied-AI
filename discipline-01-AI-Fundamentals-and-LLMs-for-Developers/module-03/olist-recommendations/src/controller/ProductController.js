export class ProductController {
  #productView;
  #userService;
  #events;

  constructor({ productView, userService, events }) {
    this.#productView = productView;
    this.#userService = userService;
    this.#events = events;
    this.init();
  }

  static init(deps) {
    return new ProductController(deps);
  }

  init() {
    this.#productView.registerWishlistCallback(this.#onAddToWishlist.bind(this));

    this.#events.onRecommendationsReady(data => {
      this.#productView.render(data.recommendations ?? []);
    });

    this.#events.onUserSelected(() => {
      // Allow wishlist actions for both archetype users and new visitors.
      this.#productView.setButtonsEnabled(true);
    });
  }

  #onAddToWishlist(product) {
    const updatedUser = this.#userService.addToWishlist(product);
    this.#events.dispatchPurchaseAdded({ product, user: updatedUser });
    this.#events.dispatchUsersUpdated({ sessionUser: updatedUser });
  }
}
