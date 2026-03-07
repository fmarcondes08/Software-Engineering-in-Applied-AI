/**
 * App Bootstrap — Olist Hybrid Recommendation System
 *
 * Wires up all MVC components following the module-03 pattern.
 */

import Events from './events/events.js';
import { ProductService } from './service/ProductService.js';
import { UserService } from './service/UserService.js';
import { ProductView } from './view/ProductView.js';
import { FilterView } from './view/FilterView.js';
import { ModelTrainingView } from './view/ModelTrainingView.js';
import { WorkerController } from './controller/WorkerController.js';
import { RecommendationController } from './controller/RecommendationController.js';
import { ProductController } from './controller/ProductController.js';
import { ModelTrainingController } from './controller/ModelTrainingController.js';
import { TFVisorController } from './controller/TFVisorController.js';

// ─── Services ─────────────────────────────────────────────────────────────────

const productService = new ProductService();
const userService = new UserService();

// ─── Views ────────────────────────────────────────────────────────────────────

const productView = new ProductView();
const filterView = new FilterView();
const modelView = new ModelTrainingView();

// ─── Web Worker ───────────────────────────────────────────────────────────────

const mlWorker = new Worker('/src/workers/modelTrainingWorker.js', { type: 'module' });

// ─── Controllers ──────────────────────────────────────────────────────────────

const workerController = WorkerController.init({ worker: mlWorker, events: Events });

RecommendationController.init({ events: Events, userService, workerController });

ProductController.init({ productView, userService, events: Events });

ModelTrainingController.init({ events: Events, modelView });

TFVisorController.init({ events: Events });

// ─── Filter & User wiring ─────────────────────────────────────────────────────

filterView.registerFilterChangedCallback(filters => {
  Events.dispatchFilterChanged(filters);
});

filterView.registerUserSelectedCallback(async userId => {
  let user;
  if (!userId) {
    user = userService.clearSessionUser();
  } else {
    const archetype = await userService.getUserById(userId);
    if (archetype) {
      user = userService.selectArchetype(archetype);
    }
  }
  Events.dispatchUserSelected(user);
  Events.dispatchUsersUpdated({ sessionUser: user });
});

// Update wishlist panel when a purchase is added
Events.onUsersUpdated(({ sessionUser }) => {
  filterView.updateWishlist(sessionUser?.purchases ?? []);
});

filterView.attachEventListeners();

// ─── Initial data load ────────────────────────────────────────────────────────

async function bootstrap() {
  const [categories, users] = await Promise.all([
    productService.getCategories(),
    userService.getDefaultUsers(),
  ]);

  filterView.populateCategories(categories);
  filterView.populateUsers(users);

  const initialUser = userService.clearSessionUser();
  Events.dispatchUserSelected(initialUser);
  Events.dispatchUsersUpdated({ sessionUser: initialUser });

  // Trigger initial CB recommendation (cold start, no model needed)
  filterView.triggerInitialFilters();
}

bootstrap().catch(err => console.error('Bootstrap failed:', err));
