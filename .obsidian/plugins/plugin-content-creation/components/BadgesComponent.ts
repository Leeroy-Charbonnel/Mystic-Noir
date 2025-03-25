import { App } from "obsidian";
import { node } from "utils";

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
        this.values = values || []; // Make sure it's an array, default to empty
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

        this.options.forEach(option => {
            const badgeContainer = node('div', { class: 'badge-option-container' });
            
            const checkbox = node('input', {
                attributes: {
                    type: 'checkbox',
                    id: `badge-${option.replace(/\s+/g, '-').toLowerCase()}`
                }
            }) as HTMLInputElement;
            
            const label = node('label', {
                text: option,
                attributes: {
                    for: `badge-${option.replace(/\s+/g, '-').toLowerCase()}`
                }
            });

            // Check if this option is in the values array
            // FIX: Badges should be unchecked by default
            if (this.values && this.values.includes(option)) {
                checkbox.checked = true;
            } else {
                checkbox.checked = false;
            }

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    if (!this.values.includes(option)) {
                        this.values.push(option);
                    }
                } else {
                    this.values = this.values.filter(val => val !== option);
                }
                this.onChangeCb(this.values);
            });

            badgeContainer.appendChild(checkbox);
            badgeContainer.appendChild(label);
            badgesContainer.appendChild(badgeContainer);
        });

        return this;
    }
}