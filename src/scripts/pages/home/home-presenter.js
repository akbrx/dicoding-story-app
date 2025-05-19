import CONFIG from '../../config.js';

export default class HomePresenter {
    #model = null;
    #view = null;

    constructor({ model, view }) {
        this.#model = model;
        this.#view = view;
        console.log("[Home Presenter] Siap digunakan");
    }

    async init() {
        if (!this.#view.init()) {
            console.error("[Home Presenter] Gagal inisialisasi view");
            return;
        }

        this.#view.setupMapObserver(() => this.#initializeMap());
        await this.#fetchStoriesAwal();
        this.#registerEvents();
    }

    async #fetchStoriesAwal() {
        try {
            const { stories, allLoaded } = await this.#model.fetchInitialStories();
            this.#view.removeSkeletonLoaders();

            if (stories.length === 0) {
                this.#view.showNoStoriesMessage();
            } else {
                this.#view.renderStoryItems(stories);
                this.#view.showLoadMoreButton(!allLoaded);

                if (this.#isMapReady()) {
                    this.#refreshMapMarkers();
                }
            }
        } catch (err) {
            this.#view.showStoryLoadError(err);
        }
    }

    async #fetchStoriesLanjutan() {
        this.#view.setLoadMoreButtonLoading(true);

        try {
            const { stories, allLoaded } = await this.#model.fetchMoreStories();

            if (stories.length > 0) {
                this.#view.renderStoryItems(stories, true);

                if (this.#isMapReady()) {
                    this.#refreshMapMarkers();
                }
            }

            this.#view.showLoadMoreButton(!allLoaded);
        } catch (err) {
            this.#view.showLoadMoreError(err);
        } finally {
            this.#view.setLoadMoreButtonLoading(false);
        }
    }

    #isMapReady() {
        // Penyesuaian sesuai implementasi view
        return true;
    }

    #initializeMap() {
        const berhasil = this.#view.initMap();

        if (berhasil) {
            const stories = this.#model.getStories();
            if (stories.length > 0) {
                this.#refreshMapMarkers();
            }
        }
    }

    #refreshMapMarkers() {
        const stories = this.#model.getStories();
        this.#view.populateMapMarkers(stories);
    }

    #registerEvents() {
        this.#view.attachLoadMoreEvent(() => this.#fetchStoriesLanjutan());

        window.removeEventListener('hashchange', this.cleanup);
        window.removeEventListener('beforeunload', this.cleanup);
        window.addEventListener('hashchange', this.cleanup.bind(this), { once: true });
        window.addEventListener('beforeunload', this.cleanup.bind(this));

        console.log("[Home Presenter] Event listener terpasang");
    }

    async cleanup() {
        console.log("[Home Presenter] Proses cleanup dimulai...");

        if (this.#view) {
            this.#view.cleanup();
        }

        if (this.#model) {
            this.#model.resetState();
        }

        window.removeEventListener('beforeunload', this.cleanup);
        window.removeEventListener('hashchange', this.cleanup);

        console.log("[Home Presenter] Cleanup selesai");
    }

    async handleNotificationToggle() {
        try {
            const registration = await navigator.serviceWorker.ready;
            const existingSubscription = await registration.pushManager.getSubscription();

            if (existingSubscription) {
                await this.#model.unsubscribeFromNotifications(existingSubscription.endpoint);
                await existingSubscription.unsubscribe();
                console.log('[Home Presenter] Berhasil berhenti langganan notifikasi');
                return false;
            } else {
                const vapidKey = CONFIG.VAPID_PUBLIC_KEY;
                console.log('[Home Presenter] Mulai berlangganan dengan VAPID key:', vapidKey);

                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.#urlBase64ToUint8Array(vapidKey)
                });

                const hasil = await this.#model.subscribeToNotifications(subscription);
                console.log('[Home Presenter] Hasil subscribe:', hasil);
                return true;
            }
        } catch (err) {
            console.error('[Home Presenter] Toggle notifikasi gagal:', err);
            throw err;
        }
    }

    #urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }

        return outputArray;
    }
}