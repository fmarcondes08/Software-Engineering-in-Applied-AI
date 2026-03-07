import { events } from './constants.js';

export default class Events {

  // ── Training ───────────────────────────────────────────────────────────────

  static onTrainModel(callback) {
    document.addEventListener(events.modelTrain, e => callback(e.detail));
  }
  static dispatchTrainModel(data) {
    document.dispatchEvent(new CustomEvent(events.modelTrain, { detail: data }));
  }

  static onTrainingComplete(callback) {
    document.addEventListener(events.trainingComplete, e => callback(e.detail));
  }
  static dispatchTrainingComplete(data) {
    document.dispatchEvent(new CustomEvent(events.trainingComplete, { detail: data }));
  }

  static onProgressUpdate(callback) {
    document.addEventListener(events.modelProgressUpdate, e => callback(e.detail));
  }
  static dispatchProgressUpdate(data) {
    document.dispatchEvent(new CustomEvent(events.modelProgressUpdate, { detail: data }));
  }

  // ── TF.js Vis ─────────────────────────────────────────────────────────────

  static onTFVisorData(callback) {
    document.addEventListener(events.tfVisData, e => callback(e.detail));
  }
  static dispatchTFVisorData(data) {
    document.dispatchEvent(new CustomEvent(events.tfVisData, { detail: data }));
  }

  static onTFVisLogs(callback) {
    document.addEventListener(events.tfVisLogs, e => callback(e.detail));
  }
  static dispatchTFVisLogs(data) {
    document.dispatchEvent(new CustomEvent(events.tfVisLogs, { detail: data }));
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  static onUserSelected(callback) {
    document.addEventListener(events.userSelected, e => callback(e.detail));
  }
  static dispatchUserSelected(data) {
    document.dispatchEvent(new CustomEvent(events.userSelected, { detail: data }));
  }

  static onUsersUpdated(callback) {
    document.addEventListener(events.usersUpdated, e => callback(e.detail));
  }
  static dispatchUsersUpdated(data) {
    document.dispatchEvent(new CustomEvent(events.usersUpdated, { detail: data }));
  }

  // ── Purchases / Wishlist ──────────────────────────────────────────────────

  static onPurchaseAdded(callback) {
    document.addEventListener(events.purchaseAdded, e => callback(e.detail));
  }
  static dispatchPurchaseAdded(data) {
    document.dispatchEvent(new CustomEvent(events.purchaseAdded, { detail: data }));
  }

  // ── Filters ───────────────────────────────────────────────────────────────

  static onFilterChanged(callback) {
    document.addEventListener(events.filterChanged, e => callback(e.detail));
  }
  static dispatchFilterChanged(data) {
    document.dispatchEvent(new CustomEvent(events.filterChanged, { detail: data }));
  }

  // ── Recommendations ───────────────────────────────────────────────────────

  static onRecommend(callback) {
    document.addEventListener(events.recommend, e => callback(e.detail));
  }
  static dispatchRecommend(data) {
    document.dispatchEvent(new CustomEvent(events.recommend, { detail: data }));
  }

  static onRecommendationsReady(callback) {
    document.addEventListener(events.recommendationsReady, e => callback(e.detail));
  }
  static dispatchRecommendationsReady(data) {
    document.dispatchEvent(new CustomEvent(events.recommendationsReady, { detail: data }));
  }
}
