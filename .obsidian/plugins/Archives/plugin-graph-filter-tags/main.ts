import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, Notice, ButtonComponent, ColorComponent } from 'obsidian';

interface GraphFilterPluginSettings {
    excludedTags: string[];
    tagColors: Record<string, string>; //Store color for each tag
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

class TagFilterCollapsible {
    private containerEl: HTMLElement;
    private tagsContainer: HTMLElement;
    private collapseEl: HTMLElement;
    private childrenEl: HTMLElement;
    private plugin: GraphFilterPlugin;
    private currentQuery: string = '';
    private graphLeaf: WorkspaceLeaf;
    private graphType: string;
    private isApplyingFilter: boolean = false;
    private isCollapsed: boolean = true;

    constructor(app: App, plugin: GraphFilterPlugin, graphLeaf: WorkspaceLeaf, graphType: string) {
        this.plugin = plugin;
        this.graphLeaf = graphLeaf;
        this.graphType = graphType;

        this.containerEl = node("div", { class: "tree-item graph-control-section mod-tag-filter is-collapsed" });
        if (this.graphType == "local")
            (this.graphLeaf.view as any).engine.controlsEl.appendChild(this.containerEl);
        else
            (this.graphLeaf.view as any).dataEngine.controlsEl.appendChild(this.containerEl);

        this.buildUI();
    }

    private buildUI(): void {
        this.containerEl.empty();

        const headerEl = node("div", { class: "tree-item-self mod-collapsible" });
        this.containerEl.appendChild(headerEl);

        this.collapseEl = node("div", { class: "tree-item-icon collapse-icon is-collapsed" });
        const triangleSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        triangleSvg.setAttribute("width", "24");
        triangleSvg.setAttribute("height", "24");
        triangleSvg.setAttribute("viewBox", "0 0 24 24");
        triangleSvg.setAttribute("fill", "none");
        triangleSvg.setAttribute("stroke", "currentColor");
        triangleSvg.setAttribute("stroke-width", "2");
        triangleSvg.setAttribute("stroke-linecap", "round");
        triangleSvg.setAttribute("stroke-linejoin", "round");
        triangleSvg.setAttribute("class", "svg-icon right-triangle");
        const trianglePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        trianglePath.setAttribute("d", "M3 8L12 17L21 8");

        triangleSvg.appendChild(trianglePath);
        this.collapseEl.appendChild(triangleSvg);
        headerEl.appendChild(this.collapseEl);

        const titleContainerEl = node("div", { class: "tree-item-inner" });

        const headerTitle = node("header", { class: "graph-control-section-header", text: "Filter by Tags" });
        headerEl.addEventListener('click', () => { this.toggleCollapse(); });
        this.childrenEl = node("div", { class: "tree-item-children" });

        headerEl.appendChild(titleContainerEl);
        titleContainerEl.appendChild(headerTitle);
        this.containerEl.appendChild(this.childrenEl);
        this.childrenEl.style.display = "none"

        this.buildPanelContent();
        this.applyColorsToGraph();
    }

    private buildPanelContent(): void {
        this.childrenEl.empty();

        const buttonContainer = node("div", { class: "tag-filter-buttons" });
        const selectAllBtn = node("button", { class: 'tag-button', text: 'Select All' });
        const selectNoneBtn = node("button", { class: 'tag-button', text: 'Select None' });

        this.childrenEl.appendChild(buttonContainer);
        buttonContainer.appendChild(selectAllBtn);
        buttonContainer.appendChild(selectNoneBtn);

        this.tagsContainer = node("div", { class: 'tags-container' });
        this.childrenEl.appendChild(this.tagsContainer);
        this.tagsContainer.setText('Loading tags...');

        const refreshButton = node("button", {
            class: 'refresh-button',
            text: 'Refresh Tags'
        });
        this.childrenEl.appendChild(refreshButton);


        selectAllBtn.addEventListener('click', (e) => { this.setAllTagsSelection(true); });
        selectNoneBtn.addEventListener('click', (e) => { this.setAllTagsSelection(false); });
        refreshButton.addEventListener('click', (e) => { this.loadTags(); });

        this.loadTags();
    }

    public toggleCollapse(): void {
        if (this.isCollapsed) {
            this.expandPanel();
        } else {
            this.collapsePanel();
        }
    }

    public collapsePanel(): void {
        this.isCollapsed = true;
        this.containerEl.addClass("is-collapsed");
        this.collapseEl.addClass("is-collapsed");

        //display:none after the transition completes
        setTimeout(() => { if (this.isCollapsed) { this.childrenEl.style.display = "none"; } }, 200);
    }

    public expandPanel(): void {
        this.isCollapsed = false;
        this.childrenEl.style.display = "";
        setTimeout(() => {
            this.containerEl.removeClass("is-collapsed");
            this.collapseEl.removeClass("is-collapsed");
        }, 0);
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
        if (this.graphType == "local") {
            (this.graphLeaf as any).view.engine.colorGroupOptions.setColorQueries(colorGroups);
            (this.graphLeaf as any).view.engine.requestUpdateSearch();
        }
        else {
            (this.graphLeaf as any).view.dataEngine.colorGroupOptions.setColorQueries(colorGroups);
            (this.graphLeaf as any).view.dataEngine.requestUpdateSearch();
        }

    }

    private async applyFilterToGraph() {
        if (this.isApplyingFilter) return;
        this.isApplyingFilter = true;

        try {
            if (this.graphType == "local") {
                (this.graphLeaf as any).view.engine.filterOptions.search.inputEl.value = this.currentQuery;
                (this.graphLeaf as any).view.engine.requestUpdateSearch();
            } else {
                (this.graphLeaf as any).view.dataEngine.filterOptions.search.inputEl.value = this.currentQuery;
                (this.graphLeaf as any).view.dataEngine.requestUpdateSearch();
            }

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

                //Checkboxes
                const checkbox = tagContainer.createEl('input');
                checkbox.type = 'checkbox';
                checkbox.id = `tag-checkbox-${tag}`;
                checkbox.dataset.tag = tag;
                checkbox.checked = true;
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    this.updateQueryFromTags();
                });

                //Labels
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
                    e.stopPropagation();
                    const colorValue = (e.target as HTMLInputElement).value;
                    this.plugin.settings.tagColors[tag] = colorValue;
                    this.applyColorsToGraph();
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

            //If nothing checked => filter out excluded
            if (checkedTags.length === 0) {
                if (this.plugin.settings.excludedTags.length > 0)
                    query = exclusions;
                //If something checked => filter wanted tags + filter out excluded
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
        if (this.containerEl && this.containerEl.parentNode) {
            this.containerEl.remove();
        }
    }
}

export default class GraphFilterPlugin extends Plugin {
    settings: GraphFilterPluginSettings;
    private tagFilterCollapsibles: Map<string, TagFilterCollapsible> = new Map();

    async onload() {
        await this.loadSettings();
        console.log("loading " + this.manifest.name + " plugin: v" + this.manifest.version);
        this.addSettingTab(new GraphFilterSettingTab(this.app, this));
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                this.app.workspace.getLeavesOfType('graph').forEach(leaf => {
                    if (!(leaf.view as any).dataEngine) return
                    this.addFilterToGraph(leaf, "graph");
                });
                this.app.workspace.getLeavesOfType('localgraph').forEach(leaf => {
                    if (!(leaf.view as any).engine) return
                    this.addFilterToGraph(leaf, "local");
                });
            })
        );
    }


    private addFilterToGraph(leaf: any, type: string) {
        if (this.tagFilterCollapsibles.has(leaf.id)) return;

        try {
            const panel = new TagFilterCollapsible(this.app, this, leaf, type);
            this.tagFilterCollapsibles.set(leaf.id, panel);
        } catch (error) {
            console.error('Error adding tag filter to graph:', error);
        }
    }

    async getAllTags() {
        return Object.keys((this.app.metadataCache as any).getTags()).map(t => t.substring(1)).sort();
    }

    onunload() {
        this.tagFilterCollapsibles.forEach((panel) => { panel.destroy(); });
        this.tagFilterCollapsibles.clear();
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
    private tagDropdown: any;
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
        this.availableTags = (await this.plugin.getAllTags()).filter(tag => !this.plugin.settings.excludedTags.includes(tag));
        this.tagDropdown.selectEl.innerHTML = '';
        this.availableTags.forEach(tag => { this.tagDropdown.addOption(tag, tag); });
        this.tagDropdown.setValue(this.availableTags[0]);
    }

    private updateExcludedTagsList() {
        this.excludedTagsContainer.empty();

        if (this.plugin.settings.excludedTags.length === 0) {
            const emptyMessage = this.excludedTagsContainer.createDiv('no-tags-message');
            emptyMessage.setText('No excluded tags');
            emptyMessage.style.fontStyle = 'italic';
            emptyMessage.style.color = 'var(--text-muted)';
            return;
        }

        this.plugin.settings.excludedTags.forEach(tag => {
            const tagItem = this.excludedTagsContainer.createDiv('excluded-tag-item');
            tagItem.style.display = 'grid';
            tagItem.style.gridTemplateColumns = '1fr auto';
            tagItem.style.columnGap = '2px';
            tagItem.style.borderLeft = "1px solid var(--color-base-35)";

            //Tag name
            const tagName = tagItem.createDiv('tag-name');
            tagName.style.display = "flex";
            tagName.style.textAlign = "center";
            tagItem.style.alignItems = "center";
            tagName.style.justifyContent = "center";
            tagName.setText(tag);

            //Delete button
            const deleteButton = tagItem.createEl('button', { cls: 'delete-tag-button' });
            deleteButton.style.boxShadow = "none";
            deleteButton.style.background = "none";
            deleteButton.setText('✕');

            deleteButton.addEventListener('click', async () => {
                //Remove the tag from the settings
                this.plugin.settings.excludedTags = this.plugin.settings.excludedTags.filter(t => t !== tag);
                await this.plugin.saveSettings();

                this.updateTagsDropdown();
                this.updateExcludedTagsList();
            });

            deleteButton.addEventListener('mouseenter', () => {
                deleteButton.style.color = 'var(--text-error)';
            });

            deleteButton.addEventListener('mouseleave', () => {
                deleteButton.style.color = 'var(--text-muted)';
            });
        });
    }
}