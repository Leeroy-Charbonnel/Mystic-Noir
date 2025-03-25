import { App, Modal, Setting, TFolder } from 'obsidian';
import { node } from './utils';

export class FolderSelectorModal extends Modal {
    private selectedFolder: string = '/';
    private onSubmit: (folderPath: string) => void;
    
    constructor(app: App, onSubmit: (folderPath: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.addClass('folder-selector-modal');
        
        contentEl.appendChild(node('h2', { 
            text: 'Select Destination Folder',
            class: 'folder-selector-title' 
        }));
        
        // Get all folders in the vault
        const folders = this.getAllFolders();
        
        // Create dropdown
        new Setting(contentEl)
            .setName('Folder')
            .addDropdown(dropdown => {
                // Add root folder option
                dropdown.addOption('/', 'Root');
                
                // Add all other folders
                folders.forEach(folder => {
                    dropdown.addOption(folder.path, folder.path);
                });
                
                dropdown.setValue('/');
                dropdown.onChange(value => {
                    this.selectedFolder = value;
                });
            });
        
        // Add buttons
        const buttonContainer = node('div', { class: 'folder-selector-buttons' });
        
        const cancelButton = node('button', { 
            class: 'folder-selector-button',
            text: 'Cancel'
        });
        cancelButton.addEventListener('click', () => this.close());
        
        const selectButton = node('button', { 
            class: 'folder-selector-button folder-selector-button-cta',
            text: 'Select'
        });
        selectButton.addEventListener('click', () => {
            this.onSubmit(this.selectedFolder);
            this.close();
        });
        
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(selectButton);
        contentEl.appendChild(buttonContainer);
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
    
    private getAllFolders(): TFolder[] {
        const folders: TFolder[] = [];
        
        //Function to recursively get all folders
        const getFolders = (folder: TFolder) => {
            folders.push(folder);
            
            for (const child of folder.children) {
                if (child instanceof TFolder) {
                    getFolders(child);
                }
            }
        };
        
        //Get all top-level folders
        for (const child of this.app.vault.getRoot().children) {
            if (child instanceof TFolder) {
                getFolders(child);
            }
        }
        
        return folders;
    }
}