import { App,Modal,Setting,TextAreaComponent,ButtonComponent,ToggleComponent,Notice,PopoverSuggest,TextComponent } from 'obsidian';
import ContentCreatorPlugin from './main';
import * as templates from './template';
import { node,formatDisplayName,isObject } from './utils';

function getAllPages(app: App): string[] {
    return app.vault.getMarkdownFiles().map(x => x.basename);
}


class SuggestComponent {
    popover: any;
    parent: any;
    suggetsList: string[];
    searchCriteria: string;
    bracketsIndices: number[];
    renderCb: (value: any,element: HTMLElement) => void;
    selectCb: (value: any) => void;


    constructor(app: App,parent: any) {
        this.parent=parent;
        this.popover=new PopoverSuggest(app);
        this.popover.selectSuggestion=this.selectSuggestion.bind(this);
        this.popover.renderSuggestion=this.renderSuggestion.bind(this);
        this.parent.addEventListener("input",(e: Event) => this.onInputChange(e));
        this.parent.addEventListener("focus",(e: Event) => this.onInputChange(e));
        this.parent.addEventListener("blur",() => this.popover.close());
        this.popover.suggestEl.on("mousedown",".suggestion-item",(e: MouseEvent) => e.preventDefault());
    }

    onInputChange(e: any) {
        if(e==undefined) return

        let value=this.getValue();
        const pos=e.target.selectionEnd
        const closeChars=new Map([
            ['{','}'],
            ['[',']'],
            ['(',')']
        ]);
        const closeChar=closeChars.get(e.data);
        if(closeChar) {
            this.setValue([value.slice(0,pos),closeChar,value.slice(pos)].join(''))
            e.target.setSelectionRange(pos,pos)
        }

        value=this.getValue();
        this.bracketsIndices=this.isBetweenBrackets(value,pos);
        if(this.bracketsIndices.length>0) {
            this.searchCriteria=value.slice(this.bracketsIndices[0],this.bracketsIndices[1]).toLocaleLowerCase().trim();
            const suggests=this.searchCriteria==""? this.suggetsList:this.suggetsList.filter(e => e.toLowerCase().trim().includes(this.searchCriteria))

            if(suggests.length>0) {
                this.popover.suggestions.setSuggestions(suggests);
                this.popover.open();
                this.popover.setAutoDestroy(this.parent);
                this.popover.reposition(SuggestComponent.getPos(this.parent));
            } else {
                this.popover.close();
            }
        } else {
            this.popover.close();
        }

        return
    }
    isBetweenBrackets(value: string,pos: number) {
        // Find the last [[ before cursor
        const lastOpenBracket=value.lastIndexOf("[[",pos-1);
        // Find the next ]] after cursor
        const nextCloseBracket=value.indexOf("]]",pos);

        // Special case: "[[]]""
        if(value.substring(pos,pos-2)==="[["&&value.substring(pos,pos+2)==="]]") {
            return [pos,pos];
        }

        // If either one is not found, return
        if(lastOpenBracket===-1||nextCloseBracket===-1) {
            return [];
        }

        // Check if there's any closing bracket between the last open and cursor
        const closeBracketBetween=value.indexOf("]]",lastOpenBracket);
        if(closeBracketBetween!==-1&&closeBracketBetween<pos) {
            return [];
        }

        // Check if there's any opening bracket between cursor and the next close
        const openBracketBetween=value.indexOf("[[",pos);
        if(openBracketBetween!==-1&&openBracketBetween<nextCloseBracket) {
            return [];
        }

        return [lastOpenBracket+2,nextCloseBracket];
    }

    selectSuggestion(value: string) {
        const oldValue=this.getValue();
        this.setValue([oldValue.slice(0,this.bracketsIndices[0]),value,oldValue.slice(this.bracketsIndices[1])].join(''));
        this.parent.setSelectionRange(this.bracketsIndices[1]+value.length,this.bracketsIndices[1]+value.length);
        this.parent.trigger("input");
        this.popover.close();
    }

    renderSuggestion(value: string,elmt: HTMLElement) {
        const strong=this.searchCriteria
        const pos=value.toLowerCase().indexOf(strong.toLowerCase());

        elmt.createDiv(void 0,(div) => {
            div.createSpan({ text: value.substring(0,pos) });
            div.createEl("strong",{ text: value.substring(pos,pos+strong.length) }).style.color="var(--text-accent)";
            div.createSpan({ text: value.substring(pos+strong.length) });
        });
    }

    onRenderSuggest(cb: (value: string) => void) {
        this.renderCb=cb;
        return this;
    }

    setSuggestList(values: string[]) {
        this.suggetsList=values;
        return this;
    }

    getValue(): string {
        return this.parent.value;
    }

    setValue(value: string) {
        this.parent.value=value;
    }


    static getPos(e: HTMLElement) {
        const elmt=e;
        for(var n=0,i=0,r=null;e&&e!==r;) {
            n+=e.offsetTop,i+=e.offsetLeft;
            for(var o: any=e.offsetParent,a=e.parentElement;a&&a!==o;)
                n-=a.scrollTop,i-=a.scrollLeft,a=a.parentElement;
            o&&o!==r&&(n-=o.scrollTop,i-=o.scrollLeft),e=o;
        }
        return {
            left: i,
            right: i+elmt.offsetWidth,
            top: n,
            bottom: n+elmt.offsetHeight
        };
    }
};





export class DynamicFormModal extends Modal {
    plugin: ContentCreatorPlugin;
    contentType: string;
    formTemplate: any;
    formData: any;
    newContent: boolean;
    containerElMapping: Map<string,HTMLElement>=new Map();
    multiValueFieldsMap: Map<string,MultiValueField>=new Map();
    pages: string[];

    constructor(app: App,plugin: ContentCreatorPlugin,contentType: string,formTemplate: any,formData?: any) {
        super(app);
        this.plugin=plugin;
        this.contentType=contentType;
        this.formTemplate=formTemplate;
        this.newContent=formData? false:true;

        this.formData=this.newContent? this.setNonObjectsToNull(JSON.parse(JSON.stringify(this.formTemplate))):formData;
        this.formData.name=this.newContent? `New ${this.contentType.charAt(0).toUpperCase()+this.contentType.slice(1,-1)}`:formData.name;
        this.formData.oldName=this.formData.name

        this.pages=getAllPages(app);
    }

    onOpen() {
        const { contentEl }=this;
        const scrollContainer=node('div',{ class: 'form-scroll-container' });

        this.modalEl.style.width="50%"
        this.contentEl.style.maxWidth="100%";

        //Name input
        const contentNameInput=node('input',{
            classes: ['content-name'],
            attributes: { 'type': 'text','value': this.formData.name,'placeholder': 'Enter a name' }
        });
        contentNameInput.addEventListener('input',(e) => this.updateContentName((e.target as HTMLInputElement).value));

        contentEl.empty();
        contentEl.addClass('dynamic-form-modal');
        contentEl.appendChild(scrollContainer);
        scrollContainer.appendChild(contentNameInput);


        this.generateForm(scrollContainer,this.formTemplate.template,this.formData.template,"template");

        const buttonContainer=node('div',{ class: 'button-container' });
        contentEl.appendChild(buttonContainer);

        // Cancel button
        new ButtonComponent(buttonContainer)
            .setButtonText('Cancel')
            .onClick(() => this.close());

        // Create button
        new ButtonComponent(buttonContainer)
            .setButtonText(this.newContent? 'Create':'Save')
            .setCta()
            .onClick(() => this.handleSubmit());
    }

    generateForm(container: HTMLElement,template: any,data: any,path: string='') {
        Object.entries(data).forEach(([key,value]) => {
            const currentPath=path? `${path}.${key}`:key;
            const field=this.getValueObjectFromPath(this.formTemplate,currentPath)

            if(isObject(field)) {
                container.appendChild(node('h3',{ text: formatDisplayName(key) }));

                const sectionContainer=node('div',{ class: `section-${key}` });
                container.appendChild(sectionContainer);

                this.containerElMapping.set(currentPath,sectionContainer);
                this.generateForm(sectionContainer,template,value,currentPath);
            } else {
                if(field.startsWith("array")) {
                    const fieldContainer=node('div',{ class: `field-${key}` });
                    const inputType=field.split(':')[1]
                    container.appendChild(fieldContainer);
                    const multiField=new MultiValueField(this.app,fieldContainer,formatDisplayName(key),inputType,value as string[],
                        (newValues) => {
                            this.updateFormData(currentPath,newValues);
                        }
                    );
                    this.multiValueFieldsMap.set(currentPath,multiField);
                } else if(field==="boolean") {
                    new Setting(container)
                        .setName(formatDisplayName(key))
                        .addToggle(toggle => toggle
                            .onChange(newValue => {
                                this.updateFormData(currentPath,newValue);
                            })
                            .setValue(value as boolean));
                } else {
                    if(field==='textarea') {
                        const field=new Setting(container)
                            .setName(formatDisplayName(key))
                            .addTextArea(textarea => {
                                textarea
                                    .setPlaceholder(`Enter ${formatDisplayName(key).toLowerCase()}`)
                                    .onChange(newValue => {
                                        this.updateFormData(currentPath,newValue);
                                        this.adjustTextAreaSize(textarea.inputEl)
                                    })
                                    .setValue(value as string);
                                this.adjustTextAreaSize(textarea.inputEl)
                                return textarea;
                            });
                        new SuggestComponent(this.app,field.controlEl.children[0]).setSuggestList(this.pages)
                    } else {

                        const field=new Setting(container)
                            .setName(formatDisplayName(key))
                            .addText(text => text
                                .setPlaceholder(`Enter ${formatDisplayName(key).toLowerCase()}`)
                                .onChange(newValue => {
                                    this.updateFormData(currentPath,newValue);
                                })
                                .setValue(value as string));

                        new SuggestComponent(this.app,field.controlEl.children[0]).setSuggestList(this.pages)

                    }
                }
            }
        });
    }

    adjustTextAreaSize(textarea: HTMLTextAreaElement) {
        const scrollContainer=this.modalEl.querySelector('.form-scroll-container');
        if(scrollContainer==null) return
        const scrollTop=scrollContainer.scrollTop;


        textarea.style.height="auto";
        textarea.style.height=(textarea.scrollHeight+2)+'px';

        scrollContainer.scrollTop=scrollTop;
    }

    setNonObjectsToNull(obj: any): any {
        if(typeof obj!=='object'||obj===null) return obj;

        if(Array.isArray(obj)) {
            return obj.map(item => {
                if(typeof item==='object'&&item!==null) {
                    return this.setNonObjectsToNull(item);
                } else {
                    return null;
                }
            });
        }
        for(const key in obj) {
            if(Object.prototype.hasOwnProperty.call(obj,key)) {
                if(typeof obj[key]==='object'&&obj[key]!==null) {
                    obj[key]=this.setNonObjectsToNull(obj[key]);
                } else {
                    obj[key]=null;
                }
            }
        }
        return obj;
    }




    updateContentName(value: any) {
        this.formData.name=value
    }

    updateFormData(path: string,value: any) {
        console.log(path)
        const pathParts=path.split('.');
        let current=this.formData;

        for(let i=0;i<pathParts.length-1;i++) {
            current=current[pathParts[i]];
        }

        current[pathParts[pathParts.length-1]]=value;
    }

    getValueObjectFromPath(obj: any,path: string) {
        const pathParts=path.split('.');
        let current=obj;

        for(let i=0;i<pathParts.length-1;i++) {
            current=current[pathParts[i]];
        }
        return current[pathParts[pathParts.length-1]]
    }

    async handleSubmit() {
        if(!this.formData.name||this.formData.name.trim()==="") {
            new Notice("Please provide a name for the content");
            return;
        }
        const file=await this.plugin.createContentFile(this.contentType,this.formData,this.formTemplate,!this.newContent);
        if(file)
            this.close();
    }
}


class MultiValueField {
    private container: HTMLElement;
    private inputType: string;
    private values: string[];
    private inputsContainer: HTMLElement;
    private onValuesChanged: (values: string[]) => void;
    private pages: string[];
    private app: App;

    constructor(
        app: App,
        containerEl: HTMLElement,
        labelText: string,
        inputType: string,
        values: string[],
        onChange: (values: string[]) => void
    ) {
        this.app=app;
        this.container=containerEl;
        this.values=values||[];
        this.pages=getAllPages(this.app);
        this.inputType=inputType;
        this.onValuesChanged=onChange;
        const labelContainer=node('div',{ class: 'multi-value-label' });
        this.container.appendChild(labelContainer);
        labelContainer.appendChild(node('span',{ text: labelText }));

        const addButton=node('button',{
            class: 'multi-value-add-button',
            children: [node("span",{
                text: '+',
            })]
        });
        labelContainer.appendChild(addButton);

        addButton.addEventListener('click',() => this.addValue());

        this.inputsContainer=node('div',{ class: 'multi-value-inputs' });
        this.container.appendChild(this.inputsContainer);

        if(this.values.length===0) {
            this.values.push('');
        }

        this.renderInputs();
    }

    private renderInputs() {
        this.inputsContainer.empty();

        this.values.forEach((value,index) => {
            const inputRow=node('div',{ class: 'multi-value-input-row' });
            this.inputsContainer.appendChild(inputRow);

            const input=node(this.inputType=='text'? 'input':'textarea',{
                class: 'input',
                attributes: {
                    'type': 'text',
                    'value': value,
                    'placeholder': 'Enter value...'
                }
            });
            inputRow.appendChild(input);

            input.addEventListener('input',(e) => {
                this.values[index]=(e.target as HTMLInputElement).value;
                this.onValuesChanged(this.values);
            });


            new SuggestComponent(this.app,input).setSuggestList(this.pages);

            if(this.values.length>1) {
                const removeButton=node('button',{
                    class: 'multi-value-remove-button',
                    children: [node("span",{
                        text: 'x',
                    })]
                });


                inputRow.appendChild(removeButton);

                removeButton.addEventListener('click',() => {
                    this.values.splice(index,1);
                    this.onValuesChanged(this.values);
                    this.renderInputs();
                });
            }
        });
    }

    private addValue() {
        this.values.push('');
        this.onValuesChanged(this.values);
        this.renderInputs();

        const inputs=this.inputsContainer.querySelectorAll('input');
        if(inputs.length>0) {
            (inputs[inputs.length-1] as HTMLInputElement).focus();
        }
    }

    getValues(): string[] {
        return [...this.values];
    }

    setValues(newValues: string[]) {
        this.values=[...newValues];
        this.onValuesChanged(this.values);
        this.renderInputs();
    }
}