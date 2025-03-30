import { App, Plugin, TFile, WorkspaceLeaf, Notice, addIcon, Menu } from 'obsidian';
import { ComicEditorView } from './views/ComicEditorView';
import { ComicReaderView } from './views/ComicReaderView';
import { ComicCreatorModal } from './modals/ComicCreatorModal';
import { ComicPageSelectorModal } from './modals/ComicPageSelectorModal';
import { generateUUID } from 'utils';

//View types
const VIEW_TYPE_COMIC_EDITOR = "comic-editor-view";
const VIEW_TYPE_COMIC_READER = "comic-reader-view";

//Custom icon for comics
const COMIC_ICON = `<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="35" height="35" fill="none" stroke="currentColor" stroke-width="3"/>
  <rect x="55" y="10" width="35" height="20" fill="none" stroke="currentColor" stroke-width="3"/>
  <rect x="55" y="40" width="35" height="25" fill="none" stroke="currentColor" stroke-width="3"/>
  <rect x="10" y="55" width="35" height="35" fill="none" stroke="currentColor" stroke-width="3"/>
</svg>`;

export default class ComicCreatorPlugin extends Plugin {
    comicPages: Map<string, any> = new Map();
    
    async onload() {
        console.log("loading comic creator plugin");
        
        //Register custom icon
        addIcon('comic-pages', COMIC_ICON);
        
        //Register views
        console.log("Registering comic editor view type:", VIEW_TYPE_COMIC_EDITOR);
        this.registerView(
            VIEW_TYPE_COMIC_EDITOR,
            (leaf: WorkspaceLeaf) => new ComicEditorView(leaf, this)
        );
        
        console.log("Registering comic reader view type:", VIEW_TYPE_COMIC_READER);
        this.registerView(
            VIEW_TYPE_COMIC_READER,
            (leaf: WorkspaceLeaf) => new ComicReaderView(leaf, this)
        );
        
        //Add ribbon icon
        this.addRibbonIcon('comic-pages', 'Comic Creator', (evt: MouseEvent) => {
            console.log("Comic Creator ribbon icon clicked");
            new ComicCreatorModal(this.app, this).open();
        });
        
        //Add commands
        this.addCommand({
            id: 'create-new-comic',
            name: 'Create New Comic',
            callback: () => {
                console.log("Create New Comic command triggered");
                new ComicCreatorModal(this.app, this).open();
            }
        });
        
        this.addCommand({
            id: 'open-comic-editor',
            name: 'Open Comic Editor',
            callback: () => {
                console.log("Open Comic Editor command triggered");
                new ComicPageSelectorModal(this.app, this, this.activateEditorView.bind(this)).open();
            }
        });
        
        this.addCommand({
            id: 'open-comic-reader',
            name: 'Open Comic Reader',
            callback: () => {
                console.log("Open Comic Reader command triggered");
                new ComicPageSelectorModal(this.app, this, this.activateReaderView.bind(this)).open();
            }
        });
        
        //Load existing comics
        await this.loadComics();
        
        //Register file menu
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                // Support both .json and .md files in comics folder
                if (file instanceof TFile && 
                    (file.extension === 'json' || file.extension === 'md') && 
                    file.path.startsWith('comics/')) {
                    
                    console.log("Adding comic menu items for file:", file.path);
                    
                    menu.addItem((item) => {
                        item.setTitle('Open in Comic Editor')
                            .setIcon('comic-pages')
                            .onClick(() => {
                                console.log("Opening file in comic editor:", file.path);
                                this.activateEditorView(file.path);
                            });
                    });
                    
                    menu.addItem((item) => {
                        item.setTitle('View in Comic Reader')
                            .setIcon('book-open')
                            .onClick(() => {
                                console.log("Opening file in comic reader:", file.path);
                                this.activateReaderView(file.path);
                            });
                    });
                }
            })
        );
        
        // Add a status bar item to show the plugin is loaded
        const statusBarItemEl = this.addStatusBarItem();
        statusBarItemEl.setText('Comic Creator ready');
    }
    
    async loadComics() {
        //Check if comics folder exists
        const comicsFolder = this.app.vault.getAbstractFileByPath('comics');
        if (!comicsFolder) {
            //Create comics folder if it doesn't exist
            await this.app.vault.createFolder('comics');
            return;
        }
        
        //Load all comic pages - look for both .json and .md files
        const comicFiles = this.app.vault.getFiles().filter(file => 
            (file.extension === 'json' || file.extension === 'md') && 
            file.path.startsWith('comics/'));
            
        for (const file of comicFiles) {
            try {
                const content = await this.app.vault.read(file);
                let comicData;
                
                if (file.extension === 'md') {
                    // Extract comic data from markdown frontmatter
                    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
                    if (frontmatterMatch && frontmatterMatch[1]) {
                        const frontmatter = frontmatterMatch[1];
                        const comicMatch = frontmatter.match(/comic:\s*([\s\S]*?)(?:\n[^\s]|$)/);
                        if (comicMatch && comicMatch[1]) {
                            try {
                                comicData = JSON.parse(comicMatch[1]);
                            } catch (e) {
                                console.error(`Failed to parse comic data in ${file.path}:`, e);
                                continue;
                            }
                        }
                    }
                } else {
                    // JSON format
                    comicData = JSON.parse(content);
                }
                
                if (comicData) {
                    this.comicPages.set(file.path, comicData);
                }
            } catch (error) {
                console.error(`Failed to load comic page ${file.path}:`, error);
            }
        }
    }
    
    async createNewComic(comicName: string) {
        //Generate a unique ID for the comic
        const comicId = generateUUID();
        
        // Use .md extension instead of .json so the file appears in Obsidian's file explorer
        const filePath = `comics/${comicName}.md`;
        
        //Create basic comic structure
        const comicData = {
            id: comicId,
            name: comicName,
            created: Date.now(),
            modified: Date.now(),
            pages: [
                this.createEmptyPage(`Page 1`)
            ]
        };
        
        //Save comic data to file
        await this.saveComic(filePath, comicData);
        
        //Open in editor - explicitly wait for activation to complete
        await this.activateEditorView(filePath);
        
        return filePath;
    }
    
    createEmptyPage(pageName: string) {
        return {
            id: generateUUID(),
            name: pageName,
            created: Date.now(),
            modified: Date.now(),
            width: 900,
            height: 1200,
            panels: [],
            borders: [],
            layers: [
                {
                    id: generateUUID(),
                    name: "Background",
                    visible: true,
                    locked: false,
                    elements: []
                },
                {
                    id: generateUUID(),
                    name: "Panels",
                    visible: true,
                    locked: false,
                    elements: []
                },
                {
                    id: generateUUID(),
                    name: "Borders",
                    visible: true,
                    locked: false,
                    elements: []
                },
                {
                    id: generateUUID(),
                    name: "Foreground",
                    visible: true,
                    locked: false,
                    elements: []
                }
            ]
        };
    }
    
    async saveComic(filePath: string, comicData: any) {
        try {
            // Check if file path ends with .md
            const useMarkdown = filePath.endsWith('.md');
            
            // Format content as either JSON or MD with frontmatter
            let fileContent;
            if (useMarkdown) {
                // Create a markdown file with JSON in frontmatter
                fileContent = "---\n";
                fileContent += `comic: ${JSON.stringify(comicData)}\n`;
                fileContent += "---\n\n";
                fileContent += `# ${comicData.name}\n\n`;
                fileContent += `Comic created with Comic Creator plugin. Use the \"Open in Comic Editor\" option from the file menu to edit.`;
            } else {
                fileContent = JSON.stringify(comicData, null, 2);
            }
            
            const existingFile = this.app.vault.getAbstractFileByPath(filePath);
            
            if (existingFile) {
                await this.app.vault.modify(existingFile as TFile, fileContent);
            } else {
                // Create parent folder if it doesn't exist
                const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
                if (folderPath && !this.app.vault.getAbstractFileByPath(folderPath)) {
                    await this.app.vault.createFolder(folderPath);
                }
                
                await this.app.vault.create(filePath, fileContent);
            }
            
            //Update the comic pages cache
            this.comicPages.set(filePath, comicData);
            
            new Notice(`Comic saved: ${comicData.name}`);
            return true;
        } catch (error) {
            console.error("Error saving comic:", error);
            new Notice(`Error saving comic: ${error.message}`);
            return false;
        }
    }
    
    async activateEditorView(filePath: string) {
        console.log("Activating editor view for file:", filePath);
        
        try {
            //Create a new leaf for the editor view
            const leaf = this.app.workspace.getLeaf('split');
            if (!leaf) {
                throw new Error("Could not create leaf for editor view");
            }
            
            //Set the view to comic editor
            await leaf.setViewState({
                type: VIEW_TYPE_COMIC_EDITOR,
                active: true,
                state: { filePath }
            });
            
            //Focus the leaf
            this.app.workspace.setActiveLeaf(leaf, { focus: true });
            this.app.workspace.revealLeaf(leaf);
            
            console.log("Editor view activated successfully");
            return true;
        } catch (error) {
            console.error("Failed to activate editor view:", error);
            new Notice(`Failed to open Comic Editor: ${error.message}`);
            return false;
        }
    }
    
    async activateReaderView(filePath: string) {
        console.log("Activating reader view for file:", filePath);
        
        try {
            //Create a new leaf for the reader view
            const leaf = this.app.workspace.getLeaf('split');
            if (!leaf) {
                throw new Error("Could not create leaf for reader view");
            }
            
            //Set the view to comic reader
            await leaf.setViewState({
                type: VIEW_TYPE_COMIC_READER,
                active: true,
                state: { filePath }
            });
            
            //Focus the leaf
            this.app.workspace.setActiveLeaf(leaf, { focus: true });
            this.app.workspace.revealLeaf(leaf);
            
            console.log("Reader view activated successfully");
            return true;
        } catch (error) {
            console.error("Failed to activate reader view:", error);
            new Notice(`Failed to open Comic Reader: ${error.message}`);
            return false;
        }
    }
    
    onunload() {
        console.log("unloading comic creator plugin");
    }
}