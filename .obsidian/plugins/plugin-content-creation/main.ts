import { App, Plugin, TFile, Notice, WorkspaceLeaf, setIcon, ItemView } from 'obsidian';
import { DynamicFormView } from './DynamicFormView';
import { ContentSelectorModal } from './ContentSelectorModal';
import { node, formatDisplayName, FormTemplate, getTemplates, convertLinks, generateUUID, getFormattedDateForInput } from './utils';



import './styles/ContentSelectorModal.css';
import './styles/DropdownComponent.css';
import './styles/BadgesComponent.css';
import './styles/ImageComponent.css';
import './styles/FolderSelector.css';
import './styles/MultiValue.css';
import './styles/Styles.css';


// Define the view type
const VIEW_TYPE_CONTENT_CREATOR = "content-creator-view";


class EditContentButtons {
    private containerEl: HTMLElement;
    private plugin: ContentCreatorPlugin;
    private leaf: any;

    constructor(app: App, plugin: ContentCreatorPlugin, leaf: any) {
        this.plugin = plugin;
        this.leaf = leaf;
        this.containerEl = this.leaf.actionsEl

        try {
            //Try delete button
            this.leaf.actionsEl.querySelector("#editContent").remove()
        } catch (error) { }

        //Check if leaf has the property data
        if (this.leaf.metadataEditor && this.leaf.metadataEditor.properties.filter((x: any) => x.key == "data").length == 0) return

        //Button
        const formButton = document.createElement('button');
        formButton.id = "editContent"
        formButton.className = 'clickable-icon view-action';
        formButton.setAttribute('aria-label', 'Edit Content');
        formButton.addEventListener('click', () => { this.plugin.editExistingContent(this.leaf.file as TFile); });
        setIcon(formButton, 'file-pen-line');

        this.containerEl.insertBefore(formButton, this.containerEl.firstChild);
    }

    public destroy() {
        if (this.containerEl && this.containerEl.parentNode) {
            this.containerEl.remove();
        }
    }
}

export class ContentCreatorView extends ItemView {
    private plugin: ContentCreatorPlugin;
    private contentData: FormTemplate;
    private formView: DynamicFormView;
    public filePath: string | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: ContentCreatorPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_CONTENT_CREATOR;
    }

    getDisplayText(): string {
        return "Content Creator";
    }

    updateContent(contentData: FormTemplate, filePath: string | null = null) {
        this.containerEl.addClass("content-creator-container");
        this.contentData = contentData;
        this.filePath = filePath;
        this.contentEl.empty();

        const wrapper = node('div', { class: 'content-creator-wrapper' });
        this.contentEl.appendChild(wrapper);

        this.formView = new DynamicFormView(this.app, this.plugin, this.contentData, wrapper, filePath);
        this.formView.render();
    }

}

export default class ContentCreatorPlugin extends Plugin {
    templates: { [key: string]: FormTemplate };
    private activeView: ContentCreatorView | null = null;
    private filePath: string | null = null;

    async onload() {
        console.log("loading " + this.manifest.name + " plugin: v" + this.manifest.version)

        //Register view
        this.registerView(
            VIEW_TYPE_CONTENT_CREATOR,
            (leaf: WorkspaceLeaf) => {
                this.activeView = new ContentCreatorView(leaf, this);
                return this.activeView;
            }
        );

        //Templates
        this.templates = getTemplates();

        //Commands
        this.addRibbonIcon('file-plus', 'Create Content', (evt: MouseEvent) => {
            new ContentSelectorModal(this.app, this).open();
        });

        //Button on page itself
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                const currentFileView = (this.app.workspace as any).getActiveFileView()
                if (currentFileView != null) new EditContentButtons(this.app, this, currentFileView);
            })
        );

        //Register file rename event to update links
        this.registerEvent(
            this.app.vault.on('rename', (file: TFile, oldPath: string) => {
                console.log("Rename file");
            })
        );


        // //Reload images
        // this.registerEvent(
        //     this.app.workspace.on('file-open', (file: TFile) => {
        //         if (!file || file.extension !== 'md') return;
        //         console.log("file open && md");

        //         console.log(document.querySelectorAll('img[data-path]'));
        //         document.querySelectorAll('img[data-path]').forEach((img) => {
        //             console.log(`Refreshing image ${img.getAttribute('data-path')}`);
        //             const path = img.getAttribute('data-path');
        //             if (!path) return;

        //             try {
        //                 const imageFile = this.app.vault.getAbstractFileByPath(path);
        //                 if (imageFile instanceof TFile) { img.setAttribute('src', this.app.vault.getResourcePath(imageFile)); }
        //             } catch (e) {
        //                 console.warn(`Failed to refresh image ${path}:`, e);
        //             }
        //         });
        //     })
        // );




        //Close all openened plugin view form
        this.app.workspace.onLayoutReady(() => {
            this.app.workspace.getLeavesOfType(VIEW_TYPE_CONTENT_CREATOR).forEach(leaf => leaf.detach());
        });
    }

    async activateView(contentData: FormTemplate, filePath: string | null = null) {
        const leaf = this.app.workspace.getLeaf();
        this.filePath = filePath;

        await leaf.setViewState({
            type: VIEW_TYPE_CONTENT_CREATOR,
            active: true
        })

        if (leaf.view) {
            (leaf.view as ContentCreatorView).updateContent(contentData, filePath);
            this.activeView = leaf.view as ContentCreatorView;
        }
    }

    createNewContent(contentType: string) {
        //Get templates
        let result = JSON.parse(JSON.stringify(this.templates[contentType as keyof typeof this.templates]));
        //Fill data
        result.name = `New (${contentType.charAt(0).toUpperCase() + contentType.slice(1)})`;
        result.contentType = contentType;
        result.id = generateUUID();
        //Create form
        this.activateView(result);
    }


    async editExistingContent(file: TFile) {
        //Get data
        const data = this.getFileProperties(this.app, file)?.data;
        //Get templates
        const template = this.templates[data.contentType];
        //Fill data
        const result = { ...template, template: this.fillTemplateWithData(template.template, data.template) };
        //Update name if file was renamed
        result.name = file.basename;
        result.contentType = data.contentType;
        result.id = data.id;
        //Create form
        this.activateView(result, file.path);
    }

    fillTemplateWithData(template: any, data: any) {
        const result = JSON.parse(JSON.stringify(template));
        function fill(templateObj: any, dataObj: any) {
            if (!templateObj || !dataObj) return templateObj;
            for (const key in templateObj) {
                if (!dataObj.hasOwnProperty(key)) continue;

                if (templateObj[key].type) {
                    //Group
                    if (templateObj[key].type === "group") {
                        fill(templateObj[key].fields, dataObj[key].fields);
                    } else {
                        //Other field
                        if (templateObj[key].type === "date")
                            templateObj[key].value = getFormattedDateForInput(dataObj[key].value);
                        else
                            templateObj[key].value = dataObj[key].value;
                    }

                }
            }
            return templateObj;
        }
        return fill(result, data);
    }

    getFileProperties(app: App, file: TFile) {
        const cache = app.metadataCache.getFileCache(file);
        if (cache && cache.frontmatter) return cache.frontmatter;
        return null;
    }

    async createContentFile(data: any, folderPath: string = "/") {
        try {
            let filePath = this.activeView?.filePath;
            if (!filePath) {
                filePath = folderPath === "/" ? `/${data.name}.md` : `${folderPath}/${data.name}.md`;
            }

            let file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
            const fileContent = this.generateFileContent(data, file);

            if (file) {
                await this.app.vault.modify(file, fileContent);
            } else {
                if (folderPath !== "/" && !this.app.vault.getAbstractFileByPath(folderPath)) {
                    await this.app.vault.createFolder(folderPath);
                }
                file = await this.app.vault.create(filePath, fileContent);
            }

            new Notice(`Saved : ${data.name}`);
            return file;
        } catch (error) {
            console.error("Error creating content:", error);
            new Notice(`Error creating content: ${error.message}`);
            return null;
        }
    }

    private generateFileContent(data: FormTemplate, existingFile?: TFile): string {
        const contentTypeTag = data.contentType.charAt(0).toUpperCase() + data.contentType.slice(1);

        const newData = {
            id: data.id || generateUUID(),
            contentType: data.contentType,
            name: data.name,
            template: data.template,
        };

        let content = "";
        content += `---\n\n`;
        content += `data: ${JSON.stringify(newData)}\n\n`;
        content += `needRefresh: false\n\n`;
        content += `---\n\n`;

        content += `#${contentTypeTag}\n\n`;

        content += this.formatContentData(data.template, 3, "template").innerHTML;
        return content;
    }

    //Helper function to convert a type of field to html
    private getTextField(value: string): HTMLElement {
        const element = node('div', { class: 'field-value text-value' });
        element.innerHTML = convertLinks(value);
        return element;
    }

    private getTextAreaField(value: string): HTMLElement | null {
        if (!String(value).trim()) return null;

        const container = node('div', { class: 'field-value' });
        const textareaContent = node('div', { class: 'content-creation-textarea' });

        const paragraphs = value.split("<p></p>").map(item =>
            item.trim() === "" ? "<br>" : convertLinks(item)
        );
        textareaContent.innerHTML = paragraphs.join("<br>");

        container.appendChild(textareaContent);
        return container;
    }

    private getTextArray(values: string[]): HTMLElement {
        const container = node('nav', { class: 'field-value array-container' });

        values.forEach(item => {
            const listItem = node('li', { class: 'array-item text-item' });
            listItem.innerHTML = convertLinks(item);
            container.appendChild(listItem);
        });
        return container;
    }

    private getTextAreaArray(values: string[]): HTMLElement {
        const container = node('nav', { class: 'field-value array-container' });

        values.forEach(item => {
            const textareaItem = node('div', { class: 'array-item textarea-item content-creation-textarea' });
            const paragraphs = item.split("<p></p>").map(subItem =>
                subItem.trim() === "" ? "<br>" : convertLinks(subItem)
            );
            textareaItem.innerHTML = paragraphs.join("<br>");
            container.appendChild(textareaItem);
        });
        return container;
    }

    private getImageUrl(path: string): string {
        if (!path) return '';
        try {
            const file = this.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) return this.app.vault.getResourcePath(file);
        } catch (e) {
            console.warn("Could not get resource path for image:", e);
        }
        return path;
    }

    private getImageField(value: string): HTMLElement {
        const container = node('div', { class: 'field-value image-value' });

        if (value) {
            try {
                const imgPath = value;
                const img = node('img', { attributes: { src: imgPath, alt: 'Image', 'data-path': value } });
                img.addEventListener('error', () => {
                    container.empty();
                    container.textContent = `Image not found: ${value}`;
                    container.classList.add('image-error');
                });

                container.appendChild(img);
            } catch (error) {
                container.textContent = `Error displaying image: ${error.message}`;
                container.classList.add('image-error');
            }
        } else {
            container.textContent = 'No image';
        }

        return container;
    }

    private formatContentData(data: any, depth: number, path: string = ''): HTMLElement {
        const contentContainer = node('div', { class: 'content-container' });

        Object.entries(data).forEach(([key, field]: [string, any]) => {
            const currentPath = path ? `${path}.${key}` : key;
            const displayName = formatDisplayName(key);

            //Handle group type
            if (field.type === "group") {
                const sectionHeader = node(('h' + depth as "h1" | "h2" | "h3"), { class: 'section-header', text: field.label || displayName });
                const sectionContent = node('div', { class: 'section-content' });
                sectionContent.appendChild(this.formatContentData(field.fields, depth + 1, currentPath + ".fields"));

                const section = node('div', { class: `section level-${depth}`, children: [sectionHeader, sectionContent] });
                contentContainer.appendChild(section);
                contentContainer.appendChild(node('div', { class: 'section-separator' }));

            } else {
                const isEmpty = (
                    field.value === null ||
                    field.value === undefined ||
                    field.value.toString().trim() === "" ||
                    (Array.isArray(field.value) && field.value.length === 0)
                );
                if (isEmpty) return;

                const fieldContainer = node('div', { class: `field-container` });
                fieldContainer.appendChild(node('div', { class: 'field-label', text: `${displayName} : ` }));

                let fieldValueElement: HTMLElement | null = null;

                if (field.type.startsWith("array")) {
                    const fieldType = field.type.split(':')[1];
                    let values = field.value || [];
                    if (values.length === 0) return;

                    fieldContainer.classList.add(`field-type-${values.length <= 1 ? fieldType : field.type}`);

                    //Text areas
                    if (fieldType === "textarea") {
                        if (values.length <= 1) {
                            fieldValueElement = this.getTextAreaField(values[0] || "");
                        } else {
                            fieldValueElement = this.getTextAreaArray(values);
                        }
                        //Text
                    } else {
                        if (values.length <= 1) {
                            fieldValueElement = this.getTextField(values[0] || "");
                        } else {
                            fieldValueElement = this.getTextArray(values);
                        }
                    }

                } else if (field.type === "textarea") {
                    fieldContainer.classList.add(`field-type-${field.type}`);
                    fieldValueElement = this.getTextAreaField(field.value);

                } else if (field.type === "boolean") {
                    fieldContainer.classList.add(`field-type-${field.type}`);
                    const checkboxContainer = node('div', { class: 'field-value' });
                    const checkbox = node('input', { attributes: { type: 'checkbox', disabled: 'true' } }) as HTMLInputElement;

                    if (field.value) checkbox.setAttr("checked", "checked");

                    checkboxContainer.appendChild(checkbox);
                    fieldValueElement = checkboxContainer;

                } else if (field.type === "dropdown") {
                    fieldContainer.classList.add(`field-type-${field.type}`);
                    const dropdownDisplay = node('div', { class: 'field-value dropdown-value' });
                    dropdownDisplay.textContent = field.value || '';
                    fieldValueElement = dropdownDisplay;

                } else if (field.type === "badges") {
                    fieldContainer.classList.add(`field-type-${field.type}`);
                    const badgesContainer = node('div', { class: 'field-value badges-value' });

                    (field.value || []).forEach((badge: string) => {
                        const badgeElement = node('span', { class: 'badge-item', text: badge });
                        badgesContainer.appendChild(badgeElement);
                    });
                    fieldValueElement = badgesContainer;

                } else if (field.type === "image") {
                    fieldContainer.classList.add(`field-type-${field.type}`);
                    fieldValueElement = this.getImageField(field.value);

                } else if (field.type === "date") {
                    fieldContainer.classList.add(`field-type-${field.type}`);
                    const dateValue = node('div', { class: 'field-value date-value' });
                    dateValue.textContent = (field.value == '') ? '-' : new Date(field.value).toLocaleDateString("fr-FR");
                    fieldValueElement = dateValue;

                } else if (String(field.value).trim()) {
                    fieldContainer.classList.add(`field-type-${field.type}`);
                    fieldValueElement = this.getTextField(field.value);
                }

                if (fieldValueElement) {
                    fieldContainer.appendChild(fieldValueElement);
                    contentContainer.appendChild(fieldContainer);
                }
            }
        });

        return contentContainer;
    }

    onunload() {
        console.log("unloading plugin");
    }
}