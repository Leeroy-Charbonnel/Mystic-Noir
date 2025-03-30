import { App, Modal, TFile, Notice } from 'obsidian';
import ComicCreatorPlugin from '../main';
import { ComicCreatorModal } from './ComicCreatorModal';

export class ComicPageSelectorModal extends Modal {
    private plugin: ComicCreatorPlugin;
    private onSelect: (filePath: string) => void;
    private comics: { path: string, name: string }[] = [];

    constructor(app: App, plugin: ComicCreatorPlugin, onSelect: (filePath: string) => void) {
        super(app);
        this.plugin = plugin;
        this.onSelect = onSelect;
    }

    async onOpen() {
        console.log("Opening Comic Page Selector Modal");
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('comic-selector-modal');
        
        //Title
        contentEl.createEl('h2', {
            text: 'Select Comic',
            cls: 'comic-selector-title'
        });

        //Load comics
        await this.loadComics();
        
        //Comic list container
        const listContainer = contentEl.createDiv({ cls: 'comic-list-container' });
        
        if (this.comics.length === 0) {
            listContainer.createDiv({
                text: 'No comics found. Create a new comic first.',
                cls: 'comic-list-empty'
            });
        } else {
            this.comics.forEach(comic => {
                const comicItem = listContainer.createDiv({
                    text: comic.name,
                    cls: 'comic-list-item'
                });
                
                comicItem.addEventListener('click', () => {
                    console.log("Comic selected:", comic.path);
                    this.close();
                    this.onSelect(comic.path);
                });
            });
        }
        
        //Create new comic button
        const createNewButton = contentEl.createEl('button', {
            text: 'Create New Comic',
            cls: 'comic-selector-button'
        });
        
        createNewButton.addEventListener('click', () => {
            console.log("Creating new comic from selector modal");
            this.close();
            //Open comic creator modal
            new ComicCreatorModal(this.app, this.plugin).open();
        });
    }

    async loadComics() {
        console.log("Loading comics for selector");
        this.comics = [];
        
        //Get all comic files from the comics folder - support both .json and .md files
        const comicFiles = this.app.vault.getFiles().filter(file => 
            (file.extension === 'json' || file.extension === 'md') && 
            file.path.startsWith('comics/')
        );
        
        console.log(`Found ${comicFiles.length} comic files`);
        
        //Load comic details
        for (const file of comicFiles) {
            try {
                console.log(`Loading comic details for ${file.path}`);
                const content = await this.app.vault.read(file);
                let comicData;
                
                if (file.extension === 'md') {
                    // Try to extract comic data from frontmatter
                    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
                    if (frontmatterMatch && frontmatterMatch[1]) {
                        const frontmatter = frontmatterMatch[1];
                        let dataMatch;
                        
                        // Try to match both formats (comic: and comicData:)
                        dataMatch = frontmatter.match(/comic:\s*([\s\S]*?)(?:\n[^\s]|$)/);
                        if (!dataMatch) {
                            dataMatch = frontmatter.match(/comicData:\s*([\s\S]*?)(?:\n[^\s]|$)/);
                        }
                        
                        if (dataMatch && dataMatch[1]) {
                            try {
                                comicData = JSON.parse(dataMatch[1]);
                            } catch (e) {
                                console.error(`Failed to parse comic data in ${file.path}:`, e);
                                // Use file name as fallback
                                comicData = { name: file.basename };
                            }
                        } else {
                            comicData = { name: file.basename };
                        }
                    } else {
                        comicData = { name: file.basename };
                    }
                } else {
                    // Parse JSON file
                    try {
                        comicData = JSON.parse(content);
                    } catch (e) {
                        console.error(`Failed to parse JSON in ${file.path}:`, e);
                        comicData = { name: file.basename };
                    }
                }
                
                this.comics.push({
                    path: file.path,
                    name: comicData?.name || file.basename
                });
                
            } catch (error) {
                console.error(`Failed to load comic data for ${file.path}:`, error);
                // Add with filename as fallback
                this.comics.push({
                    path: file.path,
                    name: file.basename
                });
            }
        }
        
        //Sort by name
        this.comics.sort((a, b) => a.name.localeCompare(b.name));
        console.log(`Loaded ${this.comics.length} comics for selector`);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}