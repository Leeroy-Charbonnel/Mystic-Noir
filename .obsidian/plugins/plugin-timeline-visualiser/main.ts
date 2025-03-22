import { App, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile, WorkspaceLeaf, ItemView, ViewStateResult, TFolder, Notice } from 'obsidian';
import { TimelineView, VIEW_TYPE_TIMELINE } from './TimelineView';
import { cleanHtml, cleanLink, parseDateString } from './utils';

interface TimelineVisualizerSettings {
    storiesFolder: string;
    eventsFolder: string;
    charactersFolder: string;
    defaultColor: string;
    characterColor: string;
    storyColor: string;
    eventColor: string;
    characterEventColor: string;
}

const DEFAULT_SETTINGS: TimelineVisualizerSettings = {
    storiesFolder: '',
    eventsFolder: '',
    charactersFolder: '',
    defaultColor: '#888888',
    characterColor: '#F5A623',
    storyColor: '#4A90E2',
    eventColor: '#50C878',
    characterEventColor: '#D36582'
}

export default class TimelineVisualizerPlugin extends Plugin {
    settings: TimelineVisualizerSettings;
    private timelineView: TimelineView | null = null;

    async onload() {
        console.log("Loading Timeline Visualizer Plugin");
        await this.loadSettings();

        this.registerView(
            VIEW_TYPE_TIMELINE,
            (leaf: WorkspaceLeaf) => {
                this.timelineView = new TimelineView(leaf, this);
                return this.timelineView;
            }
        );

        this.addRibbonIcon('clock', 'Open Timeline Visualizer', async () => {
            await this.activateView();
        });

        // Add command to open timeline
        this.addCommand({
            id: 'open-timeline-visualizer',
            name: 'Open Timeline Visualizer',
            callback: () => this.activateView(),
        });

        this.addSettingTab(new TimelineVisualizerSettingTab(this.app, this));
    }

    private refreshTimelineView() {
        if (this.timelineView) {
            this.timelineView.refresh();
        }
    }

    async activateView() {
        const { workspace } = this.app;

        // Check if view already open
        const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_TIMELINE);
        if (existingLeaves.length > 0) {
            workspace.revealLeaf(existingLeaves[0]);
            return;
        }

        // Create new leaf otherwise
        const leaf = workspace.getLeaf(false);
        await leaf.setViewState({
            type: VIEW_TYPE_TIMELINE,
            active: true
        });
        workspace.revealLeaf(leaf);
    }

    onunload() {
        console.log("Unloading Timeline Visualizer Plugin");
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.refreshTimelineView();
    }

    async getTimelineData(): Promise<TimelineData> {
        if (!this.settings.storiesFolder || !this.settings.eventsFolder || !this.settings.charactersFolder) {
            new Notice("Please configure the folder paths in Timeline Visualizer settings");
            return { events: [], connections: [] };
        }

        const events: TimelineEvent[] = [];
        const connections: TimelineConnection[] = [];

        const files = this.app.vault.getMarkdownFiles();
        const storyFiles = files.filter(file => file.path.startsWith(this.settings.storiesFolder));
        const eventFiles = files.filter(file => file.path.startsWith(this.settings.eventsFolder));
        const characterFiles = files.filter(file => file.path.startsWith(this.settings.charactersFolder));

        // STORIES
        for (const file of storyFiles) {
            try {
                const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
                if (frontmatter && frontmatter.data) {
                    const data = frontmatter.data;
                    // Get both beginDate and endDate
                    const beginDate = data.template?.BasicInformation?.BeginDate?.value || '';
                    const endDate = data.template?.BasicInformation?.EndDate?.value || '';
                    const name = data.template?.BasicInformation?.Name?.value || file.basename;
                    const synopsis = data.template?.BasicInformation?.Synopsis?.value || '';

                    // Parse the dates for proper sorting
                    const parsedBeginDate = parseDateString(cleanHtml(beginDate));
                    const parsedEndDate = parseDateString(cleanHtml(endDate));
                    
                    events.push({
                        id: file.path,
                        title: cleanHtml(name),
                        date: parsedBeginDate.sortableDate, // Use beginDate as primary date for sorting
                        displayDate: parsedBeginDate.displayDate, // For display
                        beginDate: parsedBeginDate.sortableDate,
                        endDate: parsedEndDate.sortableDate,
                        displayBeginDate: parsedBeginDate.displayDate,
                        displayEndDate: parsedEndDate.displayDate,
                        type: 'story',
                        description: cleanHtml(synopsis),
                        file: file.path
                    });

                    // Associated characters
                    if (data.template?.Characters?.Characters?.value) {
                        const characters = data.template.Characters.Characters.value;
                        characters.forEach((characterRef: string) => {
                            // Extract character name from link
                            const characterName = cleanHtml(cleanLink(characterRef));
                            if (characterName) {
                                connections.push({
                                    from: file.path,
                                    to: `${this.settings.charactersFolder}/${characterName}.md`,
                                    type: 'appears_in'
                                });
                            }
                        });
                    }
                }
            } catch (error) {
                console.error(`Error processing story file ${file.path}:`, error);
            }
        }

        // EVENTS
        for (const file of eventFiles) {
            try {
                const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;

                if (frontmatter && frontmatter.data) {
                    const data = frontmatter.data;
                    // Get begin and end dates
                    const beginDate = data.template?.BasicInformation?.BeginDate?.value || '';
                    const endDate = data.template?.BasicInformation?.EndDate?.value || '';
                    const name = data.template?.BasicInformation?.Name?.value || file.basename;
                    const description = data.template?.BasicInformation?.Description?.value || '';
                    const locationRef = data.template?.BasicInformation?.Location?.value || '';

                    // Parse the dates for proper sorting
                    const parsedBeginDate = parseDateString(cleanHtml(beginDate));
                    const parsedEndDate = parseDateString(cleanHtml(endDate));
                    
                    events.push({
                        id: file.path,
                        title: cleanHtml(name),
                        date: parsedBeginDate.sortableDate, // Use beginDate as primary date for sorting
                        displayDate: parsedBeginDate.displayDate, // For display
                        beginDate: parsedBeginDate.sortableDate,
                        endDate: parsedEndDate.sortableDate,
                        displayBeginDate: parsedBeginDate.displayDate,
                        displayEndDate: parsedEndDate.displayDate,
                        type: 'event',
                        description: cleanHtml(description),
                        file: file.path
                    });

                    // Try to find related stories or characters
                    const fileLinks = this.app.metadataCache.getFileCache(file)?.links || [];
                    fileLinks.forEach(link => {
                        const targetFile = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
                        if (targetFile) {
                            connections.push({
                                from: file.path,
                                to: targetFile.path,
                                type: 'related'
                            });
                        }
                    });
                }
            } catch (error) {
                console.error(`Error processing event file ${file.path}:`, error);
            }
        }

        // CHARACTERS
        for (const file of characterFiles) {
            try {
                const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;

                if (frontmatter && frontmatter.data) {
                    const data = frontmatter.data;
                    const name = data.template?.BasicInformation?.FullName?.value || file.basename;
                    let status = "alive";

                    // Parse birth and death dates
                    const birthDateValue = data.template?.BasicInformation?.BirthDate?.value || '';
                    const deathDateValue = data.template?.BasicInformation?.DeathDate?.value || '';
                    const parsedBirthDate = parseDateString(cleanHtml(birthDateValue));
                    const parsedDeathDate = parseDateString(cleanHtml(deathDateValue));

                    if (parsedBirthDate.sortableDate) {
                        // Add Birth event
                        events.push({
                            id: `${file.path}-birth`,
                            title: `Birth of ${cleanHtml(name)}`,
                            date: parsedBirthDate.sortableDate,
                            displayDate: parsedBirthDate.displayDate,
                            beginDate: parsedBirthDate.sortableDate,
                            endDate: parsedBirthDate.sortableDate,
                            displayBeginDate: parsedBirthDate.displayDate,
                            displayEndDate: parsedBirthDate.displayDate,
                            type: 'characterEvent',
                            description: `Birth of ${cleanHtml(name)}`,
                            file: file.path,
                            status: status as TimelineEvent['status']
                        });

                        connections.push({
                            from: `${file.path}-birth`,
                            to: file.path,
                            type: 'status_change'
                        });
                    }

                    if (data.template?.State?.Dead?.value === true) {
                        status = "dead";

                        if (parsedDeathDate.sortableDate) {
                            // Add character death as an event
                            events.push({
                                id: `${file.path}-death`,
                                title: `Death of ${cleanHtml(name)}`,
                                date: parsedDeathDate.sortableDate,
                                displayDate: parsedDeathDate.displayDate,
                                beginDate: parsedDeathDate.sortableDate,
                                endDate: parsedDeathDate.sortableDate,
                                displayBeginDate: parsedDeathDate.displayDate,
                                displayEndDate: parsedDeathDate.displayDate,
                                type: 'characterEvent',
                                description: `Death of ${cleanHtml(name)}`,
                                file: file.path,
                                status: status as TimelineEvent['status']
                            });

                            connections.push({
                                from: `${file.path}-death`,
                                to: file.path,
                                type: 'status_change'
                            });
                        }
                    } else if (data.template?.State?.Injured?.value === true) {
                        status = "injured";
                    }

                    // Add character as entity
                    events.push({
                        id: file.path,
                        title: cleanHtml(name),
                        date: parsedBirthDate.sortableDate,
                        displayDate: parsedBirthDate.displayDate,
                        beginDate: parsedBirthDate.sortableDate,
                        endDate: parsedDeathDate.sortableDate || '9999', // If no death date, use far future
                        displayBeginDate: parsedBirthDate.displayDate,
                        displayEndDate: parsedDeathDate.displayDate,
                        type: 'character',
                        description: cleanHtml(data.template?.BasicInformation?.Background?.value) || '',
                        file: file.path,
                        status: status as TimelineEvent['status']
                    });
                }
            } catch (error) {
                console.error(`Error processing character file ${file.path}:`, error);
            }
        }

        return {
            events: events,
            connections: connections
        };
    }
}

export interface TimelineEvent {
    id: string;
    title: string;
    date: string; // Sortable date format (YYYY-MM-DD)
    displayDate: string; // Human-readable date
    beginDate?: string; // Sortable date format
    endDate?: string; // Sortable date format
    displayBeginDate?: string; // Human-readable date
    displayEndDate?: string; // Human-readable date
    type: 'story' | 'event' | 'character' | 'characterEvent';
    description: string;
    file: string;
    status?: 'alive' | 'dead' | 'injured';
    isRange?: boolean;
}

export interface TimelineConnection {
    from: string;
    to: string;
    type: 'appears_in' | 'related' | 'status_change';
}

export interface TimelineData {
    events: TimelineEvent[];
    connections: TimelineConnection[];
}

class TimelineVisualizerSettingTab extends PluginSettingTab {
    plugin: TimelineVisualizerPlugin;

    constructor(app: App, plugin: TimelineVisualizerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        
        // Get all folders for dropdowns
        const folders = this.getAllFolders();

        containerEl.createEl('h2', { text: 'Timeline Visualizer Settings' });

        new Setting(containerEl)
            .setName('Stories Folder')
            .setDesc('The folder containing your story files')
            .addDropdown(dropdown => {
                // Add empty option
                dropdown.addOption('', '-- Select a folder --');
                // Add all folders
                folders.forEach(folder => dropdown.addOption(folder, folder));
                // Set current value
                dropdown.setValue(this.plugin.settings.storiesFolder);
                // Handle change
                dropdown.onChange(async (value) => {
                    this.plugin.settings.storiesFolder = value;
                    await this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName('Events Folder')
            .setDesc('The folder containing your event files')
            .addDropdown(dropdown => {
                // Add empty option
                dropdown.addOption('', '-- Select a folder --');
                // Add all folders
                folders.forEach(folder => dropdown.addOption(folder, folder));
                // Set current value
                dropdown.setValue(this.plugin.settings.eventsFolder);
                // Handle change
                dropdown.onChange(async (value) => {
                    this.plugin.settings.eventsFolder = value;
                    await this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName('Characters Folder')
            .setDesc('The folder containing your character files')
            .addDropdown(dropdown => {
                // Add empty option
                dropdown.addOption('', '-- Select a folder --');
                // Add all folders
                folders.forEach(folder => dropdown.addOption(folder, folder));
                // Set current value
                dropdown.setValue(this.plugin.settings.charactersFolder);
                // Handle change
                dropdown.onChange(async (value) => {
                    this.plugin.settings.charactersFolder = value;
                    await this.plugin.saveSettings();
                });
            });
            
        new Setting(containerEl)
            .setName('Character Color')
            .setDesc('Color for characters on the timeline')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.characterColor)
                .onChange(async (value) => {
                    this.plugin.settings.characterColor = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Story Color')
            .setDesc('Color for story events on the timeline')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.storyColor)
                .onChange(async (value) => {
                    this.plugin.settings.storyColor = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Event Color')
            .setDesc('Color for regular events on the timeline')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.eventColor)
                .onChange(async (value) => {
                    this.plugin.settings.eventColor = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Character Event Color')
            .setDesc('Color for character-related events on the timeline')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.characterEventColor)
                .onChange(async (value) => {
                    this.plugin.settings.characterEventColor = value;
                    await this.plugin.saveSettings();
                }));
    }
    
    // Get all folders for dropdown options
    private getAllFolders(): string[] {
        const folders: string[] = [];
        // Add root folder
        folders.push('/');
        
        // Recursively find all folders
        const findFolders = (folder: TFolder) => {
            // Skip hidden folders
            if (folder.path.startsWith('.')) return;
            
            // Add current folder path
            if (folder.path !== '/') {
                folders.push(folder.path);
            }
            
            // Process children folders
            folder.children.forEach(child => {
                if (child instanceof TFolder) {
                    findFolders(child);
                }
            });
        };
        
        // Start with root folder
        findFolders(this.app.vault.getRoot());
        
        // Sort folders for better display
        return folders.sort();
    }
}