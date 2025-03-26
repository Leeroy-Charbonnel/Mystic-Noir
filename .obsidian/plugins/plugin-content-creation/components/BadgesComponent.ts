import { node } from "utils";

export class BadgesComponent {
    private container: HTMLElement;
    private options: string[];
    private values: string[];
    private onChangeCb: (values: string[]) => void;

    constructor(containerEl: HTMLElement) {
        this.container=containerEl;
        this.options=[];
        this.values=[];
    }

    setOptions(options: string[]) {
        this.options=options;
        return this;
    }

    setValues(values: string[]) {
        this.values=values||[];
        return this;
    }

    onChange(cb: (values: string[]) => void) {
        this.onChangeCb=cb;
        return this;
    }

    render() {
        this.container.empty();

        const badgesContainer=node('div',{ class: 'badges-container' });
        this.container.appendChild(badgesContainer);

        this.options.forEach(option => {
            const label=node('label',{
                text: option,
                class: 'badge-option',
                attributes: {
                    for: `badge-${option.replace(/\s+/g,'-').toLowerCase()}`
                }
            });
            label.toggleClass('active',this.values.includes(option));

            label.addEventListener('click',() => {
                const active=this.values.includes(option)
                if(active) this.values=this.values.filter(val => val!==option);
                else this.values.push(option);

                label.toggleClass('active',this.values.includes(option));
                this.onChangeCb(this.values);
            });

            badgesContainer.appendChild(label);
        });

        return this;
    }
}