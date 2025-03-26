import { node } from "utils";

export class DateComponent {
    private container: HTMLElement;
    private value: string;
    private onChangeCb: (value: string) => void;

    constructor(containerEl: HTMLElement) {
        this.container=containerEl;
        this.value='';
    }

    setValue(value: string) {
        this.value=value||'';
        return this;
    }

    onChange(cb: (value: string) => void) {
        this.onChangeCb=cb;
        return this;
    }

    render() {
        this.container.empty();
        const dateInput=node('input',{
            class: 'date-input',
            attributes: { type: 'date',value: this.value }
        }) as HTMLInputElement;
        this.container.appendChild(dateInput);

        dateInput.addEventListener('input',() => {
            this.value=dateInput.value;
            this.onChangeCb(this.value);
        });
        return this;
    }
}