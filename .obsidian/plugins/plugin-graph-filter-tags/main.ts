import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, Notice, ItemView, TextAreaComponent, DropdownComponent, ButtonComponent, ColorComponent } from 'obsidian';

const VIEW_TYPE_TAG_FILTER = 'graph-tags-view';

interface GraphFilterPluginSettings {
    defaultCharactersFolder: string;
    excludedTags: string[];
    tagColors: Record<string, string>; // Store color for each tag
}

const DEFAULT_SETTINGS: GraphFilterPluginSettings = {
    defaultCharactersFolder: '',
    excludedTags: [],
    tagColors: {}
}

export interface NodeProperties {
    children?: HTMLElement[];
    attributes?: Record<string, string>;
    text?: string;
    class?: string;
    style?: Record<string, string>;
}

export function node<K extends keyof HTMLElementTagNameMap>(tag: K, properties?: NodeProperties): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);

    if (properties?.children)
        for (const c of properties.children) element.appendChild(c);

    if (properties?.class)
        element.setAttribute('class', properties.class);

    if (properties?.attributes)
        for (const [k, v] of Object.entries(properties.attributes)) element.setAttribute(k, v);

    if (properties?.text)
        element.textContent = properties.text;

    if (properties?.style)
        for (const [k, v] of Object.entries(properties.style)) element.attributeStyleMap.set(k, v);

    return element;
}


class TagFilterView extends ItemView {
    private tagsContainer: HTMLElement;
    private refreshButton: HTMLElement;
    private openGraphButton: HTMLElement;
    private plugin: GraphFilterPlugin;
    private currentQuery: string = '';
    private graphLeaf: WorkspaceLeaf | null = null;
    private isApplyingFilter: boolean = false;

    constructor(leaf: WorkspaceLeaf, plugin: GraphFilterPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string { return VIEW_TYPE_TAG_FILTER; }
    getDisplayText(): string { return "Graph Tag Filter"; }
    getIcon(): string { return "tag"; }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();

        //Header
        const mainContainer = container.createDiv('tag-filter-main-container');
        mainContainer.addClass('center');
        const header = mainContainer.createEl('div', { cls: 'tag-filter-header' });
        header.createEl('h3', { text: 'Filter Graph by Tags' });
        header.addClass('center');

        const buttonsSection = mainContainer.createDiv('buttons-section');

        // Open graph button
        this.openGraphButton = buttonsSection.createEl('button', { cls: 'mod-cta' });
        this.openGraphButton.setText('Open Graph View');
        this.openGraphButton.addClass('center');
        this.openGraphButton.addEventListener('click', () => { this.getGraphView(); });

        const tagsSection = mainContainer.createDiv('tags-section');
        const selectButtons = tagsSection.createDiv('select-buttons');
        selectButtons.addClass('center');

        //Select All
        const selectAllBtn = selectButtons.createEl('button', { cls: 'tag-button' });
        selectAllBtn.setText('Select All');
        selectAllBtn.addEventListener('click', () => { this.setAllTagsSelection(true); });

        //Select None
        const selectNoneBtn = selectButtons.createEl('button', { cls: 'tag-button' });
        selectNoneBtn.setText('Select None');
        selectNoneBtn.addEventListener('click', () => { this.setAllTagsSelection(false); });

        this.tagsContainer = tagsSection.createDiv('tags-container');
        this.tagsContainer.setText('Loading tags...');
        this.tagsContainer.addClass('center');

        // Refresh button
        this.refreshButton = mainContainer.createEl('button', { cls: 'refresh-button' });
        this.refreshButton.setText('Refresh Tags');
        this.refreshButton.addEventListener('click', () => { this.loadTags(); });

        await this.loadTags();
        // this.getGraphView()
        // this.applyFilterToGraph();
        // this.applyColorsToGraph();
    }

    private async applyColorsToGraph() {
        await this.getGraphView();
        const colorGroups: { query: string, color: { a: number, rgb: number } }[] = [];
        Object.entries(this.plugin.settings.tagColors).forEach(([tag, colorHex]) => {
            if (colorHex) {
                const rgb = parseInt(colorHex.replace('#', ''), 16);
                colorGroups.push({
                    query: `tag:#${tag}`,
                    color: { a: 1, rgb }
                });
            }
        });

        //For main graph
        (this.graphLeaf as any).view.dataEngine.colorGroupOptions.setColorQueries(colorGroups);
        (this.graphLeaf as any).view.dataEngine.requestUpdateSearch();

        //for local graph
        // (this.graphLeaf as any).view.engine.colorGroupOptions.setColorQueries(colorGroups);
        // (this.graphLeaf as any).view.engine.requestUpdateSearch();
    }

    private async getGraphView() {
        //For local graph
        // this.graphLeaf = this.app.workspace.getLeavesOfType('localgraph')[0]
        // return

        if (this.graphLeaf && (this.graphLeaf as any).view._loaded && this.graphLeaf.getViewState().type == "graph") return
        try {
            this.graphLeaf = this.app.workspace.getLeaf('tab');
            await this.graphLeaf.setViewState({ type: 'graph', state: {} });
            this.app.workspace.revealLeaf(this.graphLeaf);
        } catch (error) {
            console.error('Error opening graph view in new tab:', error);
        }
    }

    private async applyFilterToGraph() {
        if (this.isApplyingFilter) return;
        this.isApplyingFilter = true;

        try {
            await this.getGraphView();
            //For main graph
            (this.graphLeaf as any).view.dataEngine.filterOptions.search.inputEl.value = this.currentQuery;
            (this.graphLeaf as any).view.dataEngine.requestUpdateSearch()

            //for local graph
            // (this.graphLeaf as any).view.engine.filterOptions.search.inputEl.value = this.currentQuery;
            // (this.graphLeaf as any).view.engine.requestUpdateSearch()

        } catch (error) {
            console.error('Error applying filter to graph:', error);
        } finally {
            this.isApplyingFilter = false;
        }
    }

    private async loadTags() {
        try {
            this.tagsContainer.empty();
            this.tagsContainer.setText('Loading tags...');

            const allTags = await this.plugin.getAllTags();

            const excludedTagsSet = new Set(this.plugin.settings.excludedTags.map(tag => tag.toLowerCase()));
            const filteredTags = allTags.filter(tag => !excludedTagsSet.has(tag.toLowerCase()));

            this.tagsContainer.empty();

            if (filteredTags.length === 0) {
                this.tagsContainer.setText('No tags found in your vault.');
                return;
            }

            filteredTags.forEach(tag => {
                const tagContainer = this.tagsContainer.createDiv('tag-checkbox-container');

                //Checboxes
                const checkbox = tagContainer.createEl('input');
                checkbox.type = 'checkbox';
                checkbox.id = `tag-checkbox-${tag}`;
                checkbox.dataset.tag = tag;
                checkbox.checked = true;
                checkbox.addEventListener('change', () => { this.updateQueryFromTags(); });

                // Labels
                const label = tagContainer.createEl('label');
                label.htmlFor = checkbox.id;
                label.setText(tag);

                //Color picker
                const colorPickerContainer = tagContainer.createDiv('tag-color-picker-container');
                const storedColor = this.plugin.settings.tagColors[tag] || '#ffffff';

                const colorPicker = colorPickerContainer.createEl('input');
                colorPicker.type = 'color';
                colorPicker.value = storedColor;
                colorPicker.classList.add('tag-color-picker');
                colorPicker.dataset.tag = tag;

                colorPicker.addEventListener('input', async (e) => {
                    const colorValue = (e.target as HTMLInputElement).value;
                    this.plugin.settings.tagColors[tag] = colorValue;
                    await this.plugin.saveSettings();
                    this.applyColorsToGraph();
                });
            });
            this.updateQueryFromTags();
        } catch (error) {
            console.error('Error loading tags:', error);
            this.tagsContainer.setText('Error loading tags. Please try again.');
        }
    }

    private setAllTagsSelection(checked: boolean) {
        this.tagsContainer.querySelectorAll('input[type="checkbox"]').forEach((checkbox: HTMLInputElement) => {
            checkbox.checked = checked;
        });
        this.updateQueryFromTags();
    }

    private updateQueryFromTags() {
        try {
            const checkedTags = Array.from(this.tagsContainer.querySelectorAll('input[type="checkbox"]:checked')).map(checkbox => (checkbox as HTMLInputElement).dataset.tag);
            const exclusions = `(${this.plugin.settings.excludedTags.map(tag => ` -#${tag}`).join('')} )`;
            let query = '';

            //If nothing checked => filter out exluded
            if (checkedTags.length === 0) {
                if (this.plugin.settings.excludedTags.length > 0)
                    query = exclusions;
                //If something checked => filter wanted tags + filter out exluded
            } else {
                query = `( ${checkedTags.map(tag => `#${tag}`).join(' OR ')} )`;
                if (this.plugin.settings.excludedTags.length > 0)
                    query += ` ${exclusions}`;
            }

            this.currentQuery = query;
            this.applyFilterToGraph();

        } catch (error) {
            console.error('Error updating query from tags:', error);
        }
    }

    async onClose() {
        if (this.refreshButton) {
            this.refreshButton.removeEventListener('click', this.loadTags.bind(this));
        }
        if (this.openGraphButton) {
            this.openGraphButton.removeEventListener('click', this.getGraphView.bind(this));
        }
    }
}

export default class GraphFilterPlugin extends Plugin {
    settings: GraphFilterPluginSettings;

    async onload() {
        await this.loadSettings();

        console.log("loading " + this.manifest.name + " plugin: v" + this.manifest.version)

        this.registerView(
            VIEW_TYPE_TAG_FILTER,
            (leaf) => new TagFilterView(leaf, this)
        );

        const ribbonIconEl = this.addRibbonIcon('tag', 'Graph Tag Filter', (evt: MouseEvent) => {
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

        this.addSettingTab(new GraphFilterSettingTab(this.app, this));


        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                const graphLeaves = this.app.workspace.getLeavesOfType('graph');
                if (graphLeaves.length > 0) {
                    this.addButtonToGraphControls();
                }
            })
        );

    }

    // In your GraphFilterPlugin class or TagFilterView class:

    private addButtonToGraphControls() {
        // Wait a moment for the graph view to be fully loaded
        setTimeout(() => {
            // Find the graph controls container
            const graphView = this.app.workspace.getLeavesOfType('graph')[0]?.view;
            if (!graphView) return;
            
            const controlsContainer = graphView.containerEl.querySelector('.graph-controls');
            if (!controlsContainer) return;
            
            // Create your custom button
            const customButton = document.createElement('button');
            customButton.className = 'clickable-icon graph-control-button';
            customButton.setAttribute('aria-label', 'Filter by Tags');
            
            // Add a tag icon (using Lucide icon style that Obsidian uses)
            const iconSpan = document.createElement('span');
            iconSpan.className = 'svg-icon';
            iconSpan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-tag"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>`;
            customButton.appendChild(iconSpan);
            
            // Add click listener
            customButton.addEventListener('click', () => {
                // Your button action here, e.g., opening your filter modal
                this.activateView();
            });
            
            // Add the button to the controls
            controlsContainer.appendChild(customButton);
        }, 1000); // Delay to ensure graph is loaded
    }

    
    async activateView() {
        const { workspace } = this.app;
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_TAG_FILTER)[0];

        if (!leaf) {
            leaf = workspace.getRightLeaf(false) as WorkspaceLeaf;
            await leaf.setViewState({
                type: VIEW_TYPE_TAG_FILTER,
                active: true,
            });
        }
        workspace.revealLeaf(leaf);
    }

    async getAllTags() {
        return Object.keys((this.app.metadataCache as any).getTags()).map(t => t.substring(1)).sort();
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_TAG_FILTER);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class GraphFilterSettingTab extends PluginSettingTab {
    plugin: GraphFilterPlugin;
    private excludedTagsContainer: HTMLElement;
    private tagDropdown: DropdownComponent;
    private availableTags: string[] = [];

    constructor(app: App, plugin: GraphFilterPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async display(): Promise<void> {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'Graph Tag Filter Settings' });

        const excludedTagsSetting = new Setting(containerEl)
            .setName('Excluded Tags')
            .setDesc('These tags will never be displayed in graph');

        excludedTagsSetting.settingEl.style.width = '100%';
        excludedTagsSetting.settingEl.style.display = 'grid';
        excludedTagsSetting.settingEl.style.gridTemplateColumns = '50% auto';
        excludedTagsSetting.settingEl.style.gridTemplateRows = '100%';
        excludedTagsSetting.settingEl.style.maxHeight = '20vh';

        excludedTagsSetting.controlEl.style.display = 'grid';
        excludedTagsSetting.controlEl.style.gridTemplateColumns = '1fr 1fr';
        excludedTagsSetting.controlEl.style.gridTemplateRows = '100%';
        excludedTagsSetting.controlEl.style.columnGap = '5px';
        excludedTagsSetting.controlEl.style.maxHeight = '100%';

        const tagSelectionContainer = excludedTagsSetting.controlEl.createDiv('tag-selection-container');
        tagSelectionContainer.style.width = '100%';
        tagSelectionContainer.style.display = 'grid';
        tagSelectionContainer.style.gridTemplateColumns = '1fr auto';
        tagSelectionContainer.style.gridTemplateRows = '100%';
        tagSelectionContainer.style.columnGap = '4px';

        this.tagDropdown = new DropdownComponent(tagSelectionContainer);
        this.tagDropdown.addOption('', 'Select a tag...');

        const addButton = new ButtonComponent(tagSelectionContainer);
        addButton.setButtonText('Add');
        addButton.onClick(async () => {
            const selectedTag = this.tagDropdown.getValue();
            if (selectedTag && !this.plugin.settings.excludedTags.includes(selectedTag)) {
                this.plugin.settings.excludedTags.push(selectedTag);
                await this.plugin.saveSettings();
                this.updateTagsDropdown();
                this.updateExcludedTagsList();
                this.tagDropdown.setValue('');
            }
        });

        this.excludedTagsContainer = excludedTagsSetting.controlEl.createDiv('excluded-tags-list');
        this.excludedTagsContainer.style.maxHeight = '100%';
        this.excludedTagsContainer.style.overflowY = 'auto';

        this.updateTagsDropdown();
        this.updateExcludedTagsList();
    }

    private async updateTagsDropdown() {
        this.availableTags = await this.plugin.getAllTags();
        this.tagDropdown.selectEl.innerHTML = '';

        this.availableTags.forEach(tag => {
            if (!this.plugin.settings.excludedTags.includes(tag))
                this.tagDropdown.addOption(tag, tag);
        });
        console.log("update dropdown");
    }

    private updateExcludedTagsList() {
        // Clear the container
        this.excludedTagsContainer.empty();

        // If no excluded tags, show a message
        if (this.plugin.settings.excludedTags.length === 0) {
            const emptyMessage = this.excludedTagsContainer.createDiv('no-tags-message');
            emptyMessage.setText('No excluded tags');
            emptyMessage.style.fontStyle = 'italic';
            emptyMessage.style.color = 'var(--text-muted)';
            return;
        }

        // Create a list of excluded tags with delete buttons
        this.plugin.settings.excludedTags.forEach(tag => {
            const tagItem = this.excludedTagsContainer.createDiv('excluded-tag-item');
            tagItem.style.display = 'grid';
            tagItem.style.gridTemplateColumns = '1fr auto';
            tagItem.style.columnGap = '2px';
            tagItem.style.borderLeft = "1px solid var(--color-base-35)";

            // Tag name
            const tagName = tagItem.createDiv('tag-name');
            tagName.style.display = "flex";
            tagName.style.textAlign = "center"
            tagItem.style.alignItems = "center";
            tagName.style.justifyContent = "center";
            tagName.setText(tag);

            // Delete button
            const deleteButton = tagItem.createEl('button', { cls: 'delete-tag-button' });
            deleteButton.style.boxShadow = "none"
            deleteButton.style.background = "none"
            deleteButton.setText('✕');

            deleteButton.addEventListener('click', async () => {
                // Remove the tag from the settings
                this.plugin.settings.excludedTags = this.plugin.settings.excludedTags.filter(t => t !== tag);
                await this.plugin.saveSettings();

                this.updateTagsDropdown();
                this.updateExcludedTagsList();
            });

            // Hover state for delete button
            deleteButton.addEventListener('mouseenter', () => {
                deleteButton.style.color = 'var(--text-error)';
            });

            deleteButton.addEventListener('mouseleave', () => {
                deleteButton.style.color = 'var(--text-muted)';
            });
        });
    }
}