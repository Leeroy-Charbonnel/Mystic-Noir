import { App, Plugin, PluginSettingTab, Setting, TFile, normalizePath, Notice, TFolder, Menu, MenuItem, FileManager, SuggestModal, WorkspaceLeaf, setIcon } from 'obsidian';
import { DynamicFormModal } from './dynamicFormModal';
import { ContentSelectorModal } from './contentSelectorModal';
import { ContentCreatorView, CONTENT_CREATOR_VIEW } from './contentCreatorView';
import { node, formatDisplayName, convertTemplateFormat, FormTemplate, getTemplates, hasValueAndType, convertLinks } from './utils';
import './styles.css';

class ContentCreatorSettingTab extends PluginSettingTab {
    // Keeping this as is
    // ...
}

interface ContentCreatorPluginSettings {
    defaultFolders: { [key: string]: string }
}

const DEFAULT_SETTINGS: ContentCreatorPluginSettings = {
    defaultFolders: {}
}

class EditContentButtons {
    // Keeping this as is, but update the edit function to open the view instead of modal
    // ...
    constructor(app: App, plugin: ContentCreatorPlugin, leaf: any) {
        this.plugin = plugin;
        this.leaf = leaf;
        this.containerEl = this.leaf.actionsEl;

        try {
            //Try delete button
            this.leaf.actionsEl.querySelector("#editContent").remove();
        } catch(error) {}

        //Check if leaf has the property data
        if(this.leaf.metadataEditor && this.leaf.metadataEditor.properties.filter((x: any) => x.key=="data").length==0) return;

        const formButton = document.createElement('button');
        formButton.id = "editContent";
        formButton.className = 'clickable-icon view-action';
        formButton.setAttribute('aria-label', 'Edit Content');
        formButton.addEventListener('click', () => {
            this.plugin.editExistingContent(this.leaf.file as TFile);
        });

        setIcon(formButton, 'file-pen-line');
        this.containerEl.insertBefore(formButton, this.containerEl.firstChild);
    }
    // ...
}

export default class ContentCreatorPlugin extends Plugin {
    settings: ContentCreatorPluginSettings;
    templates: { [key: string]: FormTemplate };

    async onload() {
        console.log("loading " + this.manifest.name + " plugin: v" + this.manifest.version);

        //Settings
        await this.loadSettings();
        this.addSettingTab(new ContentCreatorSettingTab(this.app, this));

        //Templates
        this.templates = getTemplates();
        Object.keys(this.templates).forEach(type => {
            if(this.settings.defaultFolders[type]) {
                (this.templates[type as keyof typeof this.templates] as FormTemplate).defaultFolder = this.settings.defaultFolders[type];
            }
        });

        // Register the view for content creation/editing
        this.registerView(
            CONTENT_CREATOR_VIEW,
            (leaf) => new ContentCreatorView(leaf, this, this.createEmptyData())
        );

        //Commands
        this.addRibbonIcon('file-plus', 'Create Content', (evt: MouseEvent) => { 
            new ContentSelectorModal(this.app, this).open(); 
        });

        //Top right menu, and right click on page
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                if(file instanceof TFile && file.extension === 'md') {
                    menu.addItem((item: MenuItem) => {
                        item.setTitle('Edit content')
                            .setIcon('file-pen-line')
                            .onClick(async () => {
                                await this.editExistingContent(file as TFile);
                            });
                    });
                }
            })
        );
        
        //Button on page itself
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                const currentFileView = (this.app.workspace as any).getActiveFileView();
                if(currentFileView != null) {
                    new EditContentButtons(this.app, this, currentFileView);
                }
            })
        );
    }

    private createEmptyData(): FormTemplate {
        // Create a default empty template to initialize the view
        const firstTemplateKey = Object.keys(this.templates)[0];
        const template = this.templates[firstTemplateKey];
        return {
            name: "New Content",
            oldName: null,
            contentType: firstTemplateKey,
            defaultFolder: template.defaultFolder || "",
            template: JSON.parse(JSON.stringify(template.template))
        };
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);

        Object.keys(this.templates).forEach(type => {
            if(this.settings.defaultFolders[type]) {
                (this.templates[type as keyof typeof this.templates] as FormTemplate).defaultFolder = this.settings.defaultFolders[type];
            }
        });
    }

    openFormForContentType(contentType: string) {
        let data = JSON.parse(JSON.stringify(this.templates[contentType as keyof typeof this.templates]));
        data.name = `New (${contentType.charAt(0).toUpperCase() + contentType.slice(1)})`;
        data.oldName = null;
        
        // Check if view is already open, if so, close it
        const existingLeaves = this.app.workspace.getLeavesOfType(CONTENT_CREATOR_VIEW);
        if (existingLeaves.length > 0) {
            existingLeaves.forEach(leaf => leaf.detach());
        }
        
        // Open the view in a new leaf
        this.app.workspace.getLeaf('split').setViewState({
            type: CONTENT_CREATOR_VIEW,
            active: true,
        }).then((leaf) => {
            if (leaf.view instanceof ContentCreatorView) {
                // Update the view with the correct data
                leaf.view.data = data;
                leaf.view.onOpen();
            }
        });
    }

    fillTemplateWithData(template: any, data: any) {
        // Keep this method as is
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

    async editExistingContent(file: TFile) {
        const properties = this.getFileProperties(this.app, file);

        if (properties == null) {
            new Notice("Error editing content: Could not find properties");
            console.error("Error editing content: Could not find properties");
            return;
        }

        // Fill template with data
        const data = properties?.data;
        const template = this.templates[data.contentType];
        const result = this.fillTemplateWithData(template, data);

        // Check if view is already open, if so, close it
        const existingLeaves = this.app.workspace.getLeavesOfType(CONTENT_CREATOR_VIEW);
        if (existingLeaves.length > 0) {
            existingLeaves.forEach(leaf => leaf.detach());
        }
        
        // Open the view in a new leaf
        this.app.workspace.getLeaf('split').setViewState({
            type: CONTENT_CREATOR_VIEW,
            active: true,
        }).then((leaf) => {
            if (leaf.view instanceof ContentCreatorView) {
                // Update the view with the correct data
                leaf.view.data = result;
                leaf.view.onOpen();
            }
        });
    }

    getFileProperties(app: App, file: TFile) {
        const cache = app.metadataCache.getFileCache(file);
        if (cache && cache.frontmatter) return cache.frontmatter;
        return null;
    }

    async createContentFile(data: any) {
        // Keep this method as is
        try {
            const folderPath = data.defaultFolder;

            // Check if folder is specified
            if (!folderPath || folderPath.trim() == '') { 
                new Notice(`No default folder: ${data.contentType}`); 
            }

            // Check if folder exists, create it otherwise
            await this.ensureFolderExists(folderPath);

            // Generate content markdown
            let file;
            let newContent = (data.oldName == null);
            const fileOldPath = normalizePath(`${folderPath}/${data.oldName}.md`);
            const fileNewPath = normalizePath(`${folderPath}/${data.name}.md`);

            data.oldName = data.name;
            const fileContent = this.generateFileContent(data);

            if (newContent) {
                file = await this.app.vault.create(fileNewPath, fileContent);
            } else {
                // If exists, modify content and rename to keep link
                file = this.app.vault.getAbstractFileByPath(fileOldPath) as TFile;
                await this.app.vault.modify(file, fileContent);
                await this.app.fileManager.renameFile(file, fileNewPath);
            }

            new Notice(`Saved: ${data.name}`);

            this.app.workspace.getLeaf(false).openFile(file);
            return file;

        } catch (error) {
            console.error("Error creating content:", error);
            new Notice(`Error creating content: ${error.message}`);
            return null;
        }
    }

    private async ensureFolderExists(folderPath: string) {
        // Keep this method as is
        const folders = folderPath.split('/').filter(p => p.trim());
        let currentPath = '';

        for (const folder of folders) {
            currentPath = currentPath ? `${currentPath}/${folder}` : folder;
            if (!(await this.app.vault.adapter.exists(currentPath))) {
                await this.app.vault.createFolder(currentPath);
            }
        }
    }

    private generateFileContent(data: FormTemplate): string {
        // Keep this method as is
        const contentTypeTag = data.contentType.charAt(0).toUpperCase() + data.contentType.slice(1);

        let content = "";
        content += `---\n\n`;
        content += `data: ${JSON.stringify(data)}\n\n`;
        content += `---\n\n`;

        content += `#${contentTypeTag}\n\n`;

        content += this.formatContentData(data.template, 3, "template").innerHTML;
        return content;
    }

    // Keep all other methods as they were
    private getTextField(value: string): HTMLElement {
        // ...
    }

    private getTextAreaField(value: string): HTMLElement|null {
        // ...
    }

    private getTextArray(values: string[]): HTMLElement {
        // ...
    }

    private getTextAreaArray(values: string[]): HTMLElement {
        // ...
    }

    private formatContentData(data: any, depth: number, path: string = ''): HTMLElement {
        // ...
    }

    onunload() {
        console.log("unloading plugin");
    }
}