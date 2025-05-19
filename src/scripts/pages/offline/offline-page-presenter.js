import { showSuccessMessage, showErrorMessage } from '../../utils/ui-utils';

export default class OfflinePagePresenter {
  #model = null;
  #view = null;
  #boundDeleteHandler = null;
  #boundCleanupHandler = null;

  constructor(model, view) {
    this.#model = model;
    this.#view = view;
    this.#boundDeleteHandler = this.#onDeleteClick.bind(this);
    this.#boundCleanupHandler = this._cleanup.bind(this);
  }

  async initialize(container) {
    this.#view.initializeView(container);
    this.#view.registerCallback('delete', this.#boundDeleteHandler);
    this.#view.setLoadingState(true);

    try {
      await this.#model.loadStories();
      this.#view.renderStories(this.#model.getStories());
    } catch (err) {
      showErrorMessage("Gagal memuat cerita tersimpan.");
      this.#view.showErrorMessage();
    } finally {
      this.#view.setLoadingState(false);
      this.#setupCleanupListener();
    }
  }

  async #onDeleteClick(event) {
    const btn = event.currentTarget;
    const storyId = btn.dataset.id;
    if (!storyId) return;

    const story = this.#model.findStory(storyId);
    const storyTitle = story ? story.name : storyId;

    if (confirm(`Anda yakin ingin menghapus cerita "${storyTitle}" dari penyimpanan offline?`)) {
      this.#view.showDeleteLoading(btn);
      try {
        await this.#model.deleteStory(storyId);
        showSuccessMessage("Cerita berhasil dihapus dari offline.");
        this.#view.removeStoryElement(storyId);

        if (this.#model.isEmpty()) {
          this.#view.renderStories([]);
        }
      } catch (err) {
        showErrorMessage(`Gagal menghapus cerita: ${err.message}`);
        this.#view.resetDeleteButton(btn);
      }
    }
  }

  _cleanup() {
    console.log("OfflinePage cleanup initiated...");
    this.#view.cleanup();
    window.removeEventListener('hashchange', this.#boundCleanupHandler);
    console.log("OfflinePage cleanup done.");
  }

  #setupCleanupListener() {
    window.removeEventListener('hashchange', this.#boundCleanupHandler);
    window.addEventListener('hashchange', this.#boundCleanupHandler, { once: true });
    console.log("OfflinePage cleanup listener attached.");
  }
}