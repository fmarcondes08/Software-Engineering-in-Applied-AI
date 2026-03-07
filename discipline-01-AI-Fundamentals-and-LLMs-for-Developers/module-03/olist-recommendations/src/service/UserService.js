export class UserService {
  #storageKey = 'olist-users';
  #sessionKey = 'olist-session-user';

  async getDefaultUsers() {
    const res = await fetch('/data/users.json');
    const users = await res.json();
    sessionStorage.setItem(this.#storageKey, JSON.stringify(users));
    return users;
  }

  async getUsers() {
    const data = sessionStorage.getItem(this.#storageKey);
    return data ? JSON.parse(data) : [];
  }

  async getUserById(userId) {
    const users = await this.getUsers();
    return users.find(u => u.id === userId || u.userIdx === userId);
  }

  // Session user = current visitor (may have added wishlist items)
  getSessionUser() {
    const data = sessionStorage.getItem(this.#sessionKey);
    return data ? JSON.parse(data) : { id: null, userIdx: -1, name: 'New Visitor', purchases: [] };
  }

  setSessionUser(user) {
    sessionStorage.setItem(this.#sessionKey, JSON.stringify(user));
  }

  addToWishlist(product) {
    const user = this.getSessionUser();
    const alreadyAdded = user.purchases.some(p => p.productIdx === product.productIdx);
    if (!alreadyAdded) {
      user.purchases.push({
        productIdx: product.productIdx ?? product.id - 1,
        name: product.name,
        review_score: 5,  // treat wishlist additions as top-rated
        source: 'wishlist',
      });
      this.setSessionUser(user);
    }
    return user;
  }

  selectArchetype(archetypeUser) {
    // Preserve only explicit wishlist additions from this session.
    // Do not carry purchases from previously selected archetypes.
    const sessionUser = this.getSessionUser();
    const carriedWishlist = (sessionUser.purchases || []).filter(p => p?.source === 'wishlist');
    const merged = {
      ...archetypeUser,
      purchases: [...archetypeUser.purchases, ...carriedWishlist].filter(
        (p, i, arr) => arr.findIndex(x => x.productIdx === p.productIdx) === i
      ),
    };
    this.setSessionUser(merged);
    return merged;
  }

  clearSessionUser() {
    const fresh = { id: null, userIdx: -1, name: 'New Visitor', purchases: [] };
    this.setSessionUser(fresh);
    return fresh;
  }
}
