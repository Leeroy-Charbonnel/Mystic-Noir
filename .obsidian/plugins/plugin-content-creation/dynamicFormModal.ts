import { App,Modal,Setting,TextAreaComponent,ButtonComponent,ToggleComponent,Notice,PopoverSuggest,TextComponent } from 'obsidian';
import ContentCreatorPlugin from './main';
import { node,formatDisplayName,isObject,FormTemplate,hasValueAndType } from './utils';

//import { Editor } from '@tiptap/core';
//import { Bold } from '@tiptap/extension-bold';
//import { Italic } from '@tiptap/extension-italic';
//import { TextStyle } from '@tiptap/extension-text-style';
//import { Color } from '@tiptap/extension-color'
//import Document from '@tiptap/extension-document'
//import Paragraph from '@tiptap/extension-paragraph'
//import Text from '@tiptap/extension-text'
//import FontFamily from '@tiptap/extension-font-family';
//import { Strike } from '@tiptap/extension-strike'
//import { Heading } from '@tiptap/extension-heading'
//import { BulletList } from '@tiptap/extension-bullet-list'
//import { ListItem } from '@tiptap/extension-list-item'
//import { OrderedList } from '@tiptap/extension-ordered-list'
//import { Blockquote } from '@tiptap/extension-blockquote'


import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color'
import { FontFamily } from '@tiptap/extension-font-family';


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
        this.popover=new (PopoverSuggest as any)(app);
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
    data: FormTemplate;
    multiValueFieldsMap: Map<string,MultiValueField>=new Map();
    pages: string[];

    constructor(app: App,plugin: ContentCreatorPlugin,data: FormTemplate) {
        super(app);
        this.plugin=plugin;
        this.data=data;
        this.pages=getAllPages(this.app);
    }

    onOpen() {
        const { contentEl }=this;
        const scrollContainer=node('div',{ class: 'form-scroll-container' });

        this.modalEl.style.width="50%";
        this.modalEl.style.resize="horizontal";
        this.modalEl.style.minWidth="30%";
        this.modalEl.style.maxWidth="95%";


        this.contentEl.style.maxWidth="100%";

        //Name input
        const contentNameInput=node('input',{
            classes: ['content-name'],
            attributes: { 'type': 'text','value': this.data.name,'placeholder': 'Enter a name' }
        });
        contentNameInput.addEventListener('input',(e) => this.updateContentName((e.target as HTMLInputElement).value));

        contentEl.empty();
        contentEl.addClass('dynamic-form-modal');
        contentEl.appendChild(scrollContainer);
        scrollContainer.appendChild(contentNameInput);


        this.generateForm(scrollContainer,this.data.template,"template");

        const buttonContainer=node('div',{ class: 'button-container' });
        contentEl.appendChild(buttonContainer);

        // Cancel button
        new ButtonComponent(buttonContainer)
            .setButtonText('Cancel')
            .onClick(() => this.close());

        // Create button
        new ButtonComponent(buttonContainer)
            .setButtonText('Save')
            .setCta()
            .onClick(() => this.handleSubmit());
    }

    generateForm(container: HTMLElement,data: any,path: string='') {
        Object.entries(data).forEach(([key,field]: [string,{ value: any,type: string }]) => {
            const currentPath=path? `${path}.${key}`:key;

            if(!hasValueAndType(field)) {
                const sectionContainer=node('div',{ class: `section-${key}` });
                container.appendChild(node('h3',{ text: formatDisplayName(key) }));
                container.appendChild(sectionContainer);
                this.generateForm(sectionContainer,field,currentPath);
            } else {
                if(field.type.startsWith("array")) {
                    const multiField=new MultiValueField(this.app,container)
                        .setName(formatDisplayName(key))
                        .setType(field.type.split(':')[1])
                        .setValues(field.value as string[])
                        .setScrollContainer(this.modalEl.querySelector('.form-scroll-container') as any)
                        .onChange((newValues) => { this.updateData(currentPath,newValues); })
                        .render();
                    this.multiValueFieldsMap.set(currentPath,multiField);

                } else if(field.type==="boolean") {
                    new Setting(container)
                        .setName(formatDisplayName(key))
                        .addToggle(toggle => toggle
                            .onChange(newValue => { this.updateData(currentPath,newValue); })
                            .setValue(field.value as boolean));
                } else {
                    if(field.type==='textarea') {
                        this.createRichTextEditor(container,currentPath,field.value,formatDisplayName(key),'textarea');
                    } else {
                        this.createRichTextEditor(container,currentPath,field.value,formatDisplayName(key),'text');
                        //new SuggestComponent(this.app,fieldInput.controlEl.children[0]).setSuggestList(this.pages)

                    }
                }
            }
        });
    }


    createRichTextEditor(container: HTMLElement,currentPath: string,value: any,fieldName: string,inputType: string) {
        const editorContainer=node('div',{ class: 'editor-container' });

        const toolbar=node('div',{ class: 'editor-toolbar editor-toolbar-hidden' });
        const contentArea=node('div',{ class: `tiptap-content ${inputType=="textarea"? 'editor-textarea':'editor-text'}` });

        const editor=new Editor({
            element: contentArea,
            extensions: [
                StarterKit.configure({ heading: { levels: [1,2,3] } }),
                TextStyle.configure({}),
                Color,
            ],
            content: value||'<p></p>',
            onUpdate: ({ editor }) => {
                const content=editor.getHTML();
                this.updateData(currentPath,content);
            }
        });

        //Bold
        const boldButton=node('button',{ class: 'editor-button',text: 'B',attributes: { 'title': 'Bold','type': 'button' } });
        boldButton.addEventListener('click',() => {
            editor.chain().focus().toggleBold().run();
            //boldButton.classList.toggle('is-active',editor.isActive('bold'));
        });

        //Italic
        const italicButton=node('button',{ class: 'editor-button',text: 'I',attributes: { 'title': 'Italic','type': 'button' } });
        italicButton.style.fontStyle='italic';
        italicButton.addEventListener('click',() => {
            editor.chain().focus().toggleItalic().run();
            //italicButton.classList.toggle('is-active',editor.isActive('italic'));
        });

        //Strikethrough
        const strikeButton=node('button',{ class: 'editor-button',text: 'S',attributes: { 'title': 'Strikethrough','type': 'button','style': 'text-decoration:line-through' } });
        strikeButton.addEventListener('click',() => {
            editor.chain().focus().toggleStrike().run();
            //strikeButton.classList.toggle('is-active',editor.isActive('strike'));
        });

        //Color (Hidden input color behind a button)
        const colorContainer=node('div',{ class: 'editor-color-container' });
        const colorButton=node('button',{ class: 'editor-button',text: 'A',attributes: { 'title': 'Text Color','type': 'button' } });
        const colorInput=node('input',{ class: 'editor-color-input',attributes: { type: 'color',title: 'Pick Text Color',value: '#ff0000' } });

        colorInput.addEventListener('input',(event: any) => {
            const selectedColor=event.target.value;
            colorButton.style.color=selectedColor;
            editor.chain().focus().setColor(selectedColor).run();
        });
        colorButton.style.color='#ffffff';
        colorButton.addEventListener('click',() => { colorInput.click(); });



        //Name
        const fieldLabel=node('div',{
            class: 'tiptap-label',
            text: fieldName
        });


        container.appendChild(fieldLabel);
        container.appendChild(toolbar);
        container.appendChild(editorContainer);


        editorContainer.appendChild(contentArea);
        colorContainer.appendChild(colorButton);
        colorContainer.appendChild(colorInput);

        toolbar.appendChild(colorContainer);
        toolbar.appendChild(boldButton);
        toolbar.appendChild(italicButton);
        toolbar.appendChild(strikeButton);

        let bulletListButton: HTMLButtonElement;
        let numberedListButton: HTMLButtonElement;
        let blockquoteButton: HTMLButtonElement;

        if(inputType=="textarea") {
            //Heading
            const headingDropdown=document.createElement('select');
            headingDropdown.className='tiptap-heading-select';
            headingDropdown.title='Heading Level';

            const headingLevels=[{ level: 0,name: 'Normal' },{ level: 1,name: 'Title 1' },{ level: 2,name: 'Title 2' },{ level: 3,name: 'Title 3' }];
            headingLevels.forEach(heading => {
                const option=document.createElement('option');
                option.value=heading.level.toString();
                option.textContent=heading.name;
                headingDropdown.appendChild(option);
            });
            headingDropdown.value='0';

            headingDropdown.addEventListener('change',() => {
                const selectedLevel=parseInt(headingDropdown.value);
                if(selectedLevel===0) {
                    editor.chain().focus().setParagraph().run();
                } else {
                    editor.chain().focus().setHeading({ level: selectedLevel as 1|2|3 }).run();
                }
            });

            //// Update dropdown when heading changes via other means
            //editor.on('transaction',() => {
            //    if(editor.isActive('heading')) {
            //        const currentLevel=editor.getAttributes('heading').level;
            //        headingDropdown.value=currentLevel.toString();
            //    } else {
            //        headingDropdown.value='0';
            //    }
            //});


            //UL
            bulletListButton=node('button',{ class: 'tiptap-button',text: '•',attributes: { 'title': 'Bullet List','type': 'button' } });
            bulletListButton.addEventListener('click',() => {
                editor.chain().focus().toggleBulletList().run();
                bulletListButton.classList.toggle('is-active',editor.isActive('bulletList'));
            });

            //OL
            numberedListButton=node('button',{ class: 'tiptap-button',text: '#',attributes: { 'title': 'Numbered List','type': 'button' } });
            numberedListButton.addEventListener('click',() => {
                editor.chain().focus().toggleOrderedList().run();
                numberedListButton.classList.toggle('is-active',editor.isActive('orderedList'));
            });

            // Add blockquote button
            blockquoteButton=node('button',{ class: 'tiptap-button',text: '"',attributes: { 'title': 'Blockquote','type': 'button' } });
            blockquoteButton.addEventListener('click',() => {
                editor.chain().focus().toggleBlockquote().run();
                blockquoteButton.classList.toggle('is-active',editor.isActive('blockquote'));
            });

            toolbar.appendChild(headingDropdown);
            toolbar.appendChild(bulletListButton);
            toolbar.appendChild(numberedListButton);
            toolbar.appendChild(blockquoteButton);

        }


        editor.on('transaction',() => {
            boldButton.classList.toggle('is-active',editor.isActive('bold'));
            italicButton.classList.toggle('is-active',editor.isActive('italic'));
            strikeButton.classList.toggle('is-active',editor.isActive('strike'));

            if(inputType=="textarea") {
                bulletListButton.classList.toggle('is-active',editor.isActive('bulletList'));
                numberedListButton.classList.toggle('is-active',editor.isActive('orderedList'));
                blockquoteButton.classList.toggle('is-active',editor.isActive('blockquote'));
            }

            if(editor.isActive('textStyle')) {
                const currentColor=editor.getAttributes('textStyle').color;
                if(currentColor) {
                    colorButton.style.color=currentColor;
                    colorInput.value=currentColor;
                }
            }
        });

        //Show toolbar
        editor.on('focus',() => { toolbar.classList.remove('tiptap-toolbar-hidden'); });

        //Hide toolbar (except if we click on toolbar element)
        editor.on('blur',() => {
            setTimeout(() => {
                if(!toolbar.contains(document.activeElement)) {
                    toolbar.classList.add('tiptap-toolbar-hidden');
                }
            },100);
        });

        ////prevenDefault except if clicked on dropdown or button
        //toolbar.addEventListener('mousedown',(e) => {
        //    // If the target is within the toolbar but not a dropdown or input
        //    if(toolbar.contains(e.target as HTMLElement)&&
        //        !['SELECT','INPUT'].includes((e.target as HTMLElement).tagName)) {
        //        e.preventDefault(); // Prevent default behavior
        //        e.stopPropagation(); // Stop event bubbling
        //    }
        //});

        if(inputType!="textarea") {
            contentArea.style.minHeight='40px';
            contentArea.style.maxHeight='80px';
        }

        //new SuggestComponent(this.app,contentArea).setSuggestList(this.pages);
        return editor;
    }

    updateContentName(value: any) {
        this.data.name=value
    }

    updateData(path: string,value: any) {
        const pathParts: string[]=path.split('.');
        let current: any=this.data;
        for(let i=0;i<pathParts.length-1;i++) {
            current=current[pathParts[i]];
        }
        current[pathParts[pathParts.length-1]].value=value;
    }

    async handleSubmit() {
        if(!this.data.name||this.data.name.trim()==="") {
            new Notice("Please provide a name for the content");
            return;
        }
        const file=await this.plugin.createContentFile(this.data);
        if(file)
            this.close();
    }
}


function adjustTextAreaSize(scrollContainer: HTMLElement,textarea: HTMLTextAreaElement) {
    if(scrollContainer==null) return
    const scrollTop=scrollContainer.scrollTop;
    textarea.style.height="auto";
    textarea.style.height=(textarea.scrollHeight+2)+'px';
    scrollContainer.scrollTop=scrollTop;
}


class MultiValueField {
    private app: App;
    private name: string;
    private pages: string[];
    private inputType: string;
    private container: HTMLElement;
    private scrollContainer: HTMLElement;
    private labelContainer: HTMLElement;
    private values: string[];
    private inputsContainer: HTMLElement;
    private onValuesChanged: (values: string[]) => void;


    constructor(app: App,containerEl: HTMLElement) {
        this.app=app;
        this.container=containerEl;
        this.name="";
        this.values=[];
        this.pages=getAllPages(this.app);

        this.labelContainer=node('div',{ class: 'multi-value-label' });
        const addButton=node('button',{ class: 'multi-value-add-button',children: [node("span",{ text: '+',})] });
        this.inputsContainer=node('div',{ class: 'multi-value-inputs' });

        this.container.appendChild(this.labelContainer);
        this.labelContainer.appendChild(node('span',{ text: this.name }));
        this.labelContainer.appendChild(addButton);
        this.container.appendChild(this.inputsContainer);

        addButton.addEventListener('click',() => this.addValue());
    }
    setName(value: string) {
        this.name=value;
        this.labelContainer.querySelector("span")!.innerText=this.name;
        return this
    }
    setType(value: string) {
        this.inputType=value;
        return this
    }
    setScrollContainer(scrollContainer: HTMLElement) {
        this.scrollContainer=scrollContainer;
        return this
    }
    setValues(values: string[]) {
        this.values=values||[''];
        return this
    }
    onChange(cb: (value: string[]) => void) {
        this.onValuesChanged=cb;
        return this;
    }
    render() {
        this.inputsContainer.empty();

        this.values.forEach((value,index) => {
            const inputRow=node('div',{ class: 'multi-value-input-row' });
            const input=node(this.inputType=='text'? 'input':'textarea',{ class: 'input',attributes: { 'type': 'text','placeholder': 'Enter value...' } });
            input.value=value;


            this.inputsContainer.appendChild(inputRow);
            inputRow.appendChild(input);
            if(this.inputType=="textarea") {
                adjustTextAreaSize(this.scrollContainer,input as HTMLTextAreaElement)
            }

            input.addEventListener('input',(e) => {
                this.values[index]=(e.target as HTMLInputElement).value;
                this.onValuesChanged(this.values);
                if(this.inputType=="textarea") { adjustTextAreaSize(this.scrollContainer,input as HTMLTextAreaElement) }
            });

            new SuggestComponent(this.app,input).setSuggestList(this.pages);
            if(this.values.length>1) {
                const removeButton=node('button',{ class: 'multi-value-remove-button',children: [node("span",{ text: 'x',})] });
                inputRow.appendChild(removeButton);
                removeButton.addEventListener('click',() => {
                    this.values.splice(index,1);
                    this.onValuesChanged(this.values);
                    this.render();
                });
            }
        });
        return this
    }

    private addValue() {
        this.values.push('');
        this.onValuesChanged(this.values);
        this.render();
    }
}