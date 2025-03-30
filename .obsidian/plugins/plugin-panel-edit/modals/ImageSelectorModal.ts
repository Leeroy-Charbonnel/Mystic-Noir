
import { App, Modal, TFile, setIcon } from 'obsidian';
import { node, getImageFiles } from 'utils';

export class ImageSelectorModal extends Modal {
    private resolvePromise: (value: string | null) => void;
    private images: TFile[] = [];
    private filteredImages: TFile[] = [];
    private galleryContainer: HTMLElement;
    private searchInput: HTMLInputElement;
    private columnCount: number = 4;

    constructor(app: App) {
        super(app);
    }

    async onOpen() {
        //Load all images first
        await this.loadImages();
        
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('comic-image-selector-modal');
        contentEl.style.setProperty('--gallery-columns', this.columnCount.toString());

        //Title
        contentEl.appendChild(node('h2', { 
            text: 'Select Image',
            class: 'comic-image-selector-title'
        }));

        //Search input
        this.searchInput = node('input', { 
            class: 'comic-image-search',
            attributes: { 
                type: 'text',
                placeholder: 'Search images...'
            }
        }) as HTMLInputElement;
        
        this.searchInput.addEventListener('input', () => {
            this.filterImages(this.searchInput.value);
        });
        
        contentEl.appendChild(this.searchInput);

        //Image gallery container
        const galleryScroller = node('div', { class: 'comic-image-gallery-scroller' });
        this.galleryContainer = node('div', { class: 'comic-image-gallery' });
        
        //Render all images
        this.renderGallery();
        
        galleryScroller.appendChild(this.galleryContainer);
        contentEl.appendChild(galleryScroller);

        //Buttons container
        const buttonsContainer = node('div', { class: 'comic-image-selector-buttons' });
        
        //Cancel button
        const cancelButton = node('button', {
            class: 'comic-image-selector-button',
            text: 'Cancel'
        });
        
        cancelButton.addEventListener('click', () => {
            this.resolvePromise(null);
            this.close();
        });
        
        //Import button
        const importButton = node('button', {
            class: 'comic-image-selector-button comic-image-selector-button-import',
            text: 'Import New Image'
        });
        
        const fileInput = node('input', {
            attributes: {
                type: 'file',
                accept: 'image/*',
                style: 'display: none;'
            }
        }) as HTMLInputElement;
        
        importButton.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', async () => {
            if (fileInput.files && fileInput.files.length > 0) {
                const file = fileInput.files[0];
                //Convert the file to an arrayBuffer
                const buffer = await file.arrayBuffer();
                
                //Check if _Images folder exists, create if not
                const imagesFolder = this.app.vault.getAbstractFileByPath('_Images');
                if (!imagesFolder) {
                    await this.app.vault.createFolder('_Images');
                }
                
                //Create the file in the vault
                try {
                    const savedFile = await this.app.vault.createBinary(`_Images/${file.name}`, buffer);
                    
                    //Resolve with the file path
                    this.resolvePromise(savedFile.path);
                    this.close();
                } catch (error) {
                    console.error('Error importing image:', error);
                    const errorEl = node('div', {
                        class: 'comic-image-selector-error',
                        text: `Error importing image: ${error.message}`
                    });
                    
                    contentEl.appendChild(errorEl);
                    
                    //Remove error after 3 seconds
                    setTimeout(() => {
                        errorEl.remove();
                    }, 3000);
                }
            }
        });
        
        //Add buttons to container
        buttonsContainer.appendChild(cancelButton);
        buttonsContainer.appendChild(importButton);
        contentEl.appendChild(buttonsContainer);
        
        //Set focus on search input
        this.searchInput.focus();
        
        //Setup wheel events for column count
        galleryScroller.addEventListener('wheel', (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
                if (e.deltaY < 0 && this.columnCount < 8) {
                    this.columnCount++;
                } else if (e.deltaY > 0 && this.columnCount > 1) {
                    this.columnCount--;
                }
                
                contentEl.style.setProperty('--gallery-columns', this.columnCount.toString());
            }
        });
    }
    
    async loadImages() {
        this.images = getImageFiles(this.app);
        this.filteredImages = [...this.images];
    }
    
    filterImages(searchTerm: string) {
        if (!searchTerm.trim()) {
            this.filteredImages = [...this.images];
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredImages = this.images.filter(file => 
                file.name.toLowerCase().includes(term) || 
                file.path.toLowerCase().includes(term)
            );
        }
        
        this.renderGallery();
    }
    
    renderGallery() {
        this.galleryContainer.empty();
        
        if (this.filteredImages.length === 0) {
            this.galleryContainer.appendChild(node('div', {
                class: 'comic-image-empty',
                text: this.images.length === 0 ? 'No images found in vault.' : 'No images match your search.'
            }));
            return;
        }
        
        //Create and add image items
        this.filteredImages.forEach(file => {
            const imageCard = this.createImageCard(file);
            this.galleryContainer.appendChild(imageCard);
        });
    }
    
    createImageCard(file: TFile): HTMLElement {
        const card = node('div', { class: 'comic-image-card' });
        
        //Create image container
        const imageContainer = node('div', { class: 'comic-image-container' });
        
        //Create image element
        const img = node('img', {
            class: 'comic-image-preview',
            attributes: {
                src: this.app.vault.getResourcePath(file),
                loading: 'lazy',
                alt: file.name
            }
        });
        
        //Handle image error
        img.addEventListener('error', () => {
            imageContainer.innerHTML = '';
            imageContainer.appendChild(node('div', {
                class: 'comic-image-error',
                text: 'Failed to load image'
            }));
        });
        
        //Create file name element
        const fileName = node('div', {
            class: 'comic-image-name',
            text: file.name
        });
        
        //Add click event to select image
        card.addEventListener('click', () => {
            this.resolvePromise(file.path);
            this.close();
        });
        
        //Add elements to card
        imageContainer.appendChild(img);
        card.appendChild(imageContainer);
        card.appendChild(fileName);
        
        return card;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
    
    selectImage(): Promise<string | null> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.open();
        });
    }
}