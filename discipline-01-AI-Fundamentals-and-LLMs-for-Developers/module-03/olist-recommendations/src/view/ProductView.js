import { View } from './View.js';

export class ProductView extends View {
  #productList = document.querySelector('#productList');
  #productTemplate = null;
  #onWishlist;
  #buttonsEnabled = false;

  constructor() {
    super();
    this.init();
  }

  async init() {
    this.#productTemplate = await this.loadTemplate('./src/view/templates/product-card.html');
  }

  registerWishlistCallback(callback) {
    this.#onWishlist = callback;
  }

  setButtonsEnabled(enabled) {
    this.#buttonsEnabled = enabled;
    const btns = document.querySelectorAll('.wishlist-btn');
    btns.forEach(b => { b.disabled = !enabled; });
  }

  render(products) {
    if (!this.#productTemplate || !products) return;

    if (products.length === 0) {
      this.#productList.innerHTML = `
        <div class="col-12 text-center text-muted py-4">
          <i class="bi bi-emoji-frown fs-2"></i>
          <p class="mt-2">No products matched the current filters.</p>
        </div>`;
      return;
    }

    const html = products.map(product => {
      const hybridPct = Math.round((product.score ?? 0) * 100);
      const cfPct = Math.round((product.cf_score ?? 0) * 100);
      const cbPct = Math.round((product.cb_score ?? 0) * 100);
      const catClass = `cat-${product.category}`;
      const fallbackName = product.product_id
        ? `${product.category ?? 'Product'} #${String(product.product_id).slice(0, 8).toUpperCase()}`
        : `Product #${product.id ?? 'N/A'}`;

      return this.replaceTemplate(this.#productTemplate, {
        id: product.id,
        productIdx: product.productIdx ?? (product.id - 1),
        name: product.name ?? fallbackName,
        category: product.category?.replace(/_/g, ' ') ?? '—',
        catClass,
        price: product.price ? `R$ ${Number(product.price).toFixed(2)}` : '—',
        weightClass: ['Light', 'Medium', 'Heavy'][product.weight_class] ?? '—',
        hybridPct,
        cfPct,
        cbPct,
        product: JSON.stringify(product).replace(/'/g, '&#39;'),
      });
    }).join('');

    this.#productList.innerHTML = html;
    this.#attachWishlistListeners();
    this.setButtonsEnabled(this.#buttonsEnabled);
  }

  #attachWishlistListeners() {
    const buttons = document.querySelectorAll('.wishlist-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const product = JSON.parse(btn.dataset.product);
        const originalHtml = btn.innerHTML;

        btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Added';
        btn.classList.add('added');
        setTimeout(() => {
          btn.innerHTML = originalHtml;
          btn.classList.remove('added');
        }, 600);

        if (this.#onWishlist) this.#onWishlist(product);
      });
    });
  }
}
