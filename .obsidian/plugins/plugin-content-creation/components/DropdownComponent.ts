import { node } from "utils";

export class DropdownComponent {
    private container: HTMLElement;
    private select: HTMLSelectElement;
    private customInput: HTMLInputElement|null;
    private customInputContainer: HTMLElement|null;
    private options: string[];
    private allowCustom: boolean;
    private value: string;
    private onChangeCb: (value: string) => void;
    CUSTOM_OPTION='-Custom-';

    constructor(containerEl: HTMLElement) {
        this.container=containerEl;
        this.options=[];
        this.allowCustom=false;
        this.value='';
    }

    setOptions(options: string[]) {
        this.options=options||[];
        return this;
    }

    setAllowCustom(allow: boolean) {
        this.allowCustom=allow;
        return this;
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

        this.select=node('select',{ class: 'dropdown-select' }) as HTMLSelectElement;
        this.container.appendChild(this.select);

        //Default
        const defaultOption=node('option',{ text: '-Select-',attributes: { value: '' } });
        this.select.appendChild(defaultOption);

        //Add options
        this.options.forEach(option => {
            const optionEl=node('option',{ text: option,attributes: { value: option } });
            this.select.appendChild(optionEl);
        });

        //Custom
        if(this.allowCustom) {
            const customOption=node('option',{ text: this.CUSTOM_OPTION,attributes: { value: this.CUSTOM_OPTION } });
            this.select.appendChild(customOption);

            //Custom input container
            this.customInputContainer=node('div',{ class: 'dropdown-custom-container' });
            this.customInputContainer.style.display='none';
            this.container.appendChild(this.customInputContainer);

            //Custom input
            this.customInput=node('input',{
                class: 'dropdown-custom-input',
                attributes: {
                    type: 'text',
                    placeholder: 'Enter custom value...'
                }
            }) as HTMLInputElement;

            this.customInput.addEventListener('input',() => {
                if(this.customInput!.value) {
                    this.value=this.customInput!.value;
                    this.onChangeCb(this.value);
                }
            });

            this.customInputContainer.appendChild(this.customInput);
        }

        //Set current value
        if(this.value) {
            if(this.options.includes(this.value)) {
                //Predefined option
                this.select.value=this.value;
            } else if(this.allowCustom) {
                //Custom
                this.select.value=this.CUSTOM_OPTION;
                this.customInput!.value=this.value;
                this.customInputContainer!.style.display='block';
            }
        }

        this.select.addEventListener('change',() => {
            //No custom
            if(!this.allowCustom) {
                this.value=this.select.value;
                this.onChangeCb(this.value);
            } else {
                //Custom
                if(this.select.value===this.CUSTOM_OPTION) {
                    this.customInputContainer!.style.display='block';
                    this.customInput!.focus();
                    this.customInput!.value='';
                    this.value='';
                    this.onChangeCb(this.value);
                }
                else {
                    this.customInputContainer!.style.display='none';
                }
            }


        });

        return this;
    }
}
