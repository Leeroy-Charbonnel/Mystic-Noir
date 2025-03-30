import { App, Modal, Setting, Notice } from 'obsidian';
import ComicCreatorPlugin from '../main';

export class ComicCreatorModal extends Modal {
    private plugin: ComicCreatorPlugin;
    private comicName: string = '';
    private nameInput: HTMLInputElement;

    constructor(app: App, plugin: ComicCreatorPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('comic-creator-modal');
        
        //Title
        contentEl.createEl('h2', {
            text: 'Create New Comic',
            cls: 'comic-creator-title'
        });

        //Comic name input
        const nameSetting = new Setting(contentEl)
            .setName('Comic Name')
            .setDesc('Enter a name for your new comic');
            
        this.nameInput = document.createElement('input');
        this.nameInput.type = 'text';
        this.nameInput.placeholder = 'My Awesome Comic';
        this.nameInput.value = this.comicName;
        this.nameInput.className = 'comic-name-input';
        this.nameInput.addEventListener('input', () => {
            this.comicName = this.nameInput.value;
        });
        
        nameSetting.controlEl.appendChild(this.nameInput);
        
        // Focus the input
        setTimeout(() => {
            this.nameInput.focus();
        }, 50);
        
        // Add keypress listener for Enter key
        this.nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createComic();
            }
        });

        //Buttons container
        const buttonsDiv = contentEl.createDiv({ cls: 'comic-creator-buttons' });
        
        //Cancel button
        const cancelButton = buttonsDiv.createEl('button', {
            text: 'Cancel',
            cls: 'comic-creator-button'
        });
        
        //Create button
        const createButton = buttonsDiv.createEl('button', {
            text: 'Create Comic',
            cls: 'comic-creator-button comic-creator-button-cta'
        });
        
        //Button events
        cancelButton.addEventListener('click', () => this.close());
        createButton.addEventListener('click', () => this.createComic());
    }

    async createComic() {
        if (!this.comicName.trim()) {
            // Show error
            new Notice('Please enter a comic name');
            return;
        }
        
        this.close();
        
        // Create comic using plugin method
        try {
            const filePath = await this.plugin.createNewComic(this.comicName);
            new Notice(`Comic "${this.comicName}" created successfully!`);
            
            // Force a delay to ensure file is saved before opening
            setTimeout(() => {
                this.plugin.activateEditorView(filePath);
            }, 300);
        } catch (error) {
            console.error("Error creating comic:", error);
            new Notice(`Error creating comic: ${error.message}`);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}