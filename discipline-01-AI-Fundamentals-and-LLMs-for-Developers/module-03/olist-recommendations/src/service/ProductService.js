export class ProductService {
  #storageKey = 'olist-products';
  #storageVersionKey = 'olist-products-version';
  #storageVersion = 'v2';
  #products = null;

  #hasCategoryDiversity(products = []) {
    const categories = new Set(products.map(p => p?.category).filter(Boolean));
    return categories.size > 1 || !categories.has('other');
  }

  async getProducts() {
    if (this.#products) return this.#products;

    const cachedVersion = sessionStorage.getItem(this.#storageVersionKey);
    if (cachedVersion !== this.#storageVersion) {
      sessionStorage.removeItem(this.#storageKey);
      sessionStorage.setItem(this.#storageVersionKey, this.#storageVersion);
    }

    const cached = sessionStorage.getItem(this.#storageKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (this.#hasCategoryDiversity(parsed)) {
        this.#products = parsed;
        return this.#products;
      }
    }

    const res = await fetch('/api/products');
    const apiProducts = await res.json();

    // Fallback when DB is stale but regenerated JSON is available.
    if (!this.#hasCategoryDiversity(apiProducts)) {
      const jsonRes = await fetch('/data/products.json');
      this.#products = await jsonRes.json();
    } else {
      this.#products = apiProducts;
    }

    sessionStorage.setItem(this.#storageKey, JSON.stringify(this.#products));
    sessionStorage.setItem(this.#storageVersionKey, this.#storageVersion);
    return this.#products;
  }

  async getCategories() {
    const products = await this.getProducts();
    const cats = [...new Set(products.map(p => p.category))].sort();
    return cats;
  }

  async getProductByIdx(productIdx) {
    const products = await this.getProducts();
    return products.find(p => p.productIdx === productIdx || p.id === productIdx + 1);
  }
}
