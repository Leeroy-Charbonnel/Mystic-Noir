import { App } from "obsidian";
import { node } from "utils";

export class DateComponent {
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

        // Create date input
        const dateInput = node('input', {
            class: 'date-input',
            attributes: {
                type: 'date',
                value: this.value
            }
        }) as HTMLInputElement;
        this.container.appendChild(dateInput);

        // Set input event
        dateInput.addEventListener('input', () => {
            this.value = dateInput.value;
            this.onChangeCb(this.value);
        });

        return this;
    }
}