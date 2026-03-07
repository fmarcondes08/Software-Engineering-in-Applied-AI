import { View } from './View.js';

export class FilterView extends View {
  #categorySelect = document.querySelector('#categorySelect');
  #priceSlider = document.querySelector('#priceRangeSlider');
  #priceLabel = document.querySelector('#priceRangeLabel');
  #userSelect = document.querySelector('#userSelect');
  #pastPurchasesSection = document.querySelector('#pastPurchasesSection');
  #pastPurchasesList = document.querySelector('#pastPurchasesList');
  #onFilterChanged;
  #onUserSelected;

  constructor() {
    super();
  }

  registerFilterChangedCallback(callback) {
    this.#onFilterChanged = callback;
  }

  registerUserSelectedCallback(callback) {
    this.#onUserSelected = callback;
  }

  attachEventListeners() {
    this.#categorySelect.addEventListener('change', () => this.#emitFilters());

    this.#priceSlider.addEventListener('input', () => {
      this.#priceLabel.textContent = `R$ ${this.#priceSlider.value}`;
      this.#emitFilters();
    });

    document.querySelectorAll('input[name="weightClass"]').forEach(radio => {
      radio.addEventListener('change', () => this.#emitFilters());
    });

    this.#userSelect.addEventListener('change', () => this.#emitUserSelected());
  }

  populateCategories(categories) {
    const options = ['<option value="all">All Categories</option>',
      ...categories.map(c =>
        `<option value="${c}">${c.replace(/_/g, ' ')}</option>`
      ),
    ].join('');
    this.#categorySelect.innerHTML = options;
  }

  populateUsers(users) {
    const options = ['<option value="">— New Visitor (Cold Start) —</option>',
      ...users.map(u =>
        `<option value="${u.id}">${u.name} (${u.top_category?.replace(/_/g, ' ') ?? ''})</option>`
      ),
    ].join('');
    this.#userSelect.innerHTML = options;
  }

  updateWishlist(purchases) {
    if (!purchases || purchases.length === 0) {
      this.#pastPurchasesSection.style.display = 'none';
      return;
    }
    this.#pastPurchasesSection.style.display = 'block';
    this.#pastPurchasesList.innerHTML = purchases
      .map(p => `<li><i class="bi bi-heart-fill text-danger me-1"></i>${p.name}</li>`)
      .join('');
  }

  #emitFilters() {
    if (!this.#onFilterChanged) return;
    const weightRadio = document.querySelector('input[name="weightClass"]:checked');
    this.#onFilterChanged({
      category: this.#categorySelect.value,
      priceMax: Number(this.#priceSlider.value),
      weightClass: weightRadio?.value ?? '',
    });
  }

  #emitUserSelected() {
    if (!this.#onUserSelected) return;
    const userId = this.#userSelect.value ? Number(this.#userSelect.value) : null;
    this.#onUserSelected(userId);
  }

  // Allow programmatic trigger of the initial recommendation on load
  triggerInitialFilters() {
    this.#emitFilters();
  }
}
