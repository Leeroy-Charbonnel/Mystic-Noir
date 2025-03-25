import { App, Plugin, PluginSettingTab, Setting, TFile, normalizePath, Notice, TFolder, Menu, MenuItem, FileManager, SuggestModal, WorkspaceLeaf, setIcon, ViewStateResult, ItemView } from 'obsidian';
import { DynamicFormView } from './DynamicFormView';
import { ContentSelectorModal } from './contentSelectorModal';
import { node, formatDisplayName, FormTemplate, getTemplates, hasValueAndType, convertLinks, generateUUID } from './utils';
import './styles.css';

// Define the view type
const VIEW_TYPE_CONTENT_CREATOR = "content-creator-view";

class ContentCreatorSettingTab extends PluginSettingTab {
    plugin: ContentCreatorPlugin;

    constructor(app: App, plugin: ContentCreatorPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Content Creator Settings' });
        containerEl.createEl('p', { text: 'All content will be created in the root directory by default.' });
    }
}

interface ContentCreatorPluginSettings {
    // We're keeping this interface for backward compatibility
    defaultFolders: { [key: string]: string }
}

const DEFAULT_SETTINGS: ContentCreatorPluginSettings = {
    defaultFolders: {}
}

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
    private filePath: string | null = null;

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

    updateContent(contentData: FormTemplate, newContent: boolean, filePath: string | null = null) {
        this.containerEl.addClass("content-creator-container");
        this.contentData = contentData;
        this.filePath = filePath;
        this.contentEl.empty();

        const wrapper = node('div', { class: 'content-creator-wrapper' });
        this.contentEl.appendChild(wrapper);

        this.formView = new DynamicFormView(this.app, this.plugin, this.contentData, wrapper, newContent);
        this.formView.render();
    }
}

export default class ContentCreatorPlugin extends Plugin {
    settings: ContentCreatorPluginSettings;
    templates: { [key: string]: FormTemplate };
    private activeView: ContentCreatorView | null = null;

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

        //Settings
        await this.loadSettings();
        this.addSettingTab(new ContentCreatorSettingTab(this.app, this));

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

        // Register file rename event to update links
        this.registerEvent(
            this.app.vault.on('rename', (file: TFile, oldPath: string) => {
                this.updateLinksAfterRename(file, oldPath);
            })
        );
        
        // Check for needRefresh on file open
        this.registerEvent(
            this.app.workspace.on('file-open', async (file: TFile) => {
                if (file && file.extension === 'md') {
                    await this.checkAndRefreshContent(file);
                }
            })
        );
    }

    private async updateLinksAfterRename(file: TFile, oldPath: string) {
        // Only process markdown files
        if (file.extension !== 'md') return;
        
        const allFiles = this.app.vault.getMarkdownFiles();
        
        for (const contentFile of allFiles) {
            try {
                const metadata = this.getFileProperties(this.app, contentFile);
                if (!metadata || !metadata.data || !metadata.data.contentType) continue;
                
                let contentChanged = false;
                const contentData = metadata.data;
                
                // Check if any links need updating
                const processObject = (obj: any): boolean => {
                    let changed = false;
                    
                    if (!obj) return changed;
                    
                    if (typeof obj === 'string' && obj.includes('[[')) {
                        // This is a potential link
                        const regex = /\[\[(.*?)(?:#(.*?))?\]\]/g;
                        let match;
                        
                        const newContent = obj.replace(regex, (match, linkPath, linkId) => {
                            if (linkPath === oldPath.replace('.md', '') || 
                                linkPath === file.basename) {
                                changed = true;
                                return `[[${file.basename}#${linkId}]]`;
                            }
                            return match;
                        });
                        
                        if (changed) {
                            return true;
                        }
                    }
                    
                    if (typeof obj === 'object') {
                        if (Array.isArray(obj)) {
                            for (let i = 0; i < obj.length; i++) {
                                if (processObject(obj[i])) {
                                    changed = true;
                                }
                            }
                        } else {
                            for (const key in obj) {
                                if (processObject(obj[key])) {
                                    changed = true;
                                }
                            }
                        }
                    }
                    
                    return changed;
                };
                
                contentChanged = processObject(contentData.template);
                
                if (contentChanged) {
                    // Set needRefresh flag and save the file
                    metadata.needRefresh = true;
                    await this.app.vault.modify(
                        contentFile,
                        contentFile.content.replace(
                            /^---\n([\s\S]*?)\n---/,
                            `---\n${Object.entries(metadata).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---`
                        )
                    );
                }
            } catch (error) {
                console.error(`Error updating links in ${contentFile.path}:`, error);
            }
        }
    }
    
    private async checkAndRefreshContent(file: TFile) {
        try {
            const metadata = this.getFileProperties(this.app, file);
            if (!metadata || !metadata.data || !metadata.needRefresh) return;
            
            // Regenerate the content
            const contentData = metadata.data;
            const fileContent = this.regenerateFileContent(file, contentData);
            
            // Update the file with regenerated content and set needRefresh to false
            metadata.needRefresh = false;
            
            const newContent = file.content.replace(
                /^---\n([\s\S]*?)\n---\n\n([\s\S]*)/,
                `---\n${Object.entries(metadata).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n\n${fileContent}`
            );
            
            await this.app.vault.modify(file, newContent);
            
        } catch (error) {
            console.error(`Error refreshing content for ${file.path}:`, error);
        }
    }
    
    private regenerateFileContent(file: TFile, data: any): string {
        const contentTypeTag = data.contentType.charAt(0).toUpperCase() + data.contentType.slice(1);
        
        let content = `#${contentTypeTag}\n\n`;
        content += this.formatContentData(data.template, 3, "template").innerHTML;
        return content;
    }


    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async activateView(contentData: FormTemplate, newContent: boolean, filePath: string | null = null) {
        const leaf = this.app.workspace.getLeaf();

        await leaf.setViewState({
            type: VIEW_TYPE_CONTENT_CREATOR,
            active: true
        })

        if (leaf.view) {
            (leaf.view as ContentCreatorView).updateContent(contentData, newContent, filePath);
            this.activeView = leaf.view as ContentCreatorView;
        }
    }

    openFormForContentType(contentType: string) {
        let result = JSON.parse(JSON.stringify(this.templates[contentType as keyof typeof this.templates]));
        result.name = `New (${contentType.charAt(0).toUpperCase() + contentType.slice(1)})`;
        // New content doesn't have a folder - will save to root
        this.activateView(result, true);
    }


    async editExistingContent(file: TFile) {
        const data = this.getFileProperties(this.app, file)?.data;
        const template = this.templates[data.contentType];
        const result = this.fillTemplateWithData(template, data);
        result.name = file.basename;
        this.activateView(result, false, file.path);
    }

    fillTemplateWithData(template: any, data: any) {
        const result = JSON.parse(JSON.stringify(template));
        function fill(templateObj: any, dataObj: any) {
            if (!dataObj) return templateObj;

            for (const key in templateObj) {
                if (dataObj.hasOwnProperty(key)) {
                    if (typeof templateObj[key] === 'object' && templateObj[key] != null) {
                        templateObj[key] = fill(templateObj[key], dataObj[key]);
                    }
                    else {
                        templateObj[key] = dataObj[key];
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

    // Function to extract only values from template data
    private extractValuesOnly(data: any): any {
        if (!data) return null;
        
        if (Array.isArray(data)) {
            return data.map(item => this.extractValuesOnly(item));
        }
        
        if (typeof data === 'object') {
            // If it has value and type properties, just return the value
            if (hasValueAndType(data)) {
                return data.value;
            }
            
            // If it's a group, process its fields
            if (data.type === 'group' && data.fields) {
                const result: any = {
                    type: 'group'
                };
                
                if (data.label) {
                    result.label = data.label;
                }
                
                result.fields = {};
                for (const key in data.fields) {
                    result.fields[key] = this.extractValuesOnly(data.fields[key]);
                }
                
                return result;
            }
            
            // Process other objects recursively
            const result: any = {};
            for (const key in data) {
                result[key] = this.extractValuesOnly(data[key]);
            }
            
            return result;
        }
        
        // Return primitive values as is
        return data;
    }

    //Generate/edit final file
    async createContentFile(data: any) {
        try {
            // Use existing file path for edits, root folder for new content
            let filePath = this.activeView?.filePath;
            if (!filePath) {
                filePath = `/${data.name}.md`;
            }
            
            let file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
            const fileContent = this.generateFileContent(data, file);

            if (file) {
                await this.app.vault.modify(file, fileContent);
            } else {
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
        
        // Get existing properties for this file if it exists
        let existingProps: any = {};
        if (existingFile) {
            const cache = this.app.metadataCache.getFileCache(existingFile);
            if (cache && cache.frontmatter) {
                existingProps = cache.frontmatter;
            }
        }
        
        // Create a simplified version of the data with only values
        const simplifiedData = {
            contentType: data.contentType,
            name: data.name,
            id: existingProps.data?.id || generateUUID(), // Preserve ID if exists, generate new if not
            template: this.extractValuesOnly(data.template)
        };

        let content = "";
        content += `---\n\n`;
        content += `data: ${JSON.stringify(simplifiedData)}\n\n`;
        content += `needRefresh: false\n\n`;
        content += `---\n\n`;

        content += `#${contentTypeTag}\n\n`;

        content += this.formatContentData(data.template, 3, "template").innerHTML;
        return content;
    }


    //Helper function to convert a type of filed to html
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

    //Convert json object to html
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
            } else if (hasValueAndType(field)) {
                if (field.value == null || field.value == undefined) return;

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
                    const checkbox = node('input', {
                        attributes: {
                            type: 'checkbox',
                            disabled: 'true'
                        }
                    }) as HTMLInputElement;

                    if (field.value) {
                        checkbox.setAttr("checked", "checked");
                    }

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
                        const badgeElement = node('span', {
                            class: 'badge-item',
                            text: badge
                        });
                        badgesContainer.appendChild(badgeElement);
                    });

                    fieldValueElement = badgesContainer;
                } else if (field.type === "image") {
                    fieldContainer.classList.add(`field-type-${field.type}`);
                    const imageContainer = node('div', { class: 'field-value image-value' });

                    if (field.value) {
                        const img = node('img', {
                            attributes: {
                                src: field.value,
                                alt: displayName
                            }
                        });
                        imageContainer.appendChild(img);
                    } else {
                        imageContainer.textContent = 'No image';
                    }

                    fieldValueElement = imageContainer;
                } else if (field.type === "date") {
                    fieldContainer.classList.add(`field-type-${field.type}`);
                    const dateValue = node('div', { class: 'field-value date-value' });
                    dateValue.textContent = field.value || '';
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