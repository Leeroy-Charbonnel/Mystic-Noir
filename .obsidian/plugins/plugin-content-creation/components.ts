import { App } from 'obsidian';
import { node } from './utils';

export class DropdownComponent {
    private app: App;
    private container: HTMLElement;
    private options: string[];
    private allowCustom: boolean;
    private value: string;
    private onChangeCb: (value: string) => void;

    constructor(app: App, container: HTMLElement) {
        this.app = app;
        this.container = container;
        this.options = [];
        this.allowCustom = false;
        this.value = '';
    }

    setOptions(options: string[]) {
        this.options = options;
        return this;
    }

    setAllowCustom(allow: boolean) {
        this.allowCustom = allow;
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

        const selectEl = node('select', { class: 'dropdown-select' });
        
        //Add placeholder option
        const placeholderOption = node('option', { 
            text: 'Select an option', 
            attributes: { value: '' } 
        });
        selectEl.appendChild(placeholderOption);
        
        //Add all options
        this.options.forEach(option => {
            const optionEl = node('option', {
                text: option,
                attributes: { value: option }
            });
            if (this.value === option) {
                optionEl.setAttribute('selected', 'selected');
            }
            selectEl.appendChild(optionEl);
        });

        //Add custom option if allowed
        if (this.allowCustom) {
            const customOption = node('option', {
                text: 'Custom...',
                attributes: { value: 'custom' }
            });
            selectEl.appendChild(customOption);
            
            //Custom input (initially hidden)
            const customInput = node('input', {
                class: 'dropdown-custom-input',
                attributes: {
                    type: 'text',
                    placeholder: 'Enter custom value',
                    style: 'display: none;'
                }
            });
            
            //Show/hide custom input based on selection
            selectEl.addEventListener('change', (e) => {
                const selectedValue = (e.target as HTMLSelectElement).value;
                if (selectedValue === 'custom') {
                    customInput.style.display = 'block';
                    customInput.focus();
                } else {
                    customInput.style.display = 'none';
                    this.value = selectedValue;
                    this.onChangeCb(this.value);
                }
            });
            
            //Update value when custom input changes
            customInput.addEventListener('input', (e) => {
                this.value = (e.target as HTMLInputElement).value;
                this.onChangeCb(this.value);
            });
            
            this.container.appendChild(customInput);
        } else {
            //Simple change handler when custom options are not allowed
            selectEl.addEventListener('change', (e) => {
                this.value = (e.target as HTMLSelectElement).value;
                this.onChangeCb(this.value);
            });
        }
        
        this.container.appendChild(selectEl);
        return this;
    }
}

export class BadgesComponent {
    private app: App;
    private container: HTMLElement;
    private options: string[];
    private values: string[];
    private onChangeCb: (values: string[]) => void;

    constructor(app: App, container: HTMLElement) {
        this.app = app;
        this.container = container;
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
        
        this.options.forEach(option => {
            const badgeContainer = node('div', { class: 'badge-option-container' });
            
            const checkbox = node('input', {
                attributes: {
                    type: 'checkbox',
                    value: option
                }
            }) as HTMLInputElement;
            
            if (this.values.includes(option)) {
                checkbox.checked = true;
            }
            
            checkbox.addEventListener('change', () => {
                if (checkbox.checked && !this.values.includes(option)) {
                    this.values.push(option);
                } else if (!checkbox.checked && this.values.includes(option)) {
                    this.values = this.values.filter(val => val !== option);
                }
                this.onChangeCb(this.values);
            });
            
            const label = node('label', { text: option });
            
            badgeContainer.appendChild(checkbox);
            badgeContainer.appendChild(label);
            badgesContainer.appendChild(badgeContainer);
        });
        
        this.container.appendChild(badgesContainer);
        return this;
    }
}

export class ImageComponent {
    private app: App;
    private container: HTMLElement;
    private value: string;
    private onChangeCb: (value: string) => void;

    constructor(app: App, container: HTMLElement) {
        this.app = app;
        this.container = container;
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
        
        const imageInputContainer = node('div', { class: 'image-input-container' });
        
        //Input field for image path
        const inputField = node('input', {
            class: 'image-path-input',
            attributes: {
                type: 'text',
                placeholder: 'Enter image path',
                value: this.value
            }
        }) as HTMLInputElement;
        
        inputField.addEventListener('input', (e) => {
            this.value = (e.target as HTMLInputElement).value;
            this.onChangeCb(this.value);
            
            //Update preview if available
            if (imagePreview) {
                if (this.value) {
                    imagePreview.style.display = 'block';
                    imagePlaceholder.style.display = 'none';
                    imagePreviewImg.src = this.value;
                } else {
                    imagePreview.style.display = 'none';
                    imagePlaceholder.style.display = 'flex';
                }
            }
        });
        
        //Image preview
        const imagePreviewContainer = node('div', { class: 'image-preview-container' });
        
        //Placeholder when no image is selected
        const imagePlaceholder = node('div', { 
            class: 'image-placeholder',
            text: 'No image selected'
        });
        
        //Actual image preview
        const imagePreview = node('div', { 
            class: 'image-preview',
            attributes: { style: 'display: none;' }
        });
        
        const imagePreviewImg = node('img', {
            class: 'preview-image',
            attributes: { alt: 'Image preview' }
        }) as HTMLImageElement;
        
        //Button to browse files
        const browseButton = node('button', {
            class: 'image-browse-button',
            text: 'Browse'
        });
        
        browseButton.addEventListener('click', async () => {
            //This would need to be implemented to browse and select files from the vault
            console.log('Browse button clicked');
        });
        
        imagePreview.appendChild(imagePreviewImg);
        imagePreviewContainer.appendChild(imagePlaceholder);
        imagePreviewContainer.appendChild(imagePreview);
        
        imageInputContainer.appendChild(inputField);
        imageInputContainer.appendChild(browseButton);
        
        this.container.appendChild(imageInputContainer);
        this.container.appendChild(imagePreviewContainer);
        
        //Initialize preview if value exists
        if (this.value) {
            imagePreview.style.display = 'block';
            imagePlaceholder.style.display = 'none';
            imagePreviewImg.src = this.value;
        }
        
        return this;
    }
}

export class DateComponent {
    private app: App;
    private container: HTMLElement;
    private value: string;
    private placeholder: string;
    private onChangeCb: (value: string) => void;

    constructor(app: App, container: HTMLElement) {
        this.app = app;
        this.container = container;
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
        
        const dateInput = node('input', {
            class: 'date-input',
            attributes: {
                type: 'date',
                placeholder: this.placeholder,
                value: this.value
            }
        }) as HTMLInputElement;
        
        dateInput.addEventListener('input', (e) => {
            this.value = (e.target as HTMLInputElement).value;
            this.onChangeCb(this.value);
        });
        
        this.container.appendChild(dateInput);
        return this;
    }
}