import { App,Plugin,PluginSettingTab,Setting,WorkspaceLeaf,MarkdownView,Notice,View,ItemView,ViewStateResult } from 'obsidian';

// Define the tag filter view ID
const VIEW_TYPE_GRAPH_TAGS='graph-tags-view';

interface CreatorPluginSettings {
    mySetting: string;
}

const DEFAULT_SETTINGS: CreatorPluginSettings={
    mySetting: 'default'
}

// Create a custom view for our combined graph and tags
class GraphTagsView extends ItemView {
    private graphContainer: HTMLElement;
    private tagsPanel: HTMLElement;
    private tagsContainer: HTMLElement;
    private refreshButton: HTMLElement;
    private plugin: CreatorPlugin;

    constructor(leaf: WorkspaceLeaf,plugin: CreatorPlugin) {
        super(leaf);
        this.plugin=plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_GRAPH_TAGS;
    }

    getDisplayText(): string {
        return "Graph & Tags View";
    }

    async onOpen(): Promise<void> {
        const container=this.containerEl.children[1];
        container.empty();
        container.addClass('graph-tags-main-container');

        // Create graph container (left side)
        this.graphContainer=container.createDiv('graph-container');

        // Create tags panel (right side)
        this.tagsPanel=container.createDiv('tags-panel');
        const title=this.tagsPanel.createEl('h3');
        title.setText('Filter by Tags');

        // Create a container for our tags
        this.tagsContainer=this.tagsPanel.createDiv('tags-container');
        this.tagsContainer.setText('Loading tags...');

        // Add refresh button
        this.refreshButton=this.tagsPanel.createEl('button');
        this.refreshButton.setText('Refresh Tags');
        this.refreshButton.addEventListener('click',() => {
            this.loadTags();
        });

        // Load the graph view into the container
        setTimeout(() => {
            this.initializeGraphView();
        },100);

        // Load the tags
        this.loadTags();
    }

    private async initializeGraphView() {
        // Try to activate the graph view in our container
        try {
            // Open the graph view
            await this.app.commands.executeCommandById('graph:open');

            // Get the graph view
            const graphLeaf=this.app.workspace.getLeavesOfType('graph')[0];

            // If we got a graph leaf, we need to close it and then move its content to our container
            if(graphLeaf) {
                // Save a reference to the graph view's content
                const graphContent=graphLeaf.view.contentEl;

                // Close the graph leaf since we don't want it to be a separate tab
                await this.app.workspace.detachLeavesOfType('graph');

                // Move the graph content to our container
                if(graphContent) {
                    this.graphContainer.appendChild(graphContent);
                }
            } else {
                this.graphContainer.setText('Failed to load graph view');
            }
        } catch(error) {
            console.error('Failed to initialize graph view:',error);
            this.graphContainer.setText('Error loading graph view');
        }
    }

    private async loadTags() {
        try {
            // Clear existing content
            this.tagsContainer.empty();
            this.tagsContainer.setText('Loading tags...');

            // Get all tags
            const tags=await this.plugin.getAllTags();

            // Clear loading text
            this.tagsContainer.empty();

            if(tags.length===0) {
                this.tagsContainer.setText('No tags found in your vault.');
                return;
            }

            // Create header row with Select All/None buttons
            const headerRow=this.tagsContainer.createDiv('tag-header-row');

            const selectAllBtn=headerRow.createEl('button',{ cls: 'tag-button' });
            selectAllBtn.setText('Select All');
            selectAllBtn.addEventListener('click',() => {
                this.setAllTagsSelection(true);
            });

            const selectNoneBtn=headerRow.createEl('button',{ cls: 'tag-button' });
            selectNoneBtn.setText('Select None');
            selectNoneBtn.addEventListener('click',() => {
                this.setAllTagsSelection(false);
            });

            // Add a checkbox for each tag
            tags.forEach(tag => {
                const tagContainer=this.tagsContainer.createDiv('tag-checkbox-container');

                const checkbox=tagContainer.createEl('input');
                checkbox.type='checkbox';
                checkbox.id=`tag-checkbox-${tag}`;
                checkbox.dataset.tag=tag;
                checkbox.checked=true; // All selected by default

                checkbox.addEventListener('change',() => {
                    this.updateGraphFilter();
                });

                const label=tagContainer.createEl('label');
                label.htmlFor=checkbox.id;
                label.setText(tag);
            });

            // Initial filter application
            this.updateGraphFilter();

        } catch(error) {
            console.error('Error loading tags:',error);
            this.tagsContainer.setText('Error loading tags. Please try again.');
        }
    }

    private setAllTagsSelection(checked: boolean) {
        // Get all checkboxes and set them to the specified state
        this.tagsContainer.querySelectorAll('input[type="checkbox"]').forEach((checkbox: HTMLInputElement) => {
            checkbox.checked=checked;
        });

        // Update the graph filter
        this.updateGraphFilter();
    }

    private updateGraphFilter() {
        // Get all checked tag checkboxes
        const checkedTags=Array.from(
            this.tagsContainer.querySelectorAll('input[type="checkbox"]:checked')
        ).map(checkbox => (checkbox as HTMLInputElement).dataset.tag);

        // Create a search query for the graph filter
        if(checkedTags.length===0) {
            // If no tags are selected, show an empty graph
            this.setGraphSearch('-tag:*');
        } else {
            // Create a query that includes all selected tags
            const tagQuery=checkedTags.map(tag => `tag:${tag}`).join(' OR ');
            this.setGraphSearch(tagQuery);
        }
    }

    private setGraphSearch(query: string) {
        // Find the search input in the graph view inside our container
        const searchInput=this.graphContainer.querySelector('.search-input-container input') as HTMLInputElement;
        if(!searchInput) {
            console.error('Could not find graph search input');
            return;
        }

        // Set the value and dispatch appropriate events to trigger the search
        searchInput.value=query;
        searchInput.dispatchEvent(new Event('input',{ bubbles: true }));
        searchInput.dispatchEvent(new KeyboardEvent('keydown',{ key: 'Enter',bubbles: true }));
    }

    async onClose() {
        // Clean up event listeners
        this.refreshButton.removeEventListener('click',() => {
            this.loadTags();
        });
    }
}

export default class CreatorPlugin extends Plugin {
    settings: CreatorPluginSettings;

    async onload() {
        await this.loadSettings();

        // Register the custom view
        this.registerView(
            VIEW_TYPE_GRAPH_TAGS,
            (leaf) => new GraphTagsView(leaf,this)
        );

        // Add a ribbon icon for the plugin
        const ribbonIconEl=this.addRibbonIcon('dice','Graph & Tags View',(evt: MouseEvent) => {
            // Activate our view when the ribbon icon is clicked
            this.activateView();
        });

        ribbonIconEl.addClass('creator-plugin-ribbon-class');

        // Add a command to open the view
        this.addCommand({
            id: 'open-graph-tags-view',
            name: 'Open Graph & Tags View',
            callback: () => {
                this.activateView();
            }
        });

        // Add settings tab
        this.addSettingTab(new CreatorSettingTab(this.app,this));
    }

    // Function to activate our custom view
    async activateView() {
        const { workspace }=this.app;

        // Check if the view is already open
        let leaf=workspace.getLeavesOfType(VIEW_TYPE_GRAPH_TAGS)[0];

        if(!leaf) {
            // If not open, create a new leaf and set our view
            leaf=workspace.getRightLeaf(false);
            await leaf.setViewState({
                type: VIEW_TYPE_GRAPH_TAGS,
                active: true,
            });
        }

        // Reveal the leaf
        workspace.revealLeaf(leaf);
    }

    // Function to get all tags from the vault
    async getAllTags() {
        const allTags=new Set<string>();

        // Iterate through all markdown files in the vault
        const files=this.app.vault.getMarkdownFiles();

        for(const file of files) {
            try {
                // Get the cache metadata for the file
                const cache=this.app.metadataCache.getFileCache(file);

                // Extract tags from the file
                if(cache&&cache.tags) {
                    cache.tags.forEach(tagObj => {
                        if(tagObj.tag) {
                            // Remove the '#' from the tag
                            const tagName=tagObj.tag.startsWith('#')
                                ? tagObj.tag.substring(1)
                                :tagObj.tag;

                            allTags.add(tagName);
                        }
                    });
                }

                // Also get frontmatter tags if any
                if(cache&&cache.frontmatter&&cache.frontmatter.tags) {
                    const fmTags=cache.frontmatter.tags;
                    if(Array.isArray(fmTags)) {
                        fmTags.forEach(tag => allTags.add(tag));
                    } else if(typeof fmTags==='string') {
                        // Handle comma-separated tags
                        fmTags.split(',')
                            .map(t => t.trim())
                            .filter(t => t)
                            .forEach(tag => allTags.add(tag));
                    }
                }
            } catch(error) {
                console.error(`Error processing tags for file ${file.path}:`,error);
            }
        }

        // Convert Set to sorted Array for display
        return Array.from(allTags).sort();
    }

    onunload() {
        // Detach any open views
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_GRAPH_TAGS);
    }

    async loadSettings() {
        this.settings=Object.assign({},DEFAULT_SETTINGS,await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class CreatorSettingTab extends PluginSettingTab {
    plugin: CreatorPlugin;

    constructor(app: App,plugin: CreatorPlugin) {
        super(app,plugin);
        this.plugin=plugin;
    }

    display(): void {
        const { containerEl }=this;

        containerEl.empty();

        containerEl.createEl('h2',{ text: 'Graph & Tags View Settings' });

        new Setting(containerEl)
            .setName('Default folder for Characters')
            .setDesc('Folder path where character notes will be stored')
            .addText(text => text
                .setPlaceholder('characters')
                .setValue(this.plugin.settings.mySetting)
                .onChange(async (value) => {
                    this.plugin.settings.mySetting=value;
                    await this.plugin.saveSettings();
                }));
    }
}