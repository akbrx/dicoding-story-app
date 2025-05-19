import { showSuccessMessage, showErrorMessage } from '../../utils/ui-utils.js';

export default class AddStoryPagePresenter {
    constructor(model, view) {
        this.model = model;
        this.view = view;
        console.info("[AddStoryPagePresenter] Dibuat.");
    }

    init() {
        console.info("[AddStoryPagePresenter] Mulai inisialisasi...");
        this._registerEvents();
        this._initMapInput();
        this.view.focusDescription();
    }

    _registerEvents() {
        const {
            form, startCameraButton, capturePhotoButton,
            uploadFileButton, photoFileInput, getCurrentLocationButton
        } = this.view.domElements;

        if (form) {
            form.addEventListener('submit', this._onFormSubmit.bind(this));
        }

        if (startCameraButton) {
            startCameraButton.addEventListener('click', this._onStartCameraClick.bind(this));
        }

        if (capturePhotoButton) {
            capturePhotoButton.addEventListener('click', this._onCapturePhotoClick.bind(this));
        }

        if (uploadFileButton && photoFileInput) {
            uploadFileButton.addEventListener('click', () => photoFileInput.click());
            photoFileInput.addEventListener('change', this._onFileInputChange.bind(this));
        }

        if (getCurrentLocationButton) {
            getCurrentLocationButton.addEventListener('click', this._onGetLocationClick.bind(this));
        }

        window.addEventListener('beforeunload', this.cleanup.bind(this));
        window.addEventListener('hashchange', this.cleanup.bind(this));

        console.info("[AddStoryPagePresenter] Semua event listener sudah dipasang.");
    }

    _initMapInput() {
        this.view.setLocationChangeCallback((location) => {
            this.model.setLocation(location);
            this.view.updateSelectedCoordsText(location);
            this.view.updateLocationFeedback('');
        });

        this.view.initMapInput((location) => {
            this.model.setLocation(location);
            this.view.updateSelectedCoordsText(location);
            this.view.updateLocationFeedback('');
        });
    }

    _onFormSubmit(event) {
        event.preventDefault();
        console.info('[AddStoryPagePresenter] Proses submit form...');

        if (this.view.isSubmitting) {
            console.warn('[AddStoryPagePresenter] Submit sedang berlangsung, abaikan.');
            return;
        }

        const validForm = this.view.validateForm();
        const validPhoto = this.view.validatePhoto(this.model.hasPhoto());

        if (!validForm || !validPhoto) {
            this.view.showFormError('Periksa kembali isian form yang wajib diisi.');
            const firstError = this.view.domElements.form.querySelector('[aria-invalid="true"]');
            if (firstError) {
                firstError.focus();
            } else {
                this.view.domElements.formErrorMessageElement.focus();
            }
            return;
        }

        const description = this.view.domElements.descriptionInput.value.trim();
        this.view.setFormSubmittingState(true);

        this.model.submitStory({ description })
            .then(() => {
                console.info('[AddStoryPagePresenter] Cerita berhasil dikirim.');
                showSuccessMessage('Cerita baru berhasil dibagikan!');
                this.cleanup();
                setTimeout(() => { location.hash = '#/'; }, 1500);
            })
            .catch(e => {
                console.error('[AddStoryPagePresenter] Gagal submit cerita:', e);
                this.view.showFormError(`Gagal mengirim cerita: ${e.message}`);
                this.view.setFormSubmittingState(false);
            });
    }

    _onStartCameraClick() {
        const { startCameraButton } = this.view.domElements;
        if (!startCameraButton) return;

        startCameraButton.disabled = true;
        this.view.clearAllErrors();

        try {
            if (this.view.isCameraActive) {
                this.view.stopCamera();
            } else {
                this.view.clearPhotoSelection();
                this.model.clearPhotoFile();

                this.view.startCamera()
                    .catch(e => {
                        console.error("[AddStoryPagePresenter] Kamera gagal dinyalakan:", e);
                        this.view.showFormError(`Kesalahan Kamera: ${e.message}`);
                        this.view.stopCamera();
                    });
            }
        } catch (e) {
            console.error("[AddStoryPagePresenter] Error saat toggle kamera:", e);
            this.view.showFormError(`Kesalahan Kamera: ${e.message}`);
            this.view.stopCamera();
        } finally {
            startCameraButton.disabled = false;
        }
    }

    _onCapturePhotoClick() {
        const { capturePhotoButton } = this.view.domElements;
        if (!capturePhotoButton) return;

        capturePhotoButton.disabled = true;
        this.view.clearAllErrors();

        this.view.capturePhotoFromCamera()
            .then(photoFile => {
                if (photoFile) {
                    this.model.setPhotoFile(photoFile);
                    this.view.displayPhotoPreview(photoFile);
                    this.view.stopCamera();
                    this.view.focusDescription();
                } else {
                    this.view.showElementError(this.view.domElements.photoErrorElement, 'Gagal mengambil foto dari kamera.');
                    capturePhotoButton.disabled = false;
                }
            })
            .catch(e => {
                console.error("[AddStoryPagePresenter] Gagal mengambil foto:", e);
                this.view.showElementError(this.view.domElements.photoErrorElement, `Error pengambilan foto: ${e.message}`);
                capturePhotoButton.disabled = false;
            });
    }

    _onFileInputChange(event) {
        const { photoFileInput, photoErrorElement } = this.view.domElements;
        if (!event.target.files?.[0]) return;

        const file = event.target.files[0];
        this.view.clearAllErrors();

        if (file) {
            const maxSizeMB = 1;
            if (file.size > maxSizeMB * 1024 * 1024) {
                this.view.showElementError(photoErrorElement, `Ukuran file melebihi ${maxSizeMB}MB.`);
                photoFileInput.value = '';
                this.view.clearPhotoSelection();
                this.model.clearPhotoFile();
                return;
            }

            if (!file.type.startsWith('image/')) {
                this.view.showElementError(photoErrorElement, 'File yang dipilih bukan gambar.');
                photoFileInput.value = '';
                this.view.clearPhotoSelection();
                this.model.clearPhotoFile();
                return;
            }

            this.model.setPhotoFile(file);
            this.view.displayPhotoPreview(file);
            this.view.stopCamera();
            this.view.focusDescription();
        }
    }

    _onGetLocationClick() {
        console.info('[Geolocation] Tombol "Gunakan Lokasi Saya" ditekan.');

        if (!navigator.geolocation) {
            console.error('[Geolocation] navigator.geolocation tidak tersedia.');
            showErrorMessage('Browser Anda tidak mendukung Geolocation.');
            this.view.updateLocationFeedback('Geolocation tidak didukung.');
            return;
        }
        console.info('[Geolocation] navigator.geolocation tersedia.');

        if (!this.view.map) {
            console.error('[Geolocation] Map belum siap.');
            showErrorMessage('Peta belum siap. Silakan tunggu sebentar.');
            this.view.updateLocationFeedback('Peta belum siap.');
            return;
        }
        console.info('[Geolocation] Map siap.');

        this.view.updateLocationFeedback('Mencari lokasi...', true);
        this.view.setGetLocationButtonState(true);
        this.view.clearAllErrors();

        const options = {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 0
        };
        console.info('[Geolocation] Memulai getCurrentPosition dengan opsi:', options);

        navigator.geolocation.getCurrentPosition(
            this._onGeolocationSuccess.bind(this),
            this._onGeolocationError.bind(this),
            options
        );
        console.info('[Geolocation] getCurrentPosition dipanggil.');
    }

    _onGeolocationSuccess(position) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        console.info(`[Geolocation] Lokasi didapat: Lat: ${lat}, Lon: ${lon}`);

        const location = { lat, lon };
        this.model.setLocation(location);
        this.view.updateSelectedCoordsText(location);
        this.view.updateLocationFeedback('Lokasi ditemukan!');
        this.view.setGetLocationButtonState(false);

        this.view.updateMapMarker(lat, lon);

        setTimeout(() => {
            if (
                this.view.domElements.locationFeedbackElement &&
                this.view.domElements.locationFeedbackElement.textContent === 'Lokasi ditemukan!'
            ) {
                this.view.updateLocationFeedback('');
            }
        }, 2500);
    }

    _onGeolocationError(error) {
        console.error("[Geolocation] Terjadi error pada geolocation. Kode:", error.code, "Pesan:", error.message);

        let message = 'Tidak dapat mengambil lokasi Anda.';
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = "Anda menolak izin akses lokasi.";
                break;
            case error.POSITION_UNAVAILABLE:
                message = "Informasi lokasi tidak tersedia.";
                break;
            case error.TIMEOUT:
                message = "Waktu habis saat mencoba mengambil lokasi.";
                break;
        }

        this.view.updateLocationFeedback(`Error: ${message}`);
        showErrorMessage(`Gagal mendapatkan lokasi: ${message}`);
        this.view.setGetLocationButtonState(false);
        console.info("[Geolocation] Error selesai ditangani.");
    }

    cleanup() {
        console.info("[AddStoryPagePresenter] Cleanup dijalankan...");
        window.removeEventListener('beforeunload', this.cleanup.bind(this));
        window.removeEventListener('hashchange', this.cleanup.bind(this));
        this.view.cleanup();
    }
}