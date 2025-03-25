import { App, TFile, normalizePath, Notice } from 'obsidian';
import { node } from 'utils';

export class ImageComponent {
    private app: App;
    private container: HTMLElement;
    private value: string;
    private onChangeCb: (value: string) => void;
    private IMAGES_FOLDER = "_Images"; // Store in root images folder for simplicity

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

        // Create input container
        const inputContainer = node('div', { class: 'image-input-container' });
        this.container.appendChild(inputContainer);

        // Create hidden path input (to store the value)
        const pathInput = node('input', {
            class: 'image-path-input hidden',
            attributes: {
                type: 'text',
                value: this.value,
                readonly: 'true'
            }
        }) as HTMLInputElement;
        inputContainer.appendChild(pathInput);

        // File input container for styling
        const fileInputContainer = node('div', { class: 'file-input-container' });
        inputContainer.appendChild(fileInputContainer);
        
        // Create a label for file input styling
        const fileLabel = node('label', { 
            class: 'file-input-label',
            text: 'Choose Image'
        });
        fileInputContainer.appendChild(fileLabel);
        
        // Create the actual file input (hidden for styling)
        const fileInput = node('input', {
            attributes: {
                type: 'file',
                accept: '.jpg,.jpeg,.png,.webp,.gif',
                class: 'file-input'
            }
        }) as HTMLInputElement;
        fileLabel.appendChild(fileInput);
        
        // When file is changed, handle it
        fileInput.addEventListener('change', async (event) => {
            if (fileInput.files && fileInput.files.length > 0) {
                const file = fileInput.files[0];
                
                // Ensure the images folder exists
                await this.ensureImagesFolder();
                
                // Save the file to the images folder
                const newPath = await this.saveFileToImagesFolder(file);
                
                // Update the component
                this.value = newPath;
                pathInput.value = newPath;
                this.updatePreview(previewContainer, this.value);
                this.onChangeCb(this.value);
            }
        });

        // Create preview container
        const previewContainer = node('div', { class: 'image-preview-container' });
        this.container.appendChild(previewContainer);

        // Create placeholder or show image
        this.updatePreview(previewContainer, this.value);

        return this;
    }
    
    // Ensure the images folder exists
    private async ensureImagesFolder(): Promise<void> {
        try {
            // Check if folder exists using adapter
            const exists = await this.app.vault.adapter.exists(this.IMAGES_FOLDER);
            
            if (!exists) {
                await this.app.vault.createFolder(this.IMAGES_FOLDER);
                console.log(`Created images folder: ${this.IMAGES_FOLDER}`);
            }
        } catch (error) {
            console.error("Failed to create images folder:", error);
            new Notice("Failed to create images folder: " + error.message);
        }
    }
    
    // Save uploaded file to images folder
    private async saveFileToImagesFolder(file: File): Promise<string> {
        try {
            // Generate a safe filename with timestamp to prevent conflicts
            const timestamp = Date.now();
            const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            
            // Create the destination path
            const destPath = `${this.IMAGES_FOLDER}/${timestamp}-${safeFilename}`;
            
            // Read the file as binary data
            const arrayBuffer = await file.arrayBuffer();
            const buffer = new Uint8Array(arrayBuffer);
            
            // Create the file in the vault with proper path normalization
            await this.app.vault.createBinary(normalizePath(destPath), buffer);
            
            new Notice(`Image saved successfully`);
            return destPath;
            
        } catch (error) {
            console.error("Failed to save image:", error);
            new Notice("Failed to save image: " + error.message);
            return "";
        }
    }

    private updatePreview(container: HTMLElement, imagePath: string) {
        container.empty();

        if (!imagePath) {
            const placeholder = node('div', {
                class: 'image-placeholder',
                text: 'No image selected'
            });
            container.appendChild(placeholder);
            return;
        }

        const previewDiv = node('div', { class: 'image-preview' });
        
        // For image preview - try different strategies to get a valid URL
        let imgSrc = '';
        
        try {
            // First try: Get the file directly 
            const file = this.app.vault.getAbstractFileByPath(imagePath);
            if (file instanceof TFile) {
                // Use Obsidian's API to get a resource URL
                imgSrc = this.app.vault.getResourcePath(file);
            } else {
                // Second try: Use adapter path
                imgSrc = this.app.vault.adapter.getResourcePath(imagePath);
            }
        } catch (e) {
            console.warn("Could not get resource path, using direct path:", e);
            
            // Final fallback: just use the path directly
            imgSrc = imagePath;
        }
        
        const img = node('img', {
            class: 'preview-image',
            attributes: {
                src: imgSrc,
                alt: 'Image preview'
            }
        });
        
        // Add error handling for image
        img.addEventListener('error', () => {
            console.error("Failed to load image:", imgSrc);
            previewDiv.empty();
            previewDiv.appendChild(node('div', {
                class: 'image-error',
                text: `Error loading image: ${imagePath}`
            }));
        });
        
        previewDiv.appendChild(img);
        container.appendChild(previewDiv);
    }
}