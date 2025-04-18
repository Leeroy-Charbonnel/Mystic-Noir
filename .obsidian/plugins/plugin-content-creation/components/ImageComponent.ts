import { App, TFile, normalizePath, Notice, Modal, FuzzySuggestModal, setIcon } from 'obsidian';
import { node } from 'utils';

const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const IMAGES_FOLDER = "_Images";

class ConfirmationModal extends Modal {
    private result: boolean = false;
    private resolvePromise: (value: boolean) => void;

    constructor(app: App, private message: string) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;

        const text = node('p', { text: this.message });
        const buttonContainer = node('div', { class: 'modal-button-container' });

        const cancelBtn = node('button', { text: 'Cancel', class: 'mod-warning' })
        cancelBtn.addEventListener('click', () => {
            this.result = false;
            this.close();
        });

        const submitBtn = node('button', { text: 'Overwrite', class: 'mod-cta' })
        submitBtn.addEventListener('click', () => {
            this.result = true;
            this.close();
        });


        buttonContainer.appendChild(submitBtn);
        buttonContainer.appendChild(cancelBtn);

        contentEl.appendChild(text);
        contentEl.appendChild(buttonContainer);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        this.resolvePromise(this.result);
    }

    async openAndAwait(): Promise<boolean> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.open();
        });
    }
}

class ImageGalleryModal extends Modal {
    private resolvePromise: (value: string) => void;
    private images: TFile[] = [];
    private filteredImages: TFile[] = [];
    private galleryContainer: HTMLElement;
    private fileInput: HTMLInputElement;
    private searchInput: HTMLInputElement;
    private columnCount: number = 4;

    constructor(app: App, private imagesFolder: string) {
        super(app);
    }

    private async loadImages() {
        await ensureImagesFolder();
        const files = this.app.vault.getFiles().filter(file => {
            return file.path.startsWith(this.imagesFolder) && allowedExtensions.includes(file.extension.toLowerCase());
        });
        this.images = files;
        this.filteredImages = [...this.images];
    }

    async onOpen() {
        await this.loadImages();
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('image-gallery-modal');
        contentEl.style.setProperty('--gallery-columns', this.columnCount.toString());

        const titleEl = node('h3', { text: 'Select Image', class: 'gallery-title' });

        this.searchInput = node('input', { class: 'gallery-search', attributes: { type: 'text', placeholder: 'Search images...' } }) as HTMLInputElement;
        this.searchInput.addEventListener('input', () => { this.filterImages(this.searchInput.value); });

        const imagesContainer = node('div', { class: 'gallery-container' });
        const importButton = node('button', { text: 'Import image', class: 'mod-cta' });
        this.galleryContainer = node('div', { class: 'gallery-grid' });
        importButton.addEventListener('click', () => this.fileInput.click());

        this.fileInput = node('input', { attributes: { type: 'file', accept: allowedExtensions.map(x => `.${x}`).join(','), class: 'file-input' } }) as HTMLInputElement;

        imagesContainer.addEventListener('wheel', (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
                if (e.deltaY > 0)
                    this.columnCount = Math.min(this.columnCount + 1, 8);
                else
                    this.columnCount = Math.max(this.columnCount - 1, 1);
                contentEl.style.setProperty('--gallery-columns', this.columnCount.toString());
            }
        });

        this.renderImageGrid();

        imagesContainer.appendChild(this.galleryContainer);

        contentEl.appendChild(titleEl);
        contentEl.appendChild(this.searchInput);
        contentEl.appendChild(imagesContainer);
        contentEl.appendChild(this.fileInput);
        contentEl.appendChild(importButton);


        this.fileInput.addEventListener('change', async (event) => {
            if (this.fileInput.files && this.fileInput.files.length > 0) {
                const file = this.fileInput.files[0];
                await ensureImagesFolder();
                const newPath = await this.saveFileToImagesFolder(file);

                if (newPath) {
                    this.resolvePromise(newPath);
                    this.close();
                }
            }
        });
    }

    private filterImages(searchTerm: string) {
        if (!searchTerm) {
            this.filteredImages = [...this.images];
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredImages = this.images.filter(img => img.name.toLowerCase().includes(term));
        }
        this.renderImageGrid();
    }

    private renderImageGrid() {
        this.galleryContainer.empty();

        if (this.filteredImages.length === 0) {
            this.galleryContainer.appendChild(node('div', {
                class: 'gallery-empty',
                text: this.images.length > 0 ? 'No images match your search.' : 'No images found. Import an image using the button below.'
            }));
            return;
        }

        for (const image of this.filteredImages) {
            const imgPath = this.app.vault.getResourcePath(image);

            const imagesCard = node('div', { class: 'gallery-card' });
            const imgContainer = node('div', { class: 'gallery-image-container' });
            const img = node('img', { attributes: { src: imgPath, alt: image.name } });
            const imgName = node('div', { class: 'gallery-image-name', text: image.name });

            imgContainer.appendChild(img);
            imagesCard.appendChild(imgContainer);
            imagesCard.appendChild(imgName);


            imagesCard.setAttr('title', image.name);
            imagesCard.addEventListener('click', () => {
                this.resolvePromise(image.path);
                this.close();
            });

            this.galleryContainer.appendChild(imagesCard);
        }
    }

    private async saveFileToImagesFolder(file: File): Promise<string> {
        try {
            const destPath = `${IMAGES_FOLDER}/${file.name}`;
            const exists = await this.app.vault.adapter.exists(destPath);

            if (exists) {
                const modal = new ConfirmationModal(this.app, `An image with this name already exists. Would you like to overwrite it?`);
                const overwrite = await modal.openAndAwait();
                if (!overwrite) return "";
                else await this.app.vault.adapter.remove(destPath);
            }

            const arrayBuffer = await file.arrayBuffer();
            const buffer = new Uint8Array(arrayBuffer);
            await this.app.vault.createBinary(normalizePath(destPath), buffer);

            await this.loadImages();
            this.renderImageGrid();

            return destPath;
        } catch (error) {
            new Notice("Failed to save image: " + error.message);
            return "";
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    async openAndAwait(): Promise<string> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.open();
        });
    }
}

export class ImageComponent {
    private app: App;
    private container: HTMLElement;
    private value: string;
    private onChangeCb: (value: string) => void;
    private editButton: HTMLElement;
    private removeButton: HTMLElement;
    private previewContainer: HTMLElement;

    constructor(app: App, containerEl: HTMLElement) {
        this.app = app;
        this.container = containerEl;
        this.value = '';
    }

    setValue(value: string) {
        this.value = value;
        return this;
    }

    onChange(cb: (value: string) => void) {
        this.onChangeCb = cb;
        return this;
    }

    render() {
        this.container.empty();

        this.previewContainer = node('div', { class: 'image-preview-container' });
        this.container.appendChild(this.previewContainer);

        const buttonsOverlay = node('div', { class: 'image-buttons-overlay' });

        this.editButton = node('button', {
            class: 'image-edit-button',
            attributes: { 'aria-label': 'Edit Image' }
        });
        setIcon(this.editButton, 'pencil');

        this.removeButton = node('button', {
            class: 'image-remove-button',
            attributes: { 'aria-label': 'Remove Image' }
        });
        setIcon(this.removeButton, 'x');

        buttonsOverlay.appendChild(this.editButton);
        buttonsOverlay.appendChild(this.removeButton);
        this.previewContainer.appendChild(buttonsOverlay);

        this.updatePreview();

        this.editButton.addEventListener('click', async () => {
            const galleryModal = new ImageGalleryModal(this.app, IMAGES_FOLDER);
            const selectedPath = await galleryModal.openAndAwait();

            if (selectedPath) {
                this.value = selectedPath;
                this.updatePreview();
                this.onChangeCb(this.value);
            }
        });

        this.removeButton.addEventListener('click', () => {
            this.value = '';
            this.updatePreview();
            this.onChangeCb(this.value);
        });

        this.previewContainer.addEventListener('mouseenter', () => {
            buttonsOverlay.classList.add('visible');
        });

        this.previewContainer.addEventListener('mouseleave', () => {
            buttonsOverlay.classList.remove('visible');
        });

        return this;
    }

    private updatePreview() {
        const previewContent = this.previewContainer.querySelector('.image-preview, .image-placeholder');
        if (previewContent) {
            previewContent.remove();
        }

        if (!this.value) {
            this.previewContainer.appendChild(node('div', {
                class: 'image-placeholder',
                text: 'No image selected'
            }));
            this.removeButton.style.display = 'none';
        } else {
            const previewDiv = node('div', { class: 'image-preview' });

            let imgSrc = '';
            const file = this.app.vault.getAbstractFileByPath(this.value);
            if (file instanceof TFile) imgSrc = this.app.vault.getResourcePath(file);

            const img = node('img', {
                class: 'preview-image',
                attributes: {
                    src: imgSrc,
                    alt: 'Image preview'
                }
            });

            img.addEventListener('error', () => {
                console.error("Failed to load image:", imgSrc);
                previewDiv.empty();
                previewDiv.appendChild(node('div', {
                    class: 'image-error',
                    text: `Error loading image: ${this.value}`
                }));
            });

            previewDiv.appendChild(img);
            this.previewContainer.appendChild(previewDiv);
            this.removeButton.style.display = 'flex';
        }
    }
}

async function ensureImagesFolder(): Promise<void> {
    try {
        const exists = await this.app.vault.adapter.exists(IMAGES_FOLDER);
        if (!exists) await this.app.vault.createFolder(IMAGES_FOLDER);
    } catch (error) {
        new Notice("Failed to create images folder: " + error.message);
    }
}

export function addIcon(element: HTMLElement, iconName: string): void {
    element.innerHTML = '';
    setIcon(element, iconName);
}