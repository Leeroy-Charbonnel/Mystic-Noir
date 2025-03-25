import { App, ButtonComponent, ToggleComponent, Notice, TextComponent, TFile } from 'obsidian';
import ContentCreatorPlugin from './main';
import { node, formatDisplayName, isObject, FormTemplate, hasValueAndType, isGroupType } from './utils';

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import SuggestComponent from './SuggestComponent';
import { MultiValueField } from './MultiValueField';
import { DropdownComponent } from 'components/DropdownComponent';
import { BadgesComponent } from 'components/BadgesComponent';
import { ImageComponent } from 'components/ImageComponent';
import { DateComponent } from 'components/DateComponent';


export class DynamicFormView {
    private app: App;
    private plugin: ContentCreatorPlugin;
    private data: FormTemplate;
    private container: HTMLElement;
    private formContainer: HTMLElement;
    private multiValueFieldsMap: Map<string, MultiValueField> = new Map();
    private pages: string[];
    private newContent: boolean;
    private requiredFields: string[] = [];

    constructor(app: App, plugin: ContentCreatorPlugin, data: FormTemplate, container: HTMLElement, newContent: boolean) {
        this.app = app;
        this.plugin = plugin;
        this.data = data;
        this.container = container;
        this.pages = this.getAllPages();
        this.newContent = newContent;
    }

    getAllPages(): string[] {
        return this.app.vault.getMarkdownFiles().map(x => x.basename);
    }

    render() {
        //Clear the container
        this.container.empty();
        this.container.addClass('content-creator-view');

        //Create the scroll container
        this.formContainer = node('div', { class: 'form-scroll-container' });
        this.container.appendChild(this.formContainer);

        //Create content name input field
        const contentNameInput = node('input', {
            classes: ['content-name'],
            attributes: { 'type': 'text', 'value': this.data.name, 'placeholder': 'Enter a name' }
        });
        contentNameInput.disabled = !this.newContent;

        contentNameInput.addEventListener('input', (e) => this.updateContentName((e.target as HTMLInputElement).value));
        this.formContainer.appendChild(contentNameInput);

        // Reset required fields list
        this.requiredFields = [];

        //Build the form structure
        this.generateForm(this.formContainer, this.data.template, "template", 0);

        //Add action buttons
        const buttonContainer = node('div', { class: 'button-container' });
        this.container.appendChild(buttonContainer);

        new ButtonComponent(buttonContainer)
            .setButtonText('Cancel')
            .onClick(() => this.handleCancel());

        new ButtonComponent(buttonContainer)
            .setButtonText('Save')
            .setCta()
            .onClick(() => this.handleSubmit());
    }

    private generateForm(container: HTMLElement, data: any, path: string = '', deep: number) {
        Object.entries(data).forEach(([key, field]: [string, any]) => {
            const currentPath = path ? `${path}.${key}` : key;
            const fieldName = formatDisplayName(key);

            //Handle nested sections with group type
            if (isGroupType(field)) {
                const headerContainer = node('div', { class: `header-container` });
                // Create collapsible section container
                const sectionContainer = node('div', { class: `section-container` });
                
                // Create collapse/expand icon
                const collapseIcon = node('span', { class: 'collapse-icon', text: '▼' });
                headerContainer.appendChild(collapseIcon);
                
                headerContainer.appendChild(node('div', { class: `header-${deep}`, text: field.label || fieldName }));
                headerContainer.appendChild(node('div', { class: `header-separator-${deep} header-separator` }));

                container.appendChild(headerContainer);
                container.appendChild(sectionContainer);
                
                // Add collapse/expand functionality
                headerContainer.addEventListener('click', (e) => {
                    // Toggle section visibility
                    sectionContainer.style.display = 
                        sectionContainer.style.display === 'none' ? 'block' : 'none';
                    
                    // Toggle icon
                    collapseIcon.textContent = 
                        sectionContainer.style.display === 'none' ? '►' : '▼';
                });

                //Generate fields inside this group
                this.generateForm(sectionContainer, field.fields, currentPath + ".fields", deep + 1);
            } else if (hasValueAndType(field)) {
                //Handle field types
                const fieldContainer = node('div', { class: 'dynamic-form-field-container' });

                // Track required fields
                if (field.required === true) {
                    this.requiredFields.push(currentPath);
                    fieldContainer.classList.add('required-field');
                }

                if (field.type.startsWith("array")) {
                    //Create multi-value field (array type)
                    const multiField = new MultiValueField(this.app, fieldContainer)
                        .setName(fieldName + (field.required ? ' *' : ''))
                        .setType(field.type.split(':')[1])
                        .setValues(field.value as string[])
                        .onChange((newValues) => { 
                            this.updateData(currentPath, newValues); 
                            console.log(`Field ${currentPath} edited`);
                        })
                        .render();
                    this.multiValueFieldsMap.set(currentPath, multiField);
                } else if (field.type === "boolean") {
                    //Create toggle/checkbox for boolean values
                    const fieldLabel = node('div', { 
                        class: 'editor-label', 
                        text: fieldName + (field.required ? ' *' : '')
                    });
                    fieldContainer.appendChild(fieldLabel);
                    const toggleContainer = node('div', { class: 'toggle-container' });
                    fieldContainer.appendChild(toggleContainer);

                    new ToggleComponent(toggleContainer)
                        .setValue(field.value as boolean)
                        .onChange((value) => {
                            this.updateData(currentPath, value);
                            console.log(`Field ${currentPath} edited`);
                        });
                } else if (field.type === "dropdown") {
                    //Create dropdown field
                    const fieldLabel = node('div', { 
                        class: 'editor-label', 
                        text: fieldName + (field.required ? ' *' : '')
                    });
                    fieldContainer.appendChild(fieldLabel);
                    const dropdownContainer = node('div', { class: 'dropdown-container' });
                    fieldContainer.appendChild(dropdownContainer);

                    new DropdownComponent(this.app, dropdownContainer)
                        .setOptions(field.options || [])
                        .setAllowCustom(field.allowCustom || false)
                        .setValue(field.value || '')
                        .onChange((value) => { 
                            this.updateData(currentPath, value); 
                            console.log(`Field ${currentPath} edited`);
                        })
                        .render();
                } else if (field.type === "badges") {
                    //Create badges field
                    const fieldLabel = node('div', { 
                        class: 'editor-label', 
                        text: fieldName + (field.required ? ' *' : '')
                    });
                    fieldContainer.appendChild(fieldLabel);
                    const badgesContainer = node('div', { class: 'badges-container-wrapper' });
                    fieldContainer.appendChild(badgesContainer);

                    new BadgesComponent(this.app, badgesContainer)
                        .setOptions(field.options || [])
                        .setValues(field.value || [])
                        .onChange((values) => { 
                            this.updateData(currentPath, values); 
                            console.log(`Field ${currentPath} edited`);
                        })
                        .render();
                } else if (field.type === "image") {
                    //Create image field
                    const fieldLabel = node('div', { 
                        class: 'editor-label', 
                        text: fieldName + (field.required ? ' *' : '')
                    });
                    fieldContainer.appendChild(fieldLabel);
                    const imageContainer = node('div', { class: 'image-container' });
                    fieldContainer.appendChild(imageContainer);

                    new ImageComponent(this.app, imageContainer)
                        .setValue(field.value || '')
                        .onChange((value) => { 
                            this.updateData(currentPath, value); 
                            console.log(`Field ${currentPath} edited`);
                        })
                        .render();
                } else if (field.type === "date") {
                    //Create date field
                    const fieldLabel = node('div', { 
                        class: 'editor-label', 
                        text: fieldName + (field.required ? ' *' : '')
                    });
                    fieldContainer.appendChild(fieldLabel);
                    const dateContainer = node('div', { class: 'date-container' });
                    fieldContainer.appendChild(dateContainer);

                    new DateComponent(this.app, dateContainer)
                        .setValue(field.value || '')
                        .onChange((value) => { 
                            this.updateData(currentPath, value); 
                            console.log(`Field ${currentPath} edited`);
                        })
                        .render();
                } else {
                    //Create rich text editor for text/textarea
                    const fieldLabel = node('div', { 
                        class: 'editor-label', 
                        text: fieldName + (field.required ? ' *' : '')
                    });
                    fieldContainer.appendChild(fieldLabel);
                    fieldContainer.addClass(field.type);
                    const fieldEl = new RichTextEditor(this.app, this.pages);
                    fieldEl.createRichTextEditor(fieldContainer, field.value, field.type);
                    fieldEl.onChange(newValue => { 
                        this.updateData(currentPath, newValue); 
                        console.log(`Field ${currentPath} edited`);
                    });
                }

                container.appendChild(fieldContainer);
            }
        });
    }

    updateContentName(value: any) {
        this.data.name = value;
        console.log(`Content name edited to: ${value}`);
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

        // Validate required fields
        const missingRequired: string[] = [];
        
        // Check each required field
        for (const fieldPath of this.requiredFields) {
            const pathParts: string[] = fieldPath.split('.');
            let current: any = this.data;
            
            // Navigate to the field
            for (let i = 0; i < pathParts.length - 1; i++) {
                current = current[pathParts[i]];
            }
            
            const field = current[pathParts[pathParts.length - 1]];
            
            // Check if field value is empty
            const isEmpty = (
                field.value === null || 
                field.value === undefined || 
                field.value === "" || 
                (Array.isArray(field.value) && field.value.length === 0)
            );
            
            if (isEmpty) {
                missingRequired.push(formatDisplayName(pathParts[pathParts.length - 1]));
                
                // Highlight the missing field
                const fieldElements = document.querySelectorAll('.required-field');
                fieldElements.forEach(el => {
                    if (el.querySelector('.editor-label')?.textContent?.includes(formatDisplayName(pathParts[pathParts.length - 1]))) {
                        el.classList.add('missing-required');
                    }
                });
            }
        }
        
        // Show notice for missing required fields
        if (missingRequired.length > 0) {
            new Notice(`Please fill in the required fields: ${missingRequired.join(", ")}`);
            return;
        }

        const leaf = this.app.workspace.activeLeaf;
        if (!leaf) return;

        const file = await this.plugin.createContentFile(this.data);
        if (!file) return;

        await leaf.openFile(file, { state: { mode: 'preview' } });
    }

    handleCancel() {
        const leaf = this.app.workspace.activeLeaf;
        if (!leaf) return;

        if (this.data.name && this.data.defaultFolder) {
            const filePath = `${this.data.defaultFolder}/${this.data.name}.md`;
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (!file) return;
            leaf.openFile(file as TFile, { state: { mode: 'preview' } });

        } else {
            //Close the view
            const leaf = this.app.workspace.getLeaf(false);
            leaf.setViewState({ type: 'empty' });
        }
    }
}

class RichTextEditor {
    private app: App;
    private pages: string[];
    onChangeCb: (value: any) => void;

    constructor(app: App, pages: string[] = []) {
        this.app = app;
        this.pages = pages;
    }

    createRichTextEditor(container: HTMLElement, value: any, inputType: string) {
        const editorContainer = node('div', { class: 'editor-container' });
        const toolbar = node('div', { class: 'editor-toolbar editor-toolbar-hidden' });
        const contentArea = node('div', { class: 'editor-content' });

        let processedContent = value;

        const editor = new Editor({
            element: contentArea,
            extensions: [
                StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
                TextStyle.configure({}),
                Color,
            ],
            content: processedContent ? processedContent : Array(inputType == 'textarea' ? 5 : 1).fill('<p></p>').join(''),
            onUpdate: ({ editor }) => {
                const content = editor.getHTML();
                this.onChangeCb(content);
            }
        });

        //Create formatting buttons
        const boldButton = node('button', { class: 'editor-button', text: 'B', attributes: { 'title': 'Bold', 'type': 'button' } });
        boldButton.addEventListener('click', () => { editor.chain().focus().toggleBold().run(); });

        const italicButton = node('button', { class: 'editor-button', text: 'I', attributes: { 'title': 'Italic', 'type': 'button', 'style': 'font-style:italic' } });
        italicButton.addEventListener('click', () => { editor.chain().focus().toggleItalic().run(); });

        const strikeButton = node('button', { class: 'editor-button', text: 'S', attributes: { 'title': 'Strikethrough', 'type': 'button', 'style': 'text-decoration:line-through' } });
        strikeButton.addEventListener('click', () => { editor.chain().focus().toggleStrike().run(); });

        //Color picker with hidden input
        const colorContainer = node('div', { class: 'editor-color-container' });
        const colorButton = node('button', { class: 'editor-button', text: 'A', attributes: { 'title': 'Text Color', 'type': 'button' } });
        const colorInput = node('input', { class: 'editor-color-input', attributes: { type: 'color', title: 'Pick Text Color', value: getComputedStyle(document.body).getPropertyValue('--text-normal') } });

        colorInput.addEventListener('input', (event: any) => {
            const selectedColor = event.target.value;
            colorButton.style.color = selectedColor;
            editor.chain().focus().setColor(selectedColor).run();
        });
        colorButton.style.color = '#ffffff';
        colorButton.addEventListener('click', () => { colorInput.click(); });

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
        if (inputType == "textarea") {
            //Heading dropdown
            const headingDropdown = document.createElement('select');
            headingDropdown.className = 'editor-heading-select';
            headingDropdown.title = 'Heading Level';

            const headingLevels = [{ level: 0, name: 'Normal' }, { level: 1, name: 'Title 1' }, { level: 2, name: 'Title 2' }, { level: 3, name: 'Title 3' }];
            headingLevels.forEach(heading => {
                const option = document.createElement('option');
                option.value = heading.level.toString();
                option.textContent = heading.name;
                headingDropdown.appendChild(option);
            });
            headingDropdown.value = '0';

            headingDropdown.addEventListener('change', () => {
                const selectedLevel = parseInt(headingDropdown.value);
                if (selectedLevel === 0) {
                    editor.chain().focus().setParagraph().run();
                } else {
                    editor.chain().focus().setHeading({ level: selectedLevel as 1 | 2 | 3 }).run();
                }
            });

            //Update dropdown when editor selection changes
            editor.on('transaction', () => {
                if (editor.isActive('heading')) {
                    const currentLevel = editor.getAttributes('heading').level;
                    headingDropdown.value = currentLevel.toString();
                } else {
                    headingDropdown.value = '0';
                }
            });

            //List formatting buttons
            bulletListButton = node('button', { class: 'editor-button', text: '•', attributes: { 'title': 'Bullet List', 'type': 'button' } });
            bulletListButton.addEventListener('click', () => {
                editor.chain().focus().toggleBulletList().run();
                bulletListButton.classList.toggle('is-active', editor.isActive('bulletList'));
            });

            numberedListButton = node('button', { class: 'editor-button', text: '#', attributes: { 'title': 'Numbered List', 'type': 'button' } });
            numberedListButton.addEventListener('click', () => {
                editor.chain().focus().toggleOrderedList().run();
                numberedListButton.classList.toggle('is-active', editor.isActive('orderedList'));
            });

            toolbar.appendChild(headingDropdown);
            toolbar.appendChild(bulletListButton);
            toolbar.appendChild(numberedListButton);
        }

        //Update button states based on current formatting
        editor.on('transaction', () => {
            boldButton.classList.toggle('is-active', editor.isActive('bold'));
            italicButton.classList.toggle('is-active', editor.isActive('italic'));
            strikeButton.classList.toggle('is-active', editor.isActive('strike'));

            if (inputType == "textarea") {
                bulletListButton.classList.toggle('is-active', editor.isActive('bulletList'));
                numberedListButton.classList.toggle('is-active', editor.isActive('orderedList'));
            }

            if (editor.isActive('textStyle')) {
                const currentColor = editor.getAttributes('textStyle').color;
                if (currentColor) {
                    colorButton.style.color = currentColor;
                    colorInput.value = currentColor;
                }
            }
        });

        //Show toolbar on focus
        editor.on('focus', () => { toolbar.classList.remove('editor-toolbar-hidden'); });

        //Hide toolbar on blur (except when clicking toolbar itself)
        editor.on('blur', () => {
            setTimeout(() => {
                if (!editorContainer.contains(document.activeElement)) {
                    toolbar.classList.add('editor-toolbar-hidden');
                }
            }, 100);
        });

        new SuggestComponent(this.app, contentArea).setSuggestList(this.pages);
    }

    onChange(cb: (value: any) => void) {
        this.onChangeCb = cb;
        return this;
    }
}