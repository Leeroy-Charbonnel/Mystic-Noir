import { App, Modal, Setting, TextAreaComponent, ButtonComponent, ToggleComponent, Notice, PopoverSuggest, TextComponent } from 'obsidian';
import ContentCreatorPlugin from './main';
import { node, formatDisplayName, isObject, FormTemplate, hasValueAndType } from './utils';

import { Editor } from '@tiptap/core';
import { Bold } from '@tiptap/extension-bold';
import { Italic } from '@tiptap/extension-italic';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import FontFamily from '@tiptap/extension-font-family';


function getAllPages(app: App): string[] {
    return app.vault.getMarkdownFiles().map(x => x.basename);
}


class SuggestComponent {
    popover: any;
    parent: any;
    suggetsList: string[];
    searchCriteria: string;
    bracketsIndices: number[];
    renderCb: (value: any, element: HTMLElement) => void;
    selectCb: (value: any) => void;


    constructor(app: App, parent: any) {
        this.parent = parent;
        this.popover = new (PopoverSuggest as any)(app);
        this.popover.selectSuggestion = this.selectSuggestion.bind(this);
        this.popover.renderSuggestion = this.renderSuggestion.bind(this);
        this.parent.addEventListener("input", (e: Event) => this.onInputChange(e));
        this.parent.addEventListener("focus", (e: Event) => this.onInputChange(e));
        this.parent.addEventListener("blur", () => this.popover.close());
        this.popover.suggestEl.on("mousedown", ".suggestion-item", (e: MouseEvent) => e.preventDefault());
    }

    onInputChange(e: any) {
        if (e == undefined) return

        let value = this.getValue();
        const pos = e.target.selectionEnd
        const closeChars = new Map([
            ['{', '}'],
            ['[', ']'],
            ['(', ')']
        ]);
        const closeChar = closeChars.get(e.data);
        if (closeChar) {
            this.setValue([value.slice(0, pos), closeChar, value.slice(pos)].join(''))
            e.target.setSelectionRange(pos, pos)
        }

        value = this.getValue();
        this.bracketsIndices = this.isBetweenBrackets(value, pos);
        if (this.bracketsIndices.length > 0) {
            this.searchCriteria = value.slice(this.bracketsIndices[0], this.bracketsIndices[1]).toLocaleLowerCase().trim();
            const suggests = this.searchCriteria == "" ? this.suggetsList : this.suggetsList.filter(e => e.toLowerCase().trim().includes(this.searchCriteria))

            if (suggests.length > 0) {
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
    isBetweenBrackets(value: string, pos: number) {
        // Find the last [[ before cursor
        const lastOpenBracket = value.lastIndexOf("[[", pos - 1);
        // Find the next ]] after cursor
        const nextCloseBracket = value.indexOf("]]", pos);

        // Special case: "[[]]""
        if (value.substring(pos, pos - 2) === "[[" && value.substring(pos, pos + 2) === "]]") {
            return [pos, pos];
        }

        // If either one is not found, return
        if (lastOpenBracket === -1 || nextCloseBracket === -1) {
            return [];
        }

        // Check if there's any closing bracket between the last open and cursor
        const closeBracketBetween = value.indexOf("]]", lastOpenBracket);
        if (closeBracketBetween !== -1 && closeBracketBetween < pos) {
            return [];
        }

        // Check if there's any opening bracket between cursor and the next close
        const openBracketBetween = value.indexOf("[[", pos);
        if (openBracketBetween !== -1 && openBracketBetween < nextCloseBracket) {
            return [];
        }

        return [lastOpenBracket + 2, nextCloseBracket];
    }

    selectSuggestion(value: string) {
        const oldValue = this.getValue();
        this.setValue([oldValue.slice(0, this.bracketsIndices[0]), value, oldValue.slice(this.bracketsIndices[1])].join(''));
        this.parent.setSelectionRange(this.bracketsIndices[1] + value.length, this.bracketsIndices[1] + value.length);
        this.parent.trigger("input");
        this.popover.close();
    }

    renderSuggestion(value: string, elmt: HTMLElement) {
        const strong = this.searchCriteria
        const pos = value.toLowerCase().indexOf(strong.toLowerCase());

        elmt.createDiv(void 0, (div) => {
            div.createSpan({ text: value.substring(0, pos) });
            div.createEl("strong", { text: value.substring(pos, pos + strong.length) }).style.color = "var(--text-accent)";
            div.createSpan({ text: value.substring(pos + strong.length) });
        });
    }

    onRenderSuggest(cb: (value: string) => void) {
        this.renderCb = cb;
        return this;
    }

    setSuggestList(values: string[]) {
        this.suggetsList = values;
        return this;
    }

    getValue(): string {
        return this.parent.value;
    }

    setValue(value: string) {
        this.parent.value = value;
    }


    static getPos(e: HTMLElement) {
        const elmt = e;
        for (var n = 0, i = 0, r = null; e && e !== r;) {
            n += e.offsetTop, i += e.offsetLeft;
            for (var o: any = e.offsetParent, a = e.parentElement; a && a !== o;)
                n -= a.scrollTop, i -= a.scrollLeft, a = a.parentElement;
            o && o !== r && (n -= o.scrollTop, i -= o.scrollLeft), e = o;
        }
        return {
            left: i,
            right: i + elmt.offsetWidth,
            top: n,
            bottom: n + elmt.offsetHeight
        };
    }
};



export class DynamicFormModal extends Modal {
    plugin: ContentCreatorPlugin;
    data: FormTemplate;
    multiValueFieldsMap: Map<string, MultiValueField> = new Map();
    pages: string[];

    constructor(app: App, plugin: ContentCreatorPlugin, data: FormTemplate) {
        super(app);
        this.plugin = plugin;
        this.data = data;
        this.pages = getAllPages(this.app);
    }

    onOpen() {
        const { contentEl } = this;
        const scrollContainer = node('div', { class: 'form-scroll-container' });

        this.modalEl.style.width = "50%";
        this.modalEl.style.resize = "horizontal";
        this.modalEl.style.minWidth = "30%";
        this.modalEl.style.maxWidth = "95%";


        this.contentEl.style.maxWidth = "100%";

        //Name input
        const contentNameInput = node('input', {
            classes: ['content-name'],
            attributes: { 'type': 'text', 'value': this.data.name, 'placeholder': 'Enter a name' }
        });
        contentNameInput.addEventListener('input', (e) => this.updateContentName((e.target as HTMLInputElement).value));

        contentEl.empty();
        contentEl.addClass('dynamic-form-modal');
        contentEl.appendChild(scrollContainer);
        scrollContainer.appendChild(contentNameInput);


        this.generateForm(scrollContainer, this.data.template, "template");

        const buttonContainer = node('div', { class: 'button-container' });
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

    generateForm(container: HTMLElement, data: any, path: string = '') {
        Object.entries(data).forEach(([key, field]: [string, { value: any, type: string }]) => {
            const currentPath = path ? `${path}.${key}` : key;

            if (!hasValueAndType(field)) {
                const sectionContainer = node('div', { class: `section-${key}` });
                container.appendChild(node('h3', { text: formatDisplayName(key) }));
                container.appendChild(sectionContainer);
                this.generateForm(sectionContainer, field, currentPath);
            } else {
                if (field.type.startsWith("array")) {
                    const multiField = new MultiValueField(this.app, container)
                        .setName(formatDisplayName(key))
                        .setType(field.type.split(':')[1])
                        .setValues(field.value as string[])
                        .setScrollContainer(this.modalEl.querySelector('.form-scroll-container') as any)
                        .onChange((newValues) => { this.updateData(currentPath, newValues); })
                        .render();
                    this.multiValueFieldsMap.set(currentPath, multiField);

                } else if (field.type === "boolean") {
                    new Setting(container)
                        .setName(formatDisplayName(key))
                        .addToggle(toggle => toggle
                            .onChange(newValue => { this.updateData(currentPath, newValue); })
                            .setValue(field.value as boolean));
                } else {
                    if (field.type === 'textarea') {
                        // Create editor container
                        const editorContainer = node('div', { class: 'tiptap-editor-container' });
                        container.appendChild(editorContainer);

                        // Create toolbar (initially hidden)
                        const toolbar = node('div', { class: 'tiptap-toolbar ' });
                        editorContainer.appendChild(toolbar);
                        // tiptap-toolbar-hidden

                        // Create content area
                        const contentArea = node('div', { class: 'tiptap-content' });
                        editorContainer.appendChild(contentArea);



                        // Initialize the editor
                        const editor = new Editor({
                            element: contentArea,
                            extensions: [
                                Document,
                                Paragraph,
                                Text,
                                TextStyle,
                                Color,
                                Italic,
                                Bold,
                            ],
                            content: field.value || '<p></p>',
                            onUpdate: ({ editor }) => {
                                const content = editor.getHTML();
                                this.updateData(currentPath, content);
                            },
                        });

                        // Bold button
                        const boldButton = node('button', { class: 'tiptap-button', text: 'B', attributes: { 'title': 'Bold', 'type': 'button' } });
                        boldButton.addEventListener('click', () => {
                            editor.chain().focus().toggleBold().run();
                            boldButton.classList.toggle('is-active', editor.isActive('bold'));
                        });

                        // Italic button
                        const italicButton = node('button', { class: 'tiptap-button', text: 'I', attributes: { 'title': 'Italic', 'type': 'button' } });
                        italicButton.style.fontStyle = 'italic';
                        italicButton.addEventListener('click', () => {
                            editor.chain().focus().toggleItalic().run();
                            italicButton.classList.toggle('is-active', editor.isActive('italic'));
                        });

                        //Color button
                        const colorInput = node('input', { class: 'tiptap-color-input', attributes: { type: 'color', title: 'Text Color', value: '#ff0000' } });
                        colorInput.addEventListener('input', (event: any) => {
                            const selectedColor = event!.target!.value;
                            editor.chain().focus().setColor(selectedColor).run();
                        });


                        // Append dropdown to toolbar
                        toolbar.appendChild(colorInput);
                        toolbar.appendChild(boldButton);
                        toolbar.appendChild(italicButton);

                        // Add event listener to update the editor as needed
                        editor.on('transaction', () => {
                            boldButton.classList.toggle('is-active', editor.isActive('bold'));
                            italicButton.classList.toggle('is-active', editor.isActive('italic'));
                        });

                        // Show toolbar when editor is focused
                        editor.on('focus', () => {
                            toolbar.classList.remove('tiptap-toolbar-hidden');
                        });

                        // Hide toolbar when editor loses focus
                        editor.on('blur', () => {
                            // Small delay to allow for clicking on toolbar buttons
                            setTimeout(() => {
                                // Check if the active element is within the toolbar
                                if (!toolbar.contains(document.activeElement)) {
                                    toolbar.classList.add('tiptap-toolbar-hidden');
                                }
                            }, 100);
                        });

                        toolbar.addEventListener('mousedown', (e) => {
                            // If the target is within the toolbar but not a dropdown element (e.g. select, input), prevent default
                            if (toolbar.contains(e.target as HTMLElement) && !['SELECT', 'INPUT'].includes((e.target as HTMLElement).tagName)) {
                                e.preventDefault(); // Prevent default behavior, like focus/blur events
                                e.stopPropagation(); // Stop the event from bubbling up
                            }
                        });






































                        // const scrollContainer = this.modalEl.querySelector('.form-scroll-container') as HTMLElement;
                        // const fieldInput = new Setting(container)
                        //     .setName(formatDisplayName(key))
                        //     .addTextArea(textarea => {
                        //         textarea
                        //             .setPlaceholder(`Enter ${formatDisplayName(key).toLowerCase()}`)
                        //             .onChange(newValue => {
                        //                 this.updateData(currentPath, newValue);
                        //                 adjustTextAreaSize(scrollContainer, textarea.inputEl)
                        //             })
                        //             .setValue(field.value as string);
                        //         adjustTextAreaSize(scrollContainer, textarea.inputEl)
                        //         return textarea;
                        //     });
                        // new SuggestComponent(this.app, fieldInput.controlEl.children[0]).setSuggestList(this.pages)
                    } else {

                        const fieldInput = new Setting(container)
                            .setName(formatDisplayName(key))
                            .addText(text => text
                                .setPlaceholder(`Enter ${formatDisplayName(key).toLowerCase()}`)
                                .onChange(newValue => {
                                    this.updateData(currentPath, newValue);
                                })
                                .setValue(field.value as string));

                        new SuggestComponent(this.app, fieldInput.controlEl.children[0]).setSuggestList(this.pages)

                    }
                }
            }
        });
    }

    updateContentName(value: any) {
        this.data.name = value
    }

    updateData(path: string, value: any) {
        const pathParts: string[] = path.split('.');
        let current: any = this.data;
        for (let i = 0; i < pathParts.length - 1; i++) {
            current = current[pathParts[i]];
        }
        current[pathParts[pathParts.length - 1]].value = value;
    }

    async handleSubmit() {
        if (!this.data.name || this.data.name.trim() === "") {
            new Notice("Please provide a name for the content");
            return;
        }
        const file = await this.plugin.createContentFile(this.data);
        if (file)
            this.close();
    }
}


function adjustTextAreaSize(scrollContainer: HTMLElement, textarea: HTMLTextAreaElement) {
    if (scrollContainer == null) return
    const scrollTop = scrollContainer.scrollTop;
    textarea.style.height = "auto";
    textarea.style.height = (textarea.scrollHeight + 2) + 'px';
    scrollContainer.scrollTop = scrollTop;
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


    constructor(app: App, containerEl: HTMLElement) {
        this.app = app;
        this.container = containerEl;
        this.name = "";
        this.values = [];
        this.pages = getAllPages(this.app);

        this.labelContainer = node('div', { class: 'multi-value-label' });
        const addButton = node('button', { class: 'multi-value-add-button', children: [node("span", { text: '+', })] });
        this.inputsContainer = node('div', { class: 'multi-value-inputs' });

        this.container.appendChild(this.labelContainer);
        this.labelContainer.appendChild(node('span', { text: this.name }));
        this.labelContainer.appendChild(addButton);
        this.container.appendChild(this.inputsContainer);

        addButton.addEventListener('click', () => this.addValue());
    }
    setName(value: string) {
        this.name = value;
        this.labelContainer.querySelector("span")!.innerText = this.name;
        return this
    }
    setType(value: string) {
        this.inputType = value;
        return this
    }
    setScrollContainer(scrollContainer: HTMLElement) {
        this.scrollContainer = scrollContainer;
        return this
    }
    setValues(values: string[]) {
        this.values = values || [''];
        return this
    }
    onChange(cb: (value: string[]) => void) {
        this.onValuesChanged = cb;
        return this;
    }
    render() {
        this.inputsContainer.empty();

        this.values.forEach((value, index) => {
            const inputRow = node('div', { class: 'multi-value-input-row' });
            const input = node(this.inputType == 'text' ? 'input' : 'textarea', { class: 'input', attributes: { 'type': 'text', 'placeholder': 'Enter value...' } });
            input.value = value;


            this.inputsContainer.appendChild(inputRow);
            inputRow.appendChild(input);
            if (this.inputType == "textarea") {
                adjustTextAreaSize(this.scrollContainer, input as HTMLTextAreaElement)
            }

            input.addEventListener('input', (e) => {
                this.values[index] = (e.target as HTMLInputElement).value;
                this.onValuesChanged(this.values);
                if (this.inputType == "textarea") { adjustTextAreaSize(this.scrollContainer, input as HTMLTextAreaElement) }
            });

            new SuggestComponent(this.app, input).setSuggestList(this.pages);
            if (this.values.length > 1) {
                const removeButton = node('button', { class: 'multi-value-remove-button', children: [node("span", { text: 'x', })] });
                inputRow.appendChild(removeButton);
                removeButton.addEventListener('click', () => {
                    this.values.splice(index, 1);
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