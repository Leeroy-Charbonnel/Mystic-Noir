import { App } from "obsidian";
import { node } from "utils";

export class DropdownComponent {
    private app: App;
    private container: HTMLElement;
    private select: HTMLSelectElement;
    private customInput: HTMLInputElement;
    private customInputContainer: HTMLElement;
    private options: string[];
    private allowCustom: boolean;
    private value: string;
    private onChangeCb: (value: string) => void;
    private CUSTOM_OPTION = "-- Custom... --";

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

        // Create select element
        this.select = node('select', { class: 'dropdown-select' }) as HTMLSelectElement;
        this.container.appendChild(this.select);

        // Add default option
        const defaultOption = node('option', { text: '--Select--', attributes: { value: '' } });
        this.select.appendChild(defaultOption);

        // Add options
        this.options.forEach(option => {
            const optionEl = node('option', { text: option, attributes: { value: option } });
            this.select.appendChild(optionEl);
        });

        // Add custom option if allowed
        if (this.allowCustom) {
            const customOption = node('option', { 
                text: this.CUSTOM_OPTION, 
                attributes: { value: this.CUSTOM_OPTION } 
            });
            this.select.appendChild(customOption);
        }

        // Create custom input container (hidden by default)
        this.customInputContainer = node('div', { class: 'dropdown-custom-container' });
        this.customInputContainer.style.display = 'none';
        this.container.appendChild(this.customInputContainer);

        // Create custom input (inside container)
        this.customInput = node('input', {
            class: 'dropdown-custom-input',
            attributes: { 
                type: 'text', 
                placeholder: 'Enter custom value...' 
            }
        }) as HTMLInputElement;
        this.customInputContainer.appendChild(this.customInput);

        // Set current value
        if (this.value) {
            if (this.options.includes(this.value)) {
                // Value is a predefined option
                this.select.value = this.value;
            } else if (this.allowCustom) {
                // Value is custom
                this.select.value = this.CUSTOM_OPTION;
                this.customInput.value = this.value;
                this.customInputContainer.style.display = 'block';
            }
        }

        // Custom input event
        this.customInput.addEventListener('input', () => {
            if (this.customInput.value) {
                this.value = this.customInput.value;
                this.onChangeCb(this.value);
            }
        });

        // Select event
        this.select.addEventListener('change', () => {
            if (this.select.value === this.CUSTOM_OPTION) {
                // Show custom input
                this.customInputContainer.style.display = 'block';
                this.customInput.focus();
                
                // If there was a previous custom value, restore it
                if (this.value && !this.options.includes(this.value)) {
                    this.customInput.value = this.value;
                } else {
                    this.customInput.value = '';
                    this.value = '';
                    this.onChangeCb(this.value);
                }
            } else {
                // Hide custom input
                this.customInputContainer.style.display = 'none';
                this.value = this.select.value;
                this.onChangeCb(this.value);
            }
        });

        return this;
    }
}
