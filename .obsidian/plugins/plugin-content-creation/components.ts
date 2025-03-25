import { App, TFile, TAbstractFile, Modal, TFolder } from 'obsidian';
import { node } from './utils';

export class DropdownComponent {
    private app: App;
    private container: HTMLElement;
    private options: string[];
    private allowCustom: boolean;
    private value: string;
    private onChangeCb: (value: string) => void;

    constructor(app: App, containerEl: HTMLElement) {
        this.app = app;
        this.container = containerEl;
        this.options = [];
        this.allowCustom = false;
        this.value = '';
    }

    setOptions(options: string[]) {
        this.options = options;
        return this;
    }

    setAllowCustom(allowCustom: boolean) {
        this.allowCustom = allowCustom;
        return this;
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

        // Create dropdown select
        const select = node('select', { class: 'dropdown-select' }) as HTMLSelectElement;
        this.container.appendChild(select);

        // Add placeholder option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select an option';
        defaultOption.disabled = true;
        defaultOption.selected = !this.value || !this.options.includes(this.value);
        select.appendChild(defaultOption);

        // Add options
        this.options.forEach(option => {
            const optionEl = document.createElement('option');
            optionEl.value = option;
            optionEl.textContent = option;
            optionEl.selected = option === this.value;
            select.appendChild(optionEl);
        });

        // Custom input if allowed
        let customInput: HTMLInputElement | null = null;
        if (this.allowCustom) {
            // Add "Custom" option
            const customOption = document.createElement('option');
            customOption.value = '__custom__';
            customOption.textContent = 'Custom...';
            customOption.selected = this.value && !this.options.includes(this.value);
            select.appendChild(customOption);

            // Create custom input
            customInput = node('input', {
                class: 'dropdown-custom-input',
                attributes: {
                    type: 'text',
                    value: this.options.includes(this.value) ? '' : this.value
                }
            }) as HTMLInputElement;

            customInput.style.display = this.options.includes(this.value) ? 'none' : 'block';
            this.container.appendChild(customInput);

            // Handle custom input changes
            customInput.addEventListener('input', () => {
                this.value = customInput!.value;
                this.onChangeCb(this.value);
            });
        }

        // Handle select changes
        select.addEventListener('change', () => {
            if (select.value === '__custom__' && this.allowCustom) {
                customInput!.style.display = 'block';
                customInput!.focus();
                this.value = customInput!.value;
            } else {
                if (customInput) customInput.style.display = 'none';
                this.value = select.value;
            }
            this.onChangeCb(this.value);
        });

        return this;
    }
}

export class BadgesComponent {
    private app: App;
    private container: HTMLElement;
    private options: string[];
    private values: string[];
    private onChangeCb: (values: string[]) => void;

    constructor(app: App, containerEl: HTMLElement) {
        this.app = app;
        this.container = containerEl;
        this.options = [];
        this.values = [];
    }

    setOptions(options: string[]) {
        this.options = options;
        return this;
    }

    setValues(values: string[]) {
        this.values = values || [];
        return this;
    }

    onChange(cb: (values: string[]) => void) {
        this.onChangeCb = cb;
        return this;
    }

    render() {
        this.container.empty();
        const badgesContainer = node('div', { class: 'badges-container' });
        this.container.appendChild(badgesContainer);

        // Create a badge option for each option
        this.options.forEach(option => {
            const badgeContainer = node('div', { class: 'badge-option-container' });
            const checkbox = node('input', {
                attributes: {
                    type: 'checkbox',
                    id: `badge-${option.replace(/\s+/g, '-')}`,
                    checked: this.values.includes(option) ? 'checked' : ''
                }
            }) as HTMLInputElement;

            const label = node('label', {
                text: option,
                attributes: {
                    for: `badge-${option.replace(/\s+/g, '-')}`
                }
            });

            badgeContainer.appendChild(checkbox);
            badgeContainer.appendChild(label);
            badgesContainer.appendChild(badgeContainer);

            // Handle checkbox changes
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    if (!this.values.includes(option)) {
                        this.values.push(option);
                    }
                } else {
                    const index = this.values.indexOf(option);
                    if (index !== -1) {
                        this.values.splice(index, 1);
                    }
                }
                this.onChangeCb(this.values);
            });
        });

        return this;
    }
}

// FileSelectorModal class for image browsing
class FileSelectorModal extends Modal {
    selectedFile: string | null = null;
    onFileSelect: (path: string) => void;
    
    constructor(app: App, onFileSelect: (path: string) => void) {
        super(app);
        this.onFileSelect = onFileSelect;
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: 'Select an Image' });
        
        const fileList = contentEl.createEl('div', { cls: 'file-selector-list' });
        
        // Get all images and add them to the list
        let imageFiles: TFile[] = [];
        this.app.vault.getFiles().forEach(file => {
            if (file.extension && ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(file.extension.toLowerCase())) {
                imageFiles.push(file);
            }
        });
        
        // Sort files by path
        imageFiles.sort((a, b) => a.path.localeCompare(b.path));
        
        // Get folder structure
        const folderStructure: Record<string, TFile[]> = {};
        
        imageFiles.forEach(file => {
            const folderPath = file.parent ? file.parent.path : '/';
            if (!folderStructure[folderPath]) {
                folderStructure[folderPath] = [];
            }
            folderStructure[folderPath].push(file);
        });
        
        // Create folder sections
        Object.keys(folderStructure).sort().forEach(folderPath => {
            const folderEl = fileList.createEl('details', { cls: 'file-selector-folder' });
            folderEl.createEl('summary', { text: folderPath || 'Root' });
            
            const filesEl = folderEl.createEl('div', { cls: 'file-selector-files' });
            
            folderStructure[folderPath].forEach(file => {
                const fileItem = filesEl.createEl('div', { 
                    cls: 'file-selector-item',
                    text: file.name
                });
                
                fileItem.addEventListener('click', () => {
                    this.selectedFile = file.path;
                    this.onFileSelect(this.selectedFile);
                    this.close();
                });
            });
        });
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export class ImageComponent {
    private app: App;
    private container: HTMLElement;
    private value: string;
    private onChangeCb: (value: string) => void;

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

        // Create path input
        const pathInput = node('input', {
            class: 'image-path-input',
            attributes: {
                type: 'text',
                value: this.value
            }
        }) as HTMLInputElement;
        inputContainer.appendChild(pathInput);

        // Create browse button
        const browseButton = node('button', {
            class: 'image-browse-button',
            text: 'Browse'
        });
        inputContainer.appendChild(browseButton);

        // Create preview container
        const previewContainer = node('div', { class: 'image-preview-container' });
        this.container.appendChild(previewContainer);

        this.updatePreview(previewContainer, this.value);

        // Handle input changes
        pathInput.addEventListener('input', () => {
            this.value = pathInput.value;
            this.updatePreview(previewContainer, this.value);
            this.onChangeCb(this.value);
        });

        // Handle browse button click - fixed functionality
        browseButton.addEventListener('click', () => {
            // Open file selector modal
            const fileSelector = new FileSelectorModal(this.app, (selectedPath) => {
                this.value = selectedPath;
                pathInput.value = selectedPath;
                this.updatePreview(previewContainer, this.value);
                this.onChangeCb(this.value);
            });
            fileSelector.open();
        });

        return this;
    }

    private updatePreview(container: HTMLElement, imagePath: string) {
        container.empty();

        if (!imagePath) {
            container.appendChild(node('div', {
                class: 'image-placeholder',
                text: 'No image selected'
            }));
            return;
        }

        // Check if file exists
        const file = this.app.vault.getAbstractFileByPath(imagePath);
        if (!file || !(file instanceof TFile)) {
            container.appendChild(node('div', {
                class: 'image-placeholder',
                text: 'Image not found'
            }));
            return;
        }

        // Create preview container
        const previewElement = node('div', { class: 'image-preview' });
        container.appendChild(previewElement);

        // Create image element
        const imgElement = node('img', {
            class: 'preview-image',
            attributes: {
                src: this.app.vault.getResourcePath(file as TFile),
                alt: 'Image preview'
            }
        });
        previewElement.appendChild(imgElement);
    }
}

export class DateComponent {
    private app: App;
    private container: HTMLElement;
    private value: string;
    private placeholder: string;
    private onChangeCb: (value: string) => void;

    constructor(app: App, containerEl: HTMLElement) {
        this.app = app;
        this.container = containerEl;
        this.value = '';
        this.placeholder = '';
    }

    setValue(value: string) {
        this.value = value;
        return this;
    }

    setPlaceholder(placeholder: string) {
        this.placeholder = placeholder;
        return this;
    }

    onChange(cb: (value: string) => void) {
        this.onChangeCb = cb;
        return this;
    }

    render() {
        this.container.empty();

        // Create date input
        const dateInput = node('input', {
            class: 'date-input',
            attributes: {
                type: 'date',
                value: this.value
            }
        }) as HTMLInputElement;
        
        this.container.appendChild(dateInput);

        // Handle input changes
        dateInput.addEventListener('input', () => {
            this.value = dateInput.value;
            this.onChangeCb(this.value);
        });

        return this;
    }
}