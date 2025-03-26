import { App } from 'obsidian';
import { node } from 'utils';
import { RichTextEditor } from 'RichTextEditor';

export class MultiValueField {
    private app: App;
    private name: string;
    private pages: string[];
    private inputType: string;
    private container: HTMLElement;
    private labelContainer: HTMLElement;
    private values: string[];
    private inputsContainer: HTMLElement;
    private onChangeCb: (values: string[]) => void;

    constructor(app: App,containerEl: HTMLElement) {
        this.app=app;
        this.container=containerEl;
        this.name="";
        this.values=[];
        this.pages=this.getAllPages();

        this.labelContainer=node('div',{ class: 'multi-value-label' });
        const addButton=node('button',{ class: 'multi-value-add-button',children: [node("span",{ text: '+' })] });
        this.inputsContainer=node('div',{ class: 'multi-value-inputs' });

        this.container.appendChild(this.labelContainer);
        this.labelContainer.appendChild(node('span',{ text: this.name }));
        this.labelContainer.appendChild(addButton);
        this.container.appendChild(this.inputsContainer);

        addButton.addEventListener('click',() => this.addValue());
    }

    getAllPages(): string[] {
        return this.app.vault.getMarkdownFiles().map(file => file.basename);
    }

    setName(value: string) {
        this.name=value;
        this.labelContainer.querySelector("span")!.innerText=this.name;
        return this;
    }

    setType(value: string) {
        this.inputType=value;
        return this;
    }

    setValues(values: string[]) {
        this.values=values||[''];
        return this;
    }

    onChange(cb: (value: string[]) => void) {
        this.onChangeCb=cb;
        return this;
    }

    render() {
        this.inputsContainer.empty();

        this.values.forEach((value,index) => {
            const rowContainer=node('div',{ class: `multi-value-input-row` });

            const fieldEl=new RichTextEditor(this.app,this.pages);
            fieldEl.createRichTextEditor(rowContainer,value,this.inputType);

            fieldEl.onChange((newValue) => {
                this.values[index]=newValue;
                this.onChangeCb(this.values);
            });

            this.inputsContainer.appendChild(rowContainer);

            //Add removal button for all but the first item
            const removeButton=node('button',{ class: 'multi-value-remove-button',children: [node("span",{ text: 'x' })] });
            rowContainer.appendChild(removeButton);
            removeButton.addEventListener('click',() => {
                this.values.splice(index,1);
                this.onChangeCb(this.values);
                this.render();
            });
        });
        return this;
    }

    private addValue() {
        this.values.push('');
        this.onChangeCb(this.values);
        this.render();
    }
}