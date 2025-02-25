import { App,Plugin,PluginSettingTab,Setting,WorkspaceLeaf,Notice,ItemView,TextAreaComponent,DropdownComponent,ButtonComponent } from 'obsidian';

// Define the tag filter view ID
const VIEW_TYPE_TAG_FILTER='graph-tags';

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
    private refreshButton: HTMLElement;
    private openGraphButton: HTMLElement;
    private plugin: CreatorPlugin;
    private currentQuery: string='';
    private graphLeaf: WorkspaceLeaf|null=null;
    private isApplyingFilter: boolean=false;

    constructor(leaf: WorkspaceLeaf,plugin: CreatorPlugin) {
        super(leaf);
        this.plugin=plugin;
    }

    getViewType(): string { return VIEW_TYPE_TAG_FILTER; }
    getDisplayText(): string { return "Content Creation"; }
    getIcon(): string { return "tag"; }

    async onOpen(): Promise<void> {
        const container=this.containerEl.children[1];
        container.empty();

        //Header
        const mainContainer=container.createDiv('tag-filter-main-container');
        mainContainer.addClass('center');
        const header=mainContainer.createEl('div',{ cls: 'tag-filter-header' });
        header.createEl('h3',{ text: 'Filter Graph by Tags' });
        header.addClass('center');

        // Create action buttons section
        const buttonsSection=mainContainer.createDiv('buttons-section');

        // Open graph button
        this.openGraphButton=buttonsSection.createEl('button',{ cls: 'mod-cta' });
        this.openGraphButton.setText('Open Graph View');
        this.openGraphButton.addClass('center');
        this.openGraphButton.addEventListener('click',() => {
            this.openGraphView();
        });

        const tagsSection=mainContainer.createDiv('tags-section');
        const selectButtons=tagsSection.createDiv('select-buttons');
        selectButtons.addClass('center');


        //Select All
        const selectAllBtn=selectButtons.createEl('button',{ cls: 'tag-button' });
        selectAllBtn.setText('Select All');
        selectAllBtn.addEventListener('click',() => { this.setAllTagsSelection(true); });

        //Select None
        const selectNoneBtn=selectButtons.createEl('button',{ cls: 'tag-button' });
        selectNoneBtn.setText('Select None');
        selectNoneBtn.addEventListener('click',() => { this.setAllTagsSelection(false); });

        // Container for the tags
        this.tagsContainer=tagsSection.createDiv('tags-container');
        this.tagsContainer.setText('Loading tags...');
        this.tagsContainer.addClass('center');

        // Add refresh button at the bottom
        this.refreshButton=mainContainer.createEl('button',{ cls: 'refresh-button' });
        this.refreshButton.setText('Refresh Tags');
        this.refreshButton.addEventListener('click',() => {
            this.loadTags();
        });

        await this.loadTags();
        await this.openGraphView();
        this.applyFilterToGraph();
    }

    private async openGraphView() {
        try {
            await this.app.commands.executeCommandById('graph:open');
            const graphLeaves=this.app.workspace.getLeavesOfType('graph');
            if(graphLeaves.length>0) { this.graphLeaf=graphLeaves[0]; }
        } catch(error) {
            console.error('Error opening graph view:',error);
        }
    }

    private async applyFilterToGraph() {
        if(this.isApplyingFilter) return;
        this.isApplyingFilter=true;

        try {
            // Make sure the graph view is open
            if(!this.graphLeaf||!this.app.workspace.getLeavesOfType('graph').length) {
                await this.openGraphView();

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

            //Get search input
            const graphView=this.graphLeaf.view;
            let searchInput=null;
            let attempts=0;
            const maxAttempts=3;

            while(!searchInput&&attempts<maxAttempts) {
                await new Promise(resolve => setTimeout(resolve,100));
                searchInput=this.findSearchInput(graphView.containerEl);
                attempts++;
                if(!searchInput&&attempts<maxAttempts) {
                    console.log(`Search input not found, attempt ${attempts} of ${maxAttempts}`);
                }
            }

            if(searchInput) {
                searchInput.value=this.currentQuery;
                console.log(searchInput.value);
                searchInput.dispatchEvent(new Event('input',{ bubbles: false }));
                //searchInput.dispatchEvent(new KeyboardEvent('keydown',{ key: 'Enter',bubbles: false }));
                searchInput.dispatchEvent(new KeyboardEvent('keydown',{ key: 'Escape',bubbles: false }));
                searchInput.blur();
                this.leaf.setEphemeralState({ focus: true });
            } else {
                console.error('Could not find search input in graph view after multiple attempts');
            }
        } catch(error) {
            console.error('Error applying filter to graph:',error);
        } finally {
            this.isApplyingFilter=false;
        }
    }

    private findSearchInput(container: HTMLElement): HTMLInputElement|null {
        //Get filter button and open filter collapsible
        const filterButton=container.querySelector('.graph-control-section.mod-filter.is-collapsed .collapse-icon.is-collapsed');
        if(filterButton) filterButton.click();
        return container.querySelector('.graph-controls input[type="search"]');
    }

    private async loadTags() {
        try {
            this.tagsContainer.empty();
            this.tagsContainer.setText('Loading tags...');

            const allTags=await this.plugin.getAllTags();

            const excludedTagsSet=new Set(this.plugin.settings.excludedTags.map(tag => tag.toLowerCase()));
            const filteredTags=allTags.filter(tag => !excludedTagsSet.has(tag.toLowerCase()));

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

            this.updateQueryFromTags();

        } catch(error) {
            console.error('Error loading tags:',error);
            this.tagsContainer.setText('Error loading tags. Please try again.');
        }
    }

    private setAllTagsSelection(checked: boolean) {
        this.tagsContainer.querySelectorAll('input[type="checkbox"]').forEach((checkbox: HTMLInputElement) => {
            checkbox.checked=checked;
        });
        this.updateQueryFromTags();
    }

    private updateQueryFromTags() {
        try {
            const checkedTags=Array.from(this.tagsContainer.querySelectorAll('input[type="checkbox"]:checked')).map(checkbox => (checkbox as HTMLInputElement).dataset.tag);
            const exclusions=`(${this.plugin.settings.excludedTags.map(tag => ` -#${tag}`).join('')} )`;
            let query='';

            //If nothing checked => filter out exluded
            if(checkedTags.length===0) {
                if(this.plugin.settings.excludedTags.length>0)
                    query=exclusions;
             //If something checked => filter wanted tags + filter out exluded
            } else {
                query=`( ${checkedTags.map(tag => `#${tag}`).join(' OR ')} )`;
                if(this.plugin.settings.excludedTags.length>0)
                    query+=` ${exclusions}`;
            }

            this.currentQuery=query;
            console.log(query);
            this.applyFilterToGraph();

        } catch(error) {
            console.error('Error updating query from tags:',error);
        }
    }

    async onClose() {
        if(this.refreshButton) {
            this.refreshButton.removeEventListener('click',this.loadTags.bind(this));
        }
        if(this.openGraphButton) {
            this.openGraphButton.removeEventListener('click',this.openGraphView.bind(this));
        }
    }
}

export default class CreatorPlugin extends Plugin {
    settings: CreatorPluginSettings;

    async onload() {
        await this.loadSettings();

        console.log("loading "+this.manifest.name+" plugin: v"+this.manifest.version)

        this.registerView(
            VIEW_TYPE_TAG_FILTER,
            (leaf) => new TagFilterView(leaf,this)
        );


        const ribbonIconEl=this.addRibbonIcon('tag','Content Creation',(evt: MouseEvent) => {
            this.activateView();
        });
        ribbonIconEl.addClass('creator-plugin-ribbon-class');

        this.addCommand({
            id: 'open-graph-tag-filter',
            name: 'Open Graph Tag Filter',
            callback: () => {
                this.activateView();
            }
        });

        this.addSettingTab(new CreatorSettingTab(this.app,this));
    }


    async activateView() {
        const { workspace }=this.app;
        let leaf=workspace.getLeavesOfType(VIEW_TYPE_TAG_FILTER)[0];

        if(!leaf) {
            leaf=workspace.getRightLeaf(false);
            await leaf.setViewState({
                type: VIEW_TYPE_TAG_FILTER,
                active: true,
            });
        }
        workspace.revealLeaf(leaf);
    }

    async getAllTags() {
        return Object.keys(app.metadataCache.getTags()).map(t => t.substring(1)).sort();
    }

    onunload() {
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
    private excludedTagsContainer: HTMLElement;
    private tagDropdown: DropdownComponent;
    private availableTags: string[]=[];

    constructor(app: App,plugin: CreatorPlugin) {
        super(app,plugin);
        this.plugin=plugin;
    }

    async display(): Promise<void> {
        const { containerEl }=this;

        containerEl.empty();

        containerEl.createEl('h2',{ text: 'Graph Tag Filter Settings' });

        const excludedTagsSetting=new Setting(containerEl)
            .setName('Excluded Tags')
            .setDesc('Those tag will be never be displayed in graph');

        excludedTagsSetting.settingEl.style.width='100%';
        excludedTagsSetting.settingEl.style.display='grid';
        excludedTagsSetting.settingEl.style.gridTemplateColumns='50% auto';
        excludedTagsSetting.settingEl.style.gridTemplateRows='100%';
        excludedTagsSetting.settingEl.style.maxHeight='20vh';

        excludedTagsSetting.controlEl.style.display='grid';
        excludedTagsSetting.controlEl.style.gridTemplateColumns='1fr 1fr';
        excludedTagsSetting.controlEl.style.gridTemplateRows='100%';
        excludedTagsSetting.controlEl.style.columnGap='5px';
        excludedTagsSetting.controlEl.style.maxHeight='100%';

        const tagSelectionContainer=excludedTagsSetting.controlEl.createDiv('tag-selection-container');
        tagSelectionContainer.style.width='100%';
        tagSelectionContainer.style.display='grid';
        tagSelectionContainer.style.gridTemplateColumns='1fr auto';
        tagSelectionContainer.style.gridTemplateRows='100%';
        tagSelectionContainer.style.columnGap='4px';



        this.tagDropdown=new DropdownComponent(tagSelectionContainer);
        this.tagDropdown.addOption('','Select a tag...');

        const addButton=new ButtonComponent(tagSelectionContainer);
        addButton.setButtonText('Add');
        addButton.onClick(async () => {
            const selectedTag=this.tagDropdown.getValue();
            if(selectedTag&&!this.plugin.settings.excludedTags.includes(selectedTag)) {
                this.plugin.settings.excludedTags.push(selectedTag);
                await this.plugin.saveSettings();
                this.updateTagsDropdown();
                this.updateExcludedTagsList();
                this.tagDropdown.setValue('');
            }
        });

        this.excludedTagsContainer=excludedTagsSetting.controlEl.createDiv('excluded-tags-list');
        this.excludedTagsContainer.style.maxHeight='100%';
        this.excludedTagsContainer.style.overflowY='auto';

        this.updateTagsDropdown();
        this.updateExcludedTagsList();
    }
    private async updateTagsDropdown() {
        this.availableTags=await this.plugin.getAllTags();
        this.tagDropdown.selectEl.innerHTML='';

        this.availableTags.forEach(tag => {
            if(!this.plugin.settings.excludedTags.includes(tag))
                this.tagDropdown.addOption(tag,tag);
        });
        console.log("update dropdown");
    }

    private updateExcludedTagsList() {
        // Clear the container
        this.excludedTagsContainer.empty();

        // If no excluded tags, show a message
        if(this.plugin.settings.excludedTags.length===0) {
            const emptyMessage=this.excludedTagsContainer.createDiv('no-tags-message');
            emptyMessage.setText('No excluded tags');
            emptyMessage.style.fontStyle='italic';
            emptyMessage.style.color='var(--text-muted)';
            return;
        }

        // Create a list of excluded tags with delete buttons
        this.plugin.settings.excludedTags.forEach(tag => {
            const tagItem=this.excludedTagsContainer.createDiv('excluded-tag-item');
            tagItem.style.display='grid';
            tagItem.style.gridTemplateColumns='1fr auto';
            tagItem.style.columnGap='2px';
            tagItem.style.borderLeft="1px solid var(--color-base-35)";

            // Tag name
            const tagName=tagItem.createDiv('tag-name');
            tagName.style.display="flex";
            tagName.style.textAlign="center"
            tagItem.style.alignItems="center";
            tagName.style.justifyContent="center";
            tagName.setText(tag);

            // Delete button
            const deleteButton=tagItem.createEl('button',{ cls: 'delete-tag-button' });
            deleteButton.style.boxShadow="none"
            deleteButton.style.background="none"
            deleteButton.setText('✕');


            deleteButton.addEventListener('click',async () => {
                // Remove the tag from the settings
                this.plugin.settings.excludedTags=this.plugin.settings.excludedTags.filter(t => t!==tag);
                await this.plugin.saveSettings();

                this.updateTagsDropdown();
                this.updateExcludedTagsList();
            });

            // Hover state for delete button
            deleteButton.addEventListener('mouseenter',() => {
                deleteButton.style.color='var(--text-error)';
            });

            deleteButton.addEventListener('mouseleave',() => {
                deleteButton.style.color='var(--text-muted)';
            });
        });
    }
}