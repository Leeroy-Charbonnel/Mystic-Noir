import { App, ButtonComponent, ToggleComponent, Notice, TFile } from 'obsidian';
import ContentCreatorPlugin from './main';
import { node, formatDisplayName, FormTemplate } from './utils';


import { MultiValueField } from './components/MultiValueField';
import { DropdownComponent } from 'components/DropdownComponent';
import { BadgesComponent } from 'components/BadgesComponent';
import { ImageComponent } from 'components/ImageComponent';
import { DateComponent } from 'components/DateComponent';
import { FolderSelectorModal } from 'FolderSelectorModal';
import { RichTextEditor } from 'RichTextEditor';


export class DynamicFormView {
    private app: App;
    private plugin: ContentCreatorPlugin;
    private data: FormTemplate;
    private container: HTMLElement;
    private newContent: boolean;
    private filePath: string | null;

    private formContainer: HTMLElement;
    private pages: string[];
    private requiredFields: string[] = [];

    constructor(app: App, plugin: ContentCreatorPlugin, data: FormTemplate, container: HTMLElement, filePath: string | null = null) {
        this.app = app;
        this.plugin = plugin;
        this.data = data;
        this.container = container;
        this.pages = this.getAllPages();
        this.newContent = filePath == null;
        this.filePath = filePath;
    }

    getAllPages(): string[] {
        return this.app.vault.getMarkdownFiles().map(x => x.basename);
    }

    render() {
        //Clear the container
        this.container.empty();
        this.container.addClass('content-creator-view');

        //Create the form scroll container
        this.formContainer = node('div', { class: 'form-scroll-container' });

        //Create content name input field
        const contentNameInput = node('input', {
            classes: ['content-name'],
            attributes: { 'type': 'text', 'value': this.data.name, 'placeholder': 'Enter a name' }
        }) as HTMLInputElement;

        //Name edition available only if new content
        contentNameInput.disabled = !this.newContent;
        contentNameInput.addEventListener('input', (e) => this.updateContentName((e.target as HTMLInputElement).value));

        this.formContainer.appendChild(contentNameInput);
        this.container.appendChild(this.formContainer);

        //Reset required fields
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
            if (field.type === 'group') {
                const sectionContainer = node('div', { class: `section-container` });
                const headerContainer = node('div', { class: `header-container` });
                const contentContainer = node('div', { class: `content-container` });

                //Header container
                headerContainer.appendChild(node('div', { class: `header-label header-${deep}`, text: field.label || fieldName }));
                headerContainer.appendChild(node('div', { class: `header-separator header-separator-${deep}` }));


                headerContainer.addEventListener('click', (e) => {
                    const contentHeight = contentContainer.offsetHeight;
                    const isCollapsed = sectionContainer.classList.contains('collapsed');

                    contentContainer.style.overflow = 'hidden';

                    if (isCollapsed) {
                        contentContainer.style.height = 'auto';
                        const expandedHeight = contentContainer.offsetHeight;
                        contentContainer.style.height = '0';
                        contentContainer.offsetHeight; //force reflow
                        setTimeout(() => {
                            contentContainer.style.height = expandedHeight + 'px';
                            setTimeout(() => {
                                contentContainer.style.height = 'auto';
                                contentContainer.style.overflow = '';

                            }, 300);
                        }, 10);
                    } else {
                        contentContainer.style.height = contentHeight + 'px';
                        contentContainer.offsetHeight; //force reflow
                    }

                    sectionContainer.classList.toggle('collapsed');

                    if (!isCollapsed) {
                        contentContainer.style.height = '0';
                    }
                });


                //Section container
                sectionContainer.appendChild(headerContainer);
                sectionContainer.appendChild(contentContainer);

                container.appendChild(sectionContainer);

                this.generateForm(contentContainer, field.fields, currentPath + ".fields", deep + 1);
            } else {
                const fieldContainer = node('div', { class: 'dynamic-form-field-container' });

                //Required fields
                if (field.required === true) {
                    this.requiredFields.push(currentPath);
                    fieldContainer.classList.add('required-field');
                }

                if (field.type.startsWith("array")) {
                    new MultiValueField(this.app, fieldContainer)
                        .setName(fieldName)
                        .setType(field.type.split(':')[1])
                        .setValues(field.value as string[])
                        .onChange((newValues) => { this.updateData(currentPath, newValues); })
                        .render();

                } else if (field.type === "boolean") {
                    fieldContainer.addClass(field.type);
                    this.addFieldLabel(fieldName, fieldContainer);
                    const toggleContainer = node('div', { class: 'toggle-container' });
                    fieldContainer.appendChild(toggleContainer);

                    new ToggleComponent(toggleContainer)
                        .setValue(field.value as boolean)
                        .onChange((value) => { this.updateData(currentPath, value); });

                } else if (field.type === "dropdown") {
                    this.addFieldLabel(fieldName, fieldContainer);
                    const dropdownContainer = node('div', { class: 'dropdown-container' });
                    fieldContainer.appendChild(dropdownContainer);

                    new DropdownComponent(dropdownContainer)
                        .setOptions(field.options)
                        .setAllowCustom(field.allowCustom || false)
                        .setValue(field.value)
                        .onChange((value) => { this.updateData(currentPath, value); })
                        .render();

                } else if (field.type === "badges") {
                    this.addFieldLabel(fieldName, fieldContainer);

                    const badgesContainer = node('div', { class: 'badges-container-wrapper' });
                    fieldContainer.appendChild(badgesContainer);

                    new BadgesComponent(badgesContainer)
                        .setOptions(field.options)
                        .setValues(field.value)
                        .onChange((values) => { this.updateData(currentPath, values); })
                        .render();

                } else if (field.type === "image") {
                    fieldContainer.addClass(field.type);
                    this.addFieldLabel(fieldName, fieldContainer);

                    const imageContainer = node('div', { class: 'image-container' });
                    fieldContainer.appendChild(imageContainer);

                    new ImageComponent(this.app, imageContainer)
                        .setValue(field.value || '')
                        .onChange((value) => { this.updateData(currentPath, value); })
                        .render();

                } else if (field.type === "date") {
                    this.addFieldLabel(fieldName, fieldContainer);

                    const dateContainer = node('div', { class: 'date-container' });
                    fieldContainer.appendChild(dateContainer);

                    new DateComponent(dateContainer)
                        .setValue(field.value)
                        .onChange((value) => { this.updateData(currentPath, value); })
                        .render();

                } else {
                    //Text & textarea
                    this.addFieldLabel(fieldName, fieldContainer);
                    fieldContainer.addClass(field.type);
                    const fieldEl = new RichTextEditor(this.app, this.pages);
                    fieldEl.createRichTextEditor(fieldContainer, field.value, field.type);
                    fieldEl.onChange(newValue => { this.updateData(currentPath, newValue); });
                }

                container.appendChild(fieldContainer);
            }
        });
    }

    addFieldLabel(fieldName: string, container: HTMLElement) {
        const fieldLabel = node('div', {
            class: 'editor-label',
            text: fieldName
        });
        container.appendChild(fieldLabel);
    }
    updateContentName(value: any) {
        this.data.name = value;
    }

    updateData(path: string, value: any) {
        // console.log(`Field ${path} edited`);
        const pathParts: string[] = path.split('.');
        let current: any = this.data;
        for (let i = 0; i < pathParts.length - 1; i++) {
            current = current[pathParts[i]];
        }
        current[pathParts[pathParts.length - 1]].value = value;
    }


    // Replace the handleSubmit method in DynamicFormView class
    async handleSubmit() {
        let missingField: boolean = false;

        for (const fieldPath of this.requiredFields) {
            const pathParts: string[] = fieldPath.split('.');
            let current: any = this.data;

            //Get field
            for (let i = 0; i < pathParts.length - 1; i++) current = current[pathParts[i]];
            const fieldName = pathParts[pathParts.length - 1];
            const field = current[fieldName];

            const isEmpty = (
                field.value === null ||
                field.value === undefined ||
                field.value.trim() === "" ||
                (Array.isArray(field.value) && field.value.length === 0)
            );

            if (isEmpty) {
                missingField = true;

                const fieldElements = document.querySelectorAll('.required-field');
                fieldElements.forEach(el => {
                    if (el.querySelector('.editor-label')?.textContent?.includes(formatDisplayName(fieldName))) el.classList.add('missing-required');
                });
            }
        }

        if (missingField) {
            new Notice(`Please fill in the required fields`);
            return;
        }
        const leaf = this.app.workspace.activeLeaf;
        if (!leaf) return;

        if (this.newContent) {
            //Ask for folder
            new FolderSelectorModal(this.app, async (folderPath) => {
                const file = await this.plugin.createContentFile(this.data, folderPath + '/' + this.data.name + '.md');
                if (!file) return;

                await leaf.openFile(file, { state: { mode: 'preview' } });
            }).open();

        } else {
            const file = await this.plugin.createContentFile(this.data, this.filePath!);
            if (!file) return;
            await leaf.openFile(file, { state: { mode: 'preview' } });
            return;
        }
    }




    handleCancel() {
        const leaf = this.app.workspace.getMostRecentLeaf();
        if (!leaf) return;

        if (this.newContent) {
            leaf.setViewState({ type: 'empty' });
        }
        else {
            const file = this.app.vault.getAbstractFileByPath(this.filePath!);
            leaf.openFile(file as TFile, { state: { mode: 'preview' } });
        }
    }
}
