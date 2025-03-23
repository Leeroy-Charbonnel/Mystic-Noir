import { App, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile, WorkspaceLeaf, ItemView, ViewStateResult, TFolder, Notice } from 'obsidian';
import { TimelineView, VIEW_TYPE_TIMELINE } from './TimelineView';
import { cleanHtml, cleanLink, extractLinks, parseDateString, sortAndRemoveDuplicateDates } from './utils';

interface TimelineVisualizerSettings {
    storiesFolder: string;
    eventsFolder: string;
    charactersFolder: string;
    storyColor: string;
    eventColor: string;
    characterEventColor: string;
    characterColor: string;
}

const DEFAULT_SETTINGS: TimelineVisualizerSettings = {
    storiesFolder: '',
    eventsFolder: '',
    charactersFolder: '',
    storyColor: '',
    eventColor: '',
    characterEventColor: '',
    characterColor: '',
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

        this.addCommand({
            id: 'open-timeline-visualizer',
            name: 'Open Timeline Visualizer',
            callback: () => this.activateView(),
        });

        // Add command for story-centric view
        this.addCommand({
            id: 'open-story-centric-view',
            name: 'Open Story-Centric Timeline View',
            callback: async () => {
                await this.activateView();
            }
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

        const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_TIMELINE);
        if (existingLeaves.length > 0) {
            workspace.revealLeaf(existingLeaves[0]);
            return;
        }

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

        //STORIES
        for (const file of storyFiles) {
            try {
                const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
                if (frontmatter && frontmatter.data) {
                    const data = frontmatter.data;
                    const beginDate = data.template?.BasicInformation?.BeginDate?.value || '';
                    const endDate = data.template?.BasicInformation?.EndDate?.value || '';
                    const name = data.template?.BasicInformation?.Name?.value || file.basename;
                    const synopsis = data.template?.BasicInformation?.Synopsis?.value || '';

                    const parsedBeginDate = parseDateString(cleanHtml(beginDate), false);
                    const parsedEndDate = parseDateString(cleanHtml(endDate), true);

                    const storyEvent: TimelineEvent = {
                        type: 'story',
                        id: file.path,
                        title: cleanHtml(name),
                        beginDate: parsedBeginDate,
                        endDate: parsedEndDate,
                        description: cleanHtml(synopsis),
                        file: file.path
                    };

                    events.push(storyEvent);

                    //Extract characters from story
                    if (data.template?.Characters?.Characters?.value) {
                        const characters = data.template.Characters.Characters.value;
                        characters.forEach((characterRef: string) => {
                            const extractedLinks = extractLinks(characterRef);
                            if (extractedLinks.length > 0) {
                                const characterName = cleanHtml(cleanLink(extractedLinks[0]));
                                connections.push({
                                    from: file.path,
                                    to: `${this.settings.charactersFolder}/${characterName}.md`,
                                    type: 'appears_in'
                                });
                            }
                        });
                    }

                    //Extract event from story
                    if (data.template?.Events?.Event?.value) {
                        const storyEventsList = data.template.Events.Event.value;
                        storyEventsList.forEach((eventRef: string) => {
                            const extractedLinks = extractLinks(eventRef);
                            if (extractedLinks.length > 0) {
                                const eventName = cleanHtml(cleanLink(extractedLinks[0]));
                                connections.push({
                                    from: `${this.settings.eventsFolder}/${eventName}.md`,
                                    to: file.path,
                                    type: 'part_of'
                                });
                            }
                        });
                    }
                }
            } catch (error) {
                console.error(`Error processing story file ${file.path}:`, error);
            }
        }

        //EVENTS
        for (const file of eventFiles) {
            try {
                const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;

                if (frontmatter && frontmatter.data) {
                    const data = frontmatter.data;
                    const beginDate = data.template?.BasicInformation?.BeginDate?.value || '';
                    const endDate = data.template?.BasicInformation?.EndDate?.value || '';
                    const name = data.template?.BasicInformation?.Name?.value || file.basename;
                    const description = data.template?.BasicInformation?.Description?.value || '';

                    const parsedBeginDate = parseDateString(cleanHtml(beginDate), false);
                    const parsedEndDate = parseDateString(cleanHtml(endDate), true);

                    events.push({
                        type: 'event',
                        id: file.path,
                        title: cleanHtml(name),
                        beginDate: parsedBeginDate,
                        endDate: parsedEndDate,
                        description: cleanHtml(description),
                        file: file.path
                    });
                }
            } catch (error) {
                console.error(`Error processing event file ${file.path}:`, error);
            }
        }

        //CHARACTERS
        for (const file of characterFiles) {
            try {
                const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;

                if (frontmatter && frontmatter.data) {
                    const data = frontmatter.data;
                    const name = data.template?.BasicInformation?.FullName?.value || file.basename;
                    let status = "alive";

                    const birthDateValue = data.template?.BasicInformation?.BirthDate?.value || '';
                    const deathDateValue = data.template?.BasicInformation?.DeathDate?.value || '';
                    const parsedBirthDate = parseDateString(cleanHtml(birthDateValue), false);
                    const parsedDeathDate = parseDateString(cleanHtml(deathDateValue), true);

                    if (parsedBirthDate) {
                        events.push({
                            type: 'characterEvent',
                            id: `${file.path}-birth`,
                            title: `Birth of ${cleanHtml(name)}`,
                            beginDate: parsedBirthDate,
                            endDate: parsedBirthDate,
                            description: `Birth of ${cleanHtml(name)}`,
                            file: file.path
                        });

                        connections.push({
                            from: `${file.path}-birth`,
                            to: file.path,
                            type: 'status_change'
                        });
                    }

                    if (data.template?.State?.Dead?.value === true) {
                        status = "dead";

                        if (parsedDeathDate) {
                            events.push({
                                type: 'characterEvent',
                                id: `${file.path}-death`,
                                title: `Death of ${cleanHtml(name)}`,
                                beginDate: parsedDeathDate,
                                endDate: parsedDeathDate,
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

                    events.push({
                        type: 'character',
                        id: file.path,
                        title: cleanHtml(name),
                        beginDate: parsedBirthDate,
                        endDate: parsedDeathDate ? parsedDeathDate : null,
                        description: cleanHtml(data.template?.BasicInformation?.Background?.value) || '',
                        file: file.path,
                        status: status as TimelineEvent['status']
                    });
                }
            } catch (error) {
                console.error(`Error processing character file ${file.path}:`, error);
            }
        }

        let allDates = events.reduce((state, value) => {
            if (value.beginDate) state.push(value.beginDate);
            if (value.endDate) state.push(value.endDate);
            return state;
        }, ([] as Date[]));
        allDates = sortAndRemoveDuplicateDates(allDates);


        const latestDate = allDates.length > 0 ? allDates[allDates.length - 1] : new Date();
        events.forEach(event => { if (!event.endDate) event.endDate = latestDate; });

        // Add the grid to the timeline data
        const timelineData: TimelineData = {
            events: events,
            connections: connections,
        };

        return timelineData;
    }
}

export interface TimelineEvent {
    id: string;
    title: string;
    file: string;
    description: string;
    color?: string;
    type: 'story' | 'event' | 'character' | 'characterEvent';

    //Dates
    beginDate: Date | null;
    endDate: Date | null;

    //If Character
    status?: 'alive' | 'dead' | 'injured';

    //Grid properties
    column?: number;
    startRow?: number;
    endRow?: number;
}

export interface TimelineConnection {
    from: string;
    to: string;
    type: 'appears_in' | 'related' | 'status_change' | 'part_of';
}

export interface TimelineData {
    events: TimelineEvent[];
    connections: TimelineConnection[];
    rowDates?: Date[];
    columnCount?: number;
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

        const folders = this.getAllFolders();

        containerEl.createEl('h2', { text: 'Timeline Visualizer Settings' });

        new Setting(containerEl)
            .setName('Stories Folder')
            .setDesc('The folder containing your story files')
            .addDropdown(dropdown => {
                folders.forEach(folder => dropdown.addOption(folder, folder));
                dropdown.setValue(this.plugin.settings.storiesFolder);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.storiesFolder = value;
                    await this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName('Events Folder')
            .setDesc('The folder containing your event files')
            .addDropdown(dropdown => {
                dropdown.addOption('', '-- Select a folder --');
                folders.forEach(folder => dropdown.addOption(folder, folder));
                dropdown.setValue(this.plugin.settings.eventsFolder);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.eventsFolder = value;
                    await this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName('Characters Folder')
            .setDesc('The folder containing your character files')
            .addDropdown(dropdown => {
                dropdown.addOption('', '-- Select a folder --');
                folders.forEach(folder => dropdown.addOption(folder, folder));
                dropdown.setValue(this.plugin.settings.charactersFolder);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.charactersFolder = value;
                    await this.plugin.saveSettings();
                });
            });

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

        new Setting(containerEl)
            .setName('Character  Color')
            .setDesc('Color for characters on the timeline')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.characterColor)
                .onChange(async (value) => {
                    this.plugin.settings.characterColor = value;
                    await this.plugin.saveSettings();
                }));
    }

    private getAllFolders(): string[] {
        const folders: string[] = [];
        folders.push('/');

        const findFolders = (folder: TFolder) => {
            if (folder.path.startsWith('.')) return;

            if (folder.path !== '/') {
                folders.push(folder.path);
            }

            folder.children.forEach(child => {
                if (child instanceof TFolder) {
                    findFolders(child);
                }
            });
        };

        findFolders(this.app.vault.getRoot());

        return folders.sort();
    }
}