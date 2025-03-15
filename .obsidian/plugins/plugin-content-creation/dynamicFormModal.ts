import { App,Modal,Setting,TextAreaComponent,ButtonComponent,ToggleComponent,Notice,PopoverSuggest,TextComponent } from 'obsidian';
import ContentCreatorPlugin from './main';
import { node,formatDisplayName,isObject,FormTemplate,hasValueAndType } from './utils';

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';


function getAllPages(app: App): string[] {
    return app.vault.getMarkdownFiles().map(x => x.basename);
}


class SuggestComponent {
    popover: any;
    parent: HTMLElement;
    suggetsList: string[];
    searchCriteria: string;
    bracketsIndices: number[];
    focusNode: Node;

    constructor(app: App,parent: HTMLElement) {
        this.parent=parent;
        this.popover=new (PopoverSuggest as any)(app);
        this.popover.selectSuggestion=this.selectSuggestion.bind(this);
        this.popover.renderSuggestion=this.renderSuggestion.bind(this);
        this.parent.addEventListener("input",(e: Event) => this.onInputChange(e));
        this.parent.addEventListener("blur",() => this.popover.close());
        this.popover.suggestEl.on("mousedown",".suggestion-item",(e: MouseEvent) => e.preventDefault());
        this.addScrollListeners();
    }

    private addScrollListeners() {
        let element=this.parent;
        while(element) {
            if(element.scrollHeight>element.clientHeight) {
                element.addEventListener('scroll',() => {
                    if(this.popover.isOpen) this.updatePopoverPosition();
                });
            }
            (element as any)=element.parentElement;
        }

        //Add global scroll listener to reposition popover
        window.addEventListener('scroll',() => {
            if(this.popover.isOpen) this.updatePopoverPosition();
        },true);
    }

    private updatePopoverPosition() {
        if(!this.focusNode) return;
        const pos=this.getPos();
        this.popover.reposition(pos);
    }

    onInputChange(e: any) {
        if(e==undefined) return;

        let selection=window.getSelection();
        if(!selection||!selection.rangeCount||!selection.focusNode) return;

        //Focus node = selected sub node in editor (p element, strong element, etc.)
        this.focusNode=selection.focusNode;
        let pos=selection.getRangeAt(0).startOffset;
        let value=this.getValue();

        //Auto-complete brackets, parentheses, etc.
        if(e.inputType==="insertText"&&e.data) {
            const closeChars=new Map([
                ['{','}'],
                ['[',']'],
                ['(',')']
            ]);
            const closeChar=closeChars.get(e.data);
            if(closeChar) {
                this.setValue([value.slice(0,pos),closeChar,value.slice(pos)].join(''));
                this.setCursorPosition(pos);
            }
        }

        //Get value again after auto-complete
        value=this.getValue();
        this.bracketsIndices=this.isBetweenBrackets(value,pos);

        if(this.bracketsIndices.length>0) {
            this.searchCriteria=value.slice(this.bracketsIndices[0],this.bracketsIndices[1]).toLowerCase().trim();
            const suggests=this.searchCriteria===""
                ? this.suggetsList
                :this.suggetsList.filter(e => e.toLowerCase().trim().includes(this.searchCriteria));

            if(suggests.length>0) {
                this.popover.suggestions.setSuggestions(suggests);
                this.popover.open();
                this.popover.setAutoDestroy(this.parent);
                this.updatePopoverPosition();
            } else {
                this.popover.close();
            }
        } else {
            this.popover.close();
        }

        return;
    }


    isBetweenBrackets(value: string,pos: number) {
        //Find the last [[ before cursor
        const lastOpenBracket=value.lastIndexOf("[[",pos-1);
        //Find the next ]] after cursor
        const nextCloseBracket=value.indexOf("]]",pos);

        //Special case: cursor is exactly between empty brackets [[]]
        if(pos>=2&&pos<=value.length-2&&
            value.substring(pos-2,pos)==="[["&&
            value.substring(pos,pos+2)==="]]") {
            return [pos,pos];
        }

        //If either bracket not found, return empty
        if(lastOpenBracket===-1||nextCloseBracket===-1) {
            return [];
        }

        //Check for closing bracket between opening and cursor
        const closeBracketBetween=value.indexOf("]]",lastOpenBracket);
        if(closeBracketBetween!==-1&&closeBracketBetween<pos) {
            return [];
        }

        //Check for opening bracket between cursor and closing
        const openBracketBetween=value.indexOf("[[",pos);
        if(openBracketBetween!==-1&&openBracketBetween<nextCloseBracket) {
            return [];
        }

        return [lastOpenBracket+2,nextCloseBracket];
    }

    selectSuggestion(value: string) {
        const oldValue=this.getValue();
        const newValue=oldValue.slice(0,this.bracketsIndices[0])+
            value+
            oldValue.slice(this.bracketsIndices[1]);

        this.setValue(newValue);
        //+2 to place cursor after "]]"
        this.setCursorPosition(this.bracketsIndices[0]+value.length+2);
        this.popover.close();
    }

    setCursorPosition(position: number) {
        const selection=window.getSelection();
        if(!selection) return;

        const range=document.createRange();
        const actualPos=Math.min(position,this.focusNode.textContent?.length||0);
        range.setStart(this.focusNode,actualPos);
        range.collapse(true);

        selection.removeAllRanges();
        selection.addRange(range);
    }

    renderSuggestion(value: string,elmt: HTMLElement) {
        const strong=this.searchCriteria;
        const pos=value.toLowerCase().indexOf(strong.toLowerCase());

        elmt.createDiv(void 0,(div) => {
            div.createSpan({ text: value.substring(0,pos) });
            div.createEl("strong",{ text: value.substring(pos,pos+strong.length) }).style.color="var(--text-accent)";
            div.createSpan({ text: value.substring(pos+strong.length) });
        });
    }

    setSuggestList(values: string[]) {
        this.suggetsList=values;
        return this;
    }

    getValue(): string {
        //Get value of selected sub node only, not the whole html value of the editor
        return this.focusNode? this.focusNode.textContent!:'';
    }

    setValue(value: string) {
        //Same comment as getValue
        this.focusNode.textContent=value;
    }

    getPos(): {
        left: number;
        right: number;
        top: number;
        bottom: number;
        width: number;
        height: number;
    } {
        let pos={
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            width: 0,
            height: 0
        };

        if(!this.focusNode) return pos;
        const element=this.focusNode instanceof HTMLElement
            ? this.focusNode
            :this.focusNode.parentElement;
        if(!element) return pos;
        pos=element.getBoundingClientRect();
        return pos;
    }
}





class RichTextEditor {
    private app: App;
    private pages: string[];
    onChangeCb: (value: any) => void;

    constructor(app: App,pages: string[]=[]) {
        this.app=app;
        this.pages=pages;
    }

    createRichTextEditor(container: HTMLElement,value: any,inputType: string) {
        const editorContainer=node('div',{ class: 'editor-container' });
        const toolbar=node('div',{ class: 'editor-toolbar editor-toolbar-hidden' });
        const contentArea=node('div',{ class: 'editor-content' });


        let processedContent=value;
        console.log(processedContent);

        const editor=new Editor({
            element: contentArea,
            extensions: [
                StarterKit.configure({ heading: { levels: [1,2,3] } }),
                TextStyle.configure({}),
                Color,
            ],
            content: processedContent? processedContent:Array(inputType=='textarea'? 5:1).fill('<p></p>').join(''),
            onUpdate: ({ editor }) => {
                const content=editor.getHTML();
                this.onChangeCb(content);
            }
        });

        //Create formatting buttons
        const boldButton=node('button',{ class: 'editor-button',text: 'B',attributes: { 'title': 'Bold','type': 'button' } });
        boldButton.addEventListener('click',() => { editor.chain().focus().toggleBold().run(); });

        const italicButton=node('button',{ class: 'editor-button',text: 'I',attributes: { 'title': 'Italic','type': 'button','style': 'font-style:italic' } });
        italicButton.addEventListener('click',() => { editor.chain().focus().toggleItalic().run(); });

        const strikeButton=node('button',{ class: 'editor-button',text: 'S',attributes: { 'title': 'Strikethrough','type': 'button','style': 'text-decoration:line-through' } });
        strikeButton.addEventListener('click',() => { editor.chain().focus().toggleStrike().run(); });

        //Color picker with hidden input
        const colorContainer=node('div',{ class: 'editor-color-container' });
        const colorButton=node('button',{ class: 'editor-button',text: 'A',attributes: { 'title': 'Text Color','type': 'button' } });
        const colorInput=node('input',{ class: 'editor-color-input',attributes: { type: 'color',title: 'Pick Text Color',value: getComputedStyle(document.body).getPropertyValue('--text-normal') } });

        colorInput.addEventListener('input',(event: any) => {
            const selectedColor=event.target.value;
            colorButton.style.color=selectedColor;
            editor.chain().focus().setColor(selectedColor).run();
        });
        colorButton.style.color='#ffffff';
        colorButton.addEventListener('click',() => { colorInput.click(); });

        container.appendChild(editorContainer);
        editorContainer.appendChild(toolbar);
        editorContainer.appendChild(contentArea);

        colorContainer.appendChild(colorButton);
        colorContainer.appendChild(colorInput);

        toolbar.appendChild(colorContainer);
        toolbar.appendChild(boldButton);
        toolbar.appendChild(italicButton);
        toolbar.appendChild(strikeButton);

        let bulletListButton: HTMLButtonElement;
        let numberedListButton: HTMLButtonElement;

        //Add extra formatting options for textarea fields
        if(inputType=="textarea") {
            //Heading dropdown
            const headingDropdown=document.createElement('select');
            headingDropdown.className='editor-heading-select';
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

            //Update dropdown when editor selection changes
            editor.on('transaction',() => {
                if(editor.isActive('heading')) {
                    const currentLevel=editor.getAttributes('heading').level;
                    headingDropdown.value=currentLevel.toString();
                } else {
                    headingDropdown.value='0';
                }
            });

            //List formatting buttons
            bulletListButton=node('button',{ class: 'editor-button',text: '•',attributes: { 'title': 'Bullet List','type': 'button' } });
            bulletListButton.addEventListener('click',() => {
                editor.chain().focus().toggleBulletList().run();
                bulletListButton.classList.toggle('is-active',editor.isActive('bulletList'));
            });

            numberedListButton=node('button',{ class: 'editor-button',text: '#',attributes: { 'title': 'Numbered List','type': 'button' } });
            numberedListButton.addEventListener('click',() => {
                editor.chain().focus().toggleOrderedList().run();
                numberedListButton.classList.toggle('is-active',editor.isActive('orderedList'));
            });

            toolbar.appendChild(headingDropdown);
            toolbar.appendChild(bulletListButton);
            toolbar.appendChild(numberedListButton);
        }

        //Update button states based on current formatting
        editor.on('transaction',() => {
            boldButton.classList.toggle('is-active',editor.isActive('bold'));
            italicButton.classList.toggle('is-active',editor.isActive('italic'));
            strikeButton.classList.toggle('is-active',editor.isActive('strike'));

            if(inputType=="textarea") {
                bulletListButton.classList.toggle('is-active',editor.isActive('bulletList'));
                numberedListButton.classList.toggle('is-active',editor.isActive('orderedList'));
            }

            if(editor.isActive('textStyle')) {
                const currentColor=editor.getAttributes('textStyle').color;
                if(currentColor) {
                    colorButton.style.color=currentColor;
                    colorInput.value=currentColor;
                }
            }
        });

        //Show toolbar on focus
        editor.on('focus',() => { toolbar.classList.remove('editor-toolbar-hidden'); });

        //Hide toolbar on blur (except when clicking toolbar itself)
        editor.on('blur',() => {
            setTimeout(() => {
                if(!editorContainer.contains(document.activeElement)) {
                    toolbar.classList.add('editor-toolbar-hidden');
                }
            },100);
        });

        new SuggestComponent(this.app,contentArea).setSuggestList(this.pages);
    }

    onChange(cb: (value: any) => void) {
        this.onChangeCb=cb;
        return this;
    }
}


export class DynamicFormModal extends Modal {
    plugin: ContentCreatorPlugin;
    data: FormTemplate;
    multiValueFieldsMap: Map<string,MultiValueField>=new Map();
    pages: string[];

    private isDragging: boolean=false;
    private dragStartX: number=0;
    private dragStartY: number=0;

    constructor(app: App,plugin: ContentCreatorPlugin,data: FormTemplate) {
        super(app);
        this.plugin=plugin;
        this.data=data;
        this.pages=getAllPages(this.app);
    }

    onOpen() {
        const { contentEl }=this;

        //Configure modal appearance
        this.modalEl.style.width="50%";
        this.modalEl.style.resize="horizontal";
        this.modalEl.style.minWidth="30%";
        this.modalEl.style.maxWidth="95%";
        this.contentEl.style.maxWidth="100%";


        // Create the title span separately so you can reference it
        const titleSpan=node('span',{ text: `Edit ${this.data.contentType}` });

        const dragHandle=node('div',{
            class: 'modal-drag-handle',
            children: [titleSpan]
        });

        dragHandle.addEventListener('mousedown',(e: MouseEvent) => {
            if(e.target===dragHandle||e.target===titleSpan) {
                this.isDragging=true;
                this.dragStartX=e.clientX;
                this.dragStartY=e.clientY;
                this.modalEl.addClass('is-dragging');
                e.preventDefault();
            }
        });

        document.addEventListener('mousemove',this.handleMouseMove);
        document.addEventListener('mouseup',this.handleMouseUp);

        const scrollContainer=node('div',{ class: 'form-scroll-container' });

        //Create content name input field
        const contentNameInput=node('input',{
            classes: ['content-name'],
            attributes: { 'type': 'text','value': this.data.name,'placeholder': 'Enter a name' }
        });
        contentNameInput.addEventListener('input',(e) => this.updateContentName((e.target as HTMLInputElement).value));

        //Build the form structure
        contentEl.empty();
        contentEl.addClass('dynamic-form-modal');
        contentEl.appendChild(dragHandle);
        contentEl.appendChild(scrollContainer);
        
        scrollContainer.appendChild(contentNameInput);

        this.generateForm(scrollContainer,this.data.template,"template",0);

        //Add action buttons
        const buttonContainer=node('div',{ class: 'button-container' });
        contentEl.appendChild(buttonContainer);

        new ButtonComponent(buttonContainer)
            .setButtonText('Cancel')
            .onClick(() => this.close());

        new ButtonComponent(buttonContainer)
            .setButtonText('Save')
            .setCta()
            .onClick(() => this.handleSubmit());
    }

    generateForm(container: HTMLElement,data: any,path: string='',deep: number) {

        Object.entries(data).forEach(([key,field]: [string,{ value: any,type: string }]) => {
            const currentPath=path? `${path}.${key}`:key;
            const fieldName=formatDisplayName(key);

            //Handle nested sections
            if(!hasValueAndType(field)) {
                const headerContainer=node('div',{ class: `header-container` });
                const sectionContainer=node('div',{ class: `section-container` });
                headerContainer.appendChild(node('div',{ class: `header-${deep}`,text: fieldName }));
                headerContainer.appendChild(node('div',{ class: `header-separator-${deep} header-separator` }));

                container.appendChild(headerContainer);
                container.appendChild(sectionContainer);

                this.generateForm(sectionContainer,field,currentPath,deep+1);
            } else {
                //Handle field types
                const fieldContainer=node('div',{ class: 'dynamic-form-field-container' });

                if(field.type.startsWith("array")) {
                    //Create multi-value field (array type)
                    const multiField=new MultiValueField(this.app,fieldContainer)
                        .setName(fieldName)
                        .setType(field.type.split(':')[1])
                        .setValues(field.value as string[])
                        .onChange((newValues) => { this.updateData(currentPath,newValues); })
                        .render();
                    this.multiValueFieldsMap.set(currentPath,multiField);
                } else if(field.type==="boolean") {
                    //Create toggle/checkbox for boolean values
                    new Setting(fieldContainer)
                        .setName(fieldName)
                        .addToggle(toggle => toggle
                            .onChange(newValue => { this.updateData(currentPath,newValue); })
                            .setValue(field.value as boolean));
                } else {
                    //Create rich text editor for text/textarea
                    const fieldLabel=node('div',{ class: 'editor-label',text: fieldName });
                    fieldContainer.appendChild(fieldLabel);
                    fieldContainer.addClass(field.type);
                    const fieldEl=new RichTextEditor(this.app,this.pages);
                    fieldEl.createRichTextEditor(fieldContainer,field.value,field.type);
                    fieldEl.onChange(newValue => { this.updateData(currentPath,newValue); });
                }

                container.appendChild(fieldContainer);
            }
        });
    }

    updateContentName(value: any) {
        this.data.name=value;
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
        if(file) {
            this.close();
        }
    }

    private handleMouseMove=(e: MouseEvent) => {
        if(!this.isDragging) return;

        const dx=e.clientX-this.dragStartX;
        const dy=e.clientY-this.dragStartY;

        const currentLeft=parseInt(getComputedStyle(this.modalEl).left,10)||0;
        const currentTop=parseInt(getComputedStyle(this.modalEl).top,10)||0;

        this.modalEl.style.left=`${currentLeft+dx}px`;
        this.modalEl.style.top=`${currentTop+dy}px`;

        this.dragStartX=e.clientX;
        this.dragStartY=e.clientY;
    }

    private handleMouseUp=() => {
        this.isDragging=false;
        this.modalEl.removeClass('is-dragging');
    }

    onClose() {
        document.removeEventListener('mousemove',this.handleMouseMove);
        document.removeEventListener('mouseup',this.handleMouseUp);
    }
}


class MultiValueField {
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
        this.pages=getAllPages(this.app);

        this.labelContainer=node('div',{ class: 'multi-value-label' });
        const addButton=node('button',{ class: 'multi-value-add-button',children: [node("span",{ text: '+' })] });
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

        //Create a field for each value in the array
        this.values.forEach((value,index) => {
            const inputRow=node('div',{ class: `multi-value-input-row` });

            const fieldEl=new RichTextEditor(this.app,this.pages);
            fieldEl.createRichTextEditor(inputRow,value,this.inputType);

            fieldEl.onChange((newValue) => {
                this.values[index]=newValue;
                this.onChangeCb(this.values);
            });

            this.inputsContainer.appendChild(inputRow);

            //Add removal button for all but the first item
            if(this.values.length>1) {
                const removeButton=node('button',{ class: 'multi-value-remove-button',children: [node("span",{ text: 'x' })] });
                inputRow.appendChild(removeButton);
                removeButton.addEventListener('click',() => {
                    this.values.splice(index,1);
                    this.onChangeCb(this.values);
                    this.render();
                });
            }
        });
        return this;
    }

    private addValue() {
        this.values.push('');
        this.onChangeCb(this.values);
        this.render();
    }
}