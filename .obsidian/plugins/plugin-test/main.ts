import { App,Plugin,PluginSettingTab,Setting,WorkspaceLeaf,Notice,ItemView,TextAreaComponent } from 'obsidian';

// Define the tag filter view ID
const VIEW_TYPE_TAG_FILTER='graph-tags-view';

interface CreatorPluginSettings {
    defaultCharactersFolder: string;
    excludedTags: string[];
}

const DEFAULT_SETTINGS: CreatorPluginSettings={
    defaultCharactersFolder: '1. Characters',
    excludedTags: ['Template']
}

// Create a custom view for our tag filter panel
class TagFilterView extends ItemView {
    private tagsContainer: HTMLElement;
    private queryDisplay: HTMLElement;
    private statusEl: HTMLElement;
    private refreshButton: HTMLElement;
    private plugin: CreatorPlugin;
    private currentQuery: string='';
    private graphLeaf: WorkspaceLeaf|null=null;
    private isApplyingFilter: boolean=false;

    constructor(leaf: WorkspaceLeaf,plugin: CreatorPlugin) {
        super(leaf);
        this.plugin=plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_TAG_FILTER;
    }

    getDisplayText(): string {
        return "Graph Tag Filter";
    }

    async onOpen(): Promise<void> {
        const container=this.containerEl.children[1];
        container.empty();

        // Main container
        const mainContainer=container.createDiv('tag-filter-main-container');

        // Create header with title
        const header=mainContainer.createEl('div',{ cls: 'tag-filter-header' });
        header.createEl('h3',{ text: 'Filter Graph by Tags' });

        // Create the query display area
        const querySection=mainContainer.createDiv('query-section');
        querySection.createEl('div',{ text: 'Current Filter:',cls: 'query-label' });
        this.queryDisplay=querySection.createEl('div',{ cls: 'query-display' });
        this.queryDisplay.setText('No filter applied');

        // Create status area
        this.statusEl=mainContainer.createDiv('status-message');
        this.statusEl.setText('Select tags to filter the graph view');

        // Create a container for the tags
        const tagsSection=mainContainer.createDiv('tags-section');

        // Add header with select all/none buttons
        const tagHeader=tagsSection.createDiv('tag-header-row');
        tagHeader.createEl('h4',{ text: 'Available Tags' });

        const selectButtons=tagsSection.createDiv('select-buttons');

        const selectAllBtn=selectButtons.createEl('button',{ cls: 'tag-button' });
        selectAllBtn.setText('Select All');
        selectAllBtn.addEventListener('click',() => {
            this.setAllTagsSelection(true);
        });

        const selectNoneBtn=selectButtons.createEl('button',{ cls: 'tag-button' });
        selectNoneBtn.setText('Select None');
        selectNoneBtn.addEventListener('click',() => {
            this.setAllTagsSelection(false);
        });

        // Container for the tags
        this.tagsContainer=tagsSection.createDiv('tags-container');
        this.tagsContainer.setText('Loading tags...');

        // Add refresh button at the bottom
        this.refreshButton=mainContainer.createEl('button',{ cls: 'refresh-button' });
        this.refreshButton.setText('Refresh Tags');
        this.refreshButton.addEventListener('click',() => {
            this.loadTags();
        });

        // Load the tags
        await this.loadTags();

        // Open the graph view automatically
        await this.openGraphView();

        // Apply initial filter after a short delay to ensure graph is loaded
        setTimeout(() => {
            this.applyFilterToGraph();
        },800);
    }

    private async openGraphView() {
        try {
            await this.app.commands.executeCommandById('graph:open');
            this.statusEl.setText('Graph view opened');

            // Find and store the graph leaf for later use
            const graphLeaves=this.app.workspace.getLeavesOfType('graph');
            if(graphLeaves.length>0) {
                this.graphLeaf=graphLeaves[0];
            }
        } catch(error) {
            console.error('Error opening graph view:',error);
            this.statusEl.setText('Error opening graph view');
        }
    }

    private async applyFilterToGraph() {
        // Prevent concurrent filter applications
        if(this.isApplyingFilter) return;

        this.isApplyingFilter=true;

        try {
            // Make sure we have a query
            if(!this.currentQuery) {
                this.isApplyingFilter=false;
                return;
            }

            // Make sure the graph view is open
            if(!this.graphLeaf||!this.app.workspace.getLeavesOfType('graph').length) {
                await this.openGraphView();
                // Wait a bit for the graph view to initialize
                await new Promise(resolve => setTimeout(resolve,500));

                // Get the graph leaf again
                const graphLeaves=this.app.workspace.getLeavesOfType('graph');
                if(graphLeaves.length>0) {
                    this.graphLeaf=graphLeaves[0];
                } else {
                    new Notice('Could not find graph view to apply filter');
                    this.isApplyingFilter=false;
                    return;
                }
            }

            // Make sure we have the graph leaf
            if(!this.graphLeaf||!this.graphLeaf.view) {
                new Notice('Graph view not found');
                this.isApplyingFilter=false;
                return;
            }

            // Get the graph view and find its search input
            const graphView=this.graphLeaf.view;

            // Try to find the search input in the graph view
            const searchInput=this.findSearchInput(graphView.containerEl);

            if(searchInput) {
                // Set the search query
                searchInput.value=this.currentQuery;
                searchInput.dispatchEvent(new Event('input',{ bubbles: true }));
                searchInput.dispatchEvent(new KeyboardEvent('keydown',{ key: 'Enter',bubbles: true }));

                // Unfocus the search input
                searchInput.blur();

                // Update status
                this.statusEl.setText(`Filter applied: ${this.currentQuery}`);

                // Focus back on our view
                this.leaf.setEphemeralState({ focus: true });
            } else {
                console.error('Could not find search input in graph view');
                this.statusEl.setText('Error: Could not find search input');
                new Notice('Could not apply filter: search input not found');
            }
        } catch(error) {
            console.error('Error applying filter to graph:',error);
            this.statusEl.setText('Error applying filter');
            new Notice('Error applying filter to graph view');
        } finally {
            this.isApplyingFilter=false;
        }
    }

    private findSearchInput(container: HTMLElement): HTMLInputElement|null {
        // Try different selector strategies to find the search input
        const selectors=[
            'input.search-input',
            '.search-input-container input',
            'input[type="text"]',
            '.view-content .search input',
            'div[aria-label="Search"] input'
        ];

        for(const selector of selectors) {
            const input=container.querySelector(selector) as HTMLInputElement;
            if(input) return input;
        }

        // If specific selectors fail, try to find any input that looks like a search field
        const allInputs=container.querySelectorAll('input');
        for(const input of Array.from(allInputs)) {
            if(input.type==='text'||!input.type) {
                return input as HTMLInputElement;
            }
        }

        return null;
    }

    private async loadTags() {
        try {
            // Clear existing content
            this.tagsContainer.empty();
            this.tagsContainer.setText('Loading tags...');

            // Get all tags
            const allTags=await this.plugin.getAllTags();

            // Filter out excluded tags
            const excludedTagsSet=new Set(this.plugin.settings.excludedTags.map(tag => tag.toLowerCase()));
            const filteredTags=allTags.filter(tag => !excludedTagsSet.has(tag.toLowerCase()));

            // Clear loading text
            this.tagsContainer.empty();

            if(filteredTags.length===0) {
                this.tagsContainer.setText('No tags found in your vault.');
                return;
            }

            // Add a checkbox for each tag
            filteredTags.forEach(tag => {
                const tagContainer=this.tagsContainer.createDiv('tag-checkbox-container');

                const checkbox=tagContainer.createEl('input');
                checkbox.type='checkbox';
                checkbox.id=`tag-checkbox-${tag}`;
                checkbox.dataset.tag=tag;
                checkbox.checked=true; // All selected by default

                checkbox.addEventListener('change',() => {
                    this.updateQueryFromTags();
                });

                const label=tagContainer.createEl('label');
                label.htmlFor=checkbox.id;
                label.setText(tag);
            });

            // Initial query update
            this.updateQueryFromTags();

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

        // Update the query
        this.updateQueryFromTags();
    }

    private updateQueryFromTags() {
        try {
            // Get all checked tag checkboxes
            const checkedTags=Array.from(
                this.tagsContainer.querySelectorAll('input[type="checkbox"]:checked')
            ).map(checkbox => (checkbox as HTMLInputElement).dataset.tag);

            // Build the main tag inclusion part of the query
            let query='';
            if(checkedTags.length===0) {
                // If no tags are selected, show an empty graph
                query='-tag:*';
                this.queryDisplay.setText('No tags selected (graph will be empty)');
            } else {
                // Create a query that includes all selected tags
                query=`(${checkedTags.map(tag => `tag:${tag}`).join(' OR ')}) AND`;

                // Add explicit exclusions for unwanted tags
                if(this.plugin.settings.excludedTags.length>0) {
                    const exclusions=this.plugin.settings.excludedTags
                        .map(tag => ` -tag:${tag}`)
                        .join('');
                    query+=`(${exclusions})`;
                }

                this.queryDisplay.setText(query);
            }

            // Save the current query
            this.currentQuery=query;

            // Update status
            this.statusEl.setText(`Applying filter with ${checkedTags.length} tags selected...`);

            // Automatically apply filter when tags are toggled
            this.applyFilterToGraph();

        } catch(error) {
            console.error('Error updating query from tags:',error);
            this.statusEl.setText('Error creating filter query');
        }
    }

    async onClose() {
        // Clean up event listeners
        if(this.refreshButton) {
            this.refreshButton.removeEventListener('click',this.loadTags.bind(this));
        }
    }
}

export default class CreatorPlugin extends Plugin {
    settings: CreatorPluginSettings;

    async onload() {
        await this.loadSettings();

        // Register the custom view
        this.registerView(
            VIEW_TYPE_TAG_FILTER,
            (leaf) => new TagFilterView(leaf,this)
        );

        // Add a ribbon icon for the plugin
        const ribbonIconEl=this.addRibbonIcon('tag','Graph Tag Filter',(evt: MouseEvent) => {
            // Activate our view when the ribbon icon is clicked
            this.activateView();
        });

        ribbonIconEl.addClass('creator-plugin-ribbon-class');

        // Add a command to open the view
        this.addCommand({
            id: 'open-graph-tag-filter',
            name: 'Open Graph Tag Filter',
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
        let leaf=workspace.getLeavesOfType(VIEW_TYPE_TAG_FILTER)[0];

        if(!leaf) {
            // If not open, create a new leaf and set our view
            leaf=workspace.getRightLeaf(false);
            await leaf.setViewState({
                type: VIEW_TYPE_TAG_FILTER,
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
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_TAG_FILTER);
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
    private excludedTagsComponent: TextAreaComponent;

    constructor(app: App,plugin: CreatorPlugin) {
        super(app,plugin);
        this.plugin=plugin;
    }

    display(): void {
        const { containerEl }=this;

        containerEl.empty();

        containerEl.createEl('h2',{ text: 'Graph Tag Filter Settings' });

        new Setting(containerEl)
            .setName('Default folder for Characters')
            .setDesc('Folder path where character notes will be stored')
            .addText(text => text
                .setPlaceholder('1. Characters')
                .setValue(this.plugin.settings.defaultCharactersFolder)
                .onChange(async (value) => {
                    this.plugin.settings.defaultCharactersFolder=value;
                    await this.plugin.saveSettings();
                }));

        // Setting for excluded tags
        const excludedTagsSetting=new Setting(containerEl)
            .setName('Excluded Tags')
            .setDesc('Tags to exclude from the filter panel (one per line). These tags will also be explicitly excluded from the graph using -tag:tagname');

        // Add multi-line text area for excluded tags
        const excludedTagsContainer=excludedTagsSetting.controlEl.createDiv('excluded-tags-container');
        excludedTagsContainer.style.width='100%';

        this.excludedTagsComponent=new TextAreaComponent(excludedTagsContainer);
        this.excludedTagsComponent.setValue(this.plugin.settings.excludedTags.join('\n'));
        this.excludedTagsComponent.inputEl.rows=6;
        this.excludedTagsComponent.inputEl.cols=40;
        this.excludedTagsComponent.onChange(async (value) => {
            // Parse the text area value into an array of tags
            const tags=value
                .split('\n')
                .map(tag => tag.trim())
                .filter(tag => tag.length>0);

            this.plugin.settings.excludedTags=tags;
            await this.plugin.saveSettings();
        });
    }
}