import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, Notice, ButtonComponent, ColorComponent } from 'obsidian';

interface GraphFilterPluginSettings {
    excludedTags: string[];
    tagColors: Record<string, string>; // Store color for each tag
}

const DEFAULT_SETTINGS: GraphFilterPluginSettings = {
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

class TagFilterPanel {
    private containerEl: HTMLElement;
    private tagsContainer: HTMLElement;
    private plugin: GraphFilterPlugin;
    private currentQuery: string = '';
    private graphLeaf: WorkspaceLeaf;
    private isApplyingFilter: boolean = false;
    private isVisible: boolean = false;

    constructor(app: App, plugin: GraphFilterPlugin, graphLeaf: any) {
        this.plugin = plugin;
        this.graphLeaf = graphLeaf;

        // Create the container element
        this.containerEl = node("div", {
            class: "graph-controls tag-filter-panel",
        });
        // Add the container to the document body
        this.graphLeaf.view.dataEngine.controlsEl.parentElement.appendChild(this.containerEl);
        // Build the UI
        this.buildUI();
        this.hide();
    }

    private buildUI(): void {
        this.containerEl.empty();

        // Header with close button
        const header = this.containerEl.createDiv('tag-filter-header');

        const titleContainer = header.createDiv('tag-filter-title-container');
        titleContainer.createEl('h3', { text: 'Filter Graph by Tags' });

        const closeButton = header.createDiv('tag-filter-close');
        closeButton.innerHTML = '×';
        closeButton.addEventListener('click', () => { this.hide(); });

        // Tags section
        const tagsSection = this.containerEl.createDiv('tags-section');
        const selectButtons = tagsSection.createDiv('select-buttons');

        // Select All button
        const selectAllBtn = selectButtons.createEl('button', { cls: 'tag-button' });
        selectAllBtn.setText('Select All');
        selectAllBtn.addEventListener('click', () => { this.setAllTagsSelection(true); });

        // Select None button
        const selectNoneBtn = selectButtons.createEl('button', { cls: 'tag-button' });
        selectNoneBtn.setText('Select None');
        selectNoneBtn.addEventListener('click', () => { this.setAllTagsSelection(false); });

        // Tags container
        this.tagsContainer = tagsSection.createDiv('tags-container');
        this.tagsContainer.setText('Loading tags...');

        // Action buttons
        const actionsContainer = this.containerEl.createDiv('tag-filter-actions');

        // Refresh button
        const refreshButton = actionsContainer.createEl('button', { cls: 'refresh-button' });
        refreshButton.setText('Refresh Tags');
        refreshButton.addEventListener('click', () => { this.loadTags(); });
    }

    public toggle(): void {
        this.isVisible = !this.isVisible;
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    public show(): void {
        console.log("show")
        this.loadTags();
        this.isVisible = true;
        this.containerEl.removeClass("is-close");
    }

    public hide(): void {
        console.log("hide")
        this.isVisible = false
        this.containerEl.addClass("is-close");
    }


    private async applyColorsToGraph() {
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

        // For main graph
        (this.graphLeaf as any).view.dataEngine.colorGroupOptions.setColorQueries(colorGroups);
        (this.graphLeaf as any).view.dataEngine.requestUpdateSearch();
    }

    private async applyFilterToGraph() {
        if (this.isApplyingFilter) return;
        this.isApplyingFilter = true;

        try {
            // For main graph
            (this.graphLeaf as any).view.dataEngine.filterOptions.search.inputEl.value = this.currentQuery;
            (this.graphLeaf as any).view.dataEngine.requestUpdateSearch();
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

                // Checkboxes
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

                // Color picker
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

            // If nothing checked => filter out excluded
            if (checkedTags.length === 0) {
                if (this.plugin.settings.excludedTags.length > 0)
                    query = exclusions;
                // If something checked => filter wanted tags + filter out excluded
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

    public destroy() {
        // Clean up event listeners
        window.removeEventListener('resize', this.handleResize);

        // Remove the element from DOM
        this.containerEl.remove();
    }
}

export default class GraphFilterPlugin extends Plugin {
    settings: GraphFilterPluginSettings;
    private graphButtons: Map<string, HTMLElement> = new Map();
    private tagFilterPanels: Map<string, TagFilterPanel> = new Map();

    async onload() {
        await this.loadSettings();

        console.log("loading " + this.manifest.name + " plugin: v" + this.manifest.version);

        this.addSettingTab(new GraphFilterSettingTab(this.app, this));

        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                this.app.workspace.getLeavesOfType('graph').forEach(leaf => {
                    this.addButtonToGraphControls(leaf);
                });
                this.app.workspace.getLeavesOfType('localgraph').forEach(leaf => {
                    this.addButtonToLocalGraphControls(leaf);
                });
            })
        );


    }


    private addButtonToLocalGraphControls(leaf: any) {


    }

    private addButtonToGraphControls(leaf: any) {
        if (this.graphButtons.has(leaf.id)) return;
        console.log(leaf)
        const controlsContainer = leaf.view.dataEngine.controlsEl.parentElement

        // Create your custom button
        const customButton = document.createElement('button');
        customButton.className = 'clickable-icon graph-control-button';
        customButton.setAttribute('aria-label', 'Filter by Tags');

        // Add a tag icon (using Lucide icon style that Obsidian uses)
        const iconSpan = document.createElement('span');
        iconSpan.className = 'svg-icon';
        iconSpan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-tag"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>`;
        customButton.appendChild(iconSpan);

        // Store reference to the button
        this.graphButtons.set(leaf.id, customButton);

        // Create panel if it doesn't exist
        if (!this.tagFilterPanels.has(leaf.id)) {
            const panel = new TagFilterPanel(this.app, this, leaf);
            this.tagFilterPanels.set(leaf.id, panel);
        }

        // Add click listener to toggle panel
        customButton.addEventListener('click', () => {
            const panel = this.tagFilterPanels.get(leaf.id);
            panel?.show();
        });

        // Add the button to the controls
        controlsContainer.appendChild(customButton);
    }

    async getAllTags() {
        return Object.keys((this.app.metadataCache as any).getTags()).map(t => t.substring(1)).sort();
    }

    onunload() {
        // Remove all graph buttons we've added
        this.graphButtons.forEach((button) => {
            button.remove();
        });
        this.graphButtons.clear();

        // Destroy all panels
        this.tagFilterPanels.forEach((panel) => {
            panel.destroy();
        });
        this.tagFilterPanels.clear();
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
    private tagDropdown: any; // Using any for DropdownComponent
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

        // Create dropdown component
        const dropdownEl = tagSelectionContainer.createEl('select');
        this.tagDropdown = {
            selectEl: dropdownEl,
            addOption: (value: string, text: string) => {
                const option = document.createElement('option');
                option.value = value;
                option.text = text;
                dropdownEl.appendChild(option);
            },
            getValue: () => dropdownEl.value,
            setValue: (value: string) => { dropdownEl.value = value; }
        };

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

        await this.updateTagsDropdown();
        this.updateExcludedTagsList();
    }

    private async updateTagsDropdown() {
        this.availableTags = await this.plugin.getAllTags();
        this.tagDropdown.selectEl.innerHTML = '';
        this.tagDropdown.addOption('', 'Select a tag...');

        this.availableTags.forEach(tag => {
            if (!this.plugin.settings.excludedTags.includes(tag))
                this.tagDropdown.addOption(tag, tag);
        });
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
            tagName.style.textAlign = "center";
            tagItem.style.alignItems = "center";
            tagName.style.justifyContent = "center";
            tagName.setText(tag);

            // Delete button
            const deleteButton = tagItem.createEl('button', { cls: 'delete-tag-button' });
            deleteButton.style.boxShadow = "none";
            deleteButton.style.background = "none";
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


//Collapsed
/*
<div class="tree-item graph-control-section mod-forces is-collapsed">
    <div class="tree-item-self mod-collapsible">
        <div class="tree-item-icon collapse-icon is-collapsed"> <svg xmlns="http://www.w3.org/2000/svg" width="24"
                height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke - width="2" stroke -
                linecap="round" stroke - linejoin="round" class="svg-icon right-triangle">
                <path d="M3 8L12 17L21 8"> </path>
            </svg> </div>
        <div class="tree-item-inner">
            <header class="graph-control-section-header">Forces</header>
        </div>
    </div>
</div>
*/

/*

<div class="tree-item graph-control-section mod-forces">
    <div class="tree-item-self mod-collapsible">
        <div class="tree-item-icon collapse-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round" class="svg-icon right-triangle">
                <path d="M3 8L12 17L21 8"></path>
            </svg></div>
        <div class="tree-item-inner">
            <header class="graph-control-section-header">Forces</header>
        </div>
    </div>


    <div class="tree-item-children" style="">
        <div class="setting-item mod-slider">
            <div class="setting-item-info">
                <div class="setting-item-name">Center force</div>
                <div class="setting-item-description"></div>
            </div>
            <div class="setting-item-control"><input class="slider" type="range" min="0" max="1" step="any"></div>
        </div>
        <div class="setting-item mod-slider">
            <div class="setting-item-info">
                <div class="setting-item-name">Repel force</div>
                <div class="setting-item-description"></div>
            </div>
            <div class="setting-item-control"><input class="slider" type="range" min="0" max="20" step="any"></div>
        </div>
        <div class="setting-item mod-slider">
            <div class="setting-item-info">
                <div class="setting-item-name">Link force</div>
                <div class="setting-item-description"></div>
            </div>
            <div class="setting-item-control"><input class="slider" type="range" min="0" max="1" step="any"></div>
        </div>
        <div class="setting-item mod-slider">
            <div class="setting-item-info">
                <div class="setting-item-name">Link distance</div>
                <div class="setting-item-description"></div>
            </div>
            <div class="setting-item-control"><input class="slider" type="range" min="30" max="500" step="1"></div>
        </div>
    </div>
</div>

*/