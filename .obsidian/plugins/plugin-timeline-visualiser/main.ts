import { App, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile, WorkspaceLeaf, ItemView, ViewStateResult } from 'obsidian';
import { TimelineView, VIEW_TYPE_TIMELINE } from './TimelineView';
import { cleanHtml, cleanLink } from 'utils';

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
    defaultColor: '',
    characterColor: '',
    storyColor: '',
    eventColor: '',
    characterEventColor: ''
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

        this.addSettingTab(new TimelineVisualizerSettingTab(this.app, this));
    }


    private refreshTimelineView() {
        if (this.timelineView) {
            this.timelineView.refresh();
        }
    }

    async activateView() {
        const { workspace } = this.app;

        //Check if the view already open
        const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_TIMELINE);
        if (existingLeaves.length > 0) {
            workspace.revealLeaf(existingLeaves[0]);
            return;
        }

        //Create a new leaf otherwise
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
                    const date = data.template?.BasicInformation?.BeginDate?.value || '';
                    const name = data.template?.BasicInformation?.Name?.value || file.basename;
                    const synopsis = data.template?.BasicInformation?.Synopsis?.value || '';

                    events.push({
                        id: file.path,
                        title: cleanHtml(name),
                        date: cleanHtml(date),
                        type: 'story',
                        description: cleanHtml(synopsis),
                        file: file.path
                    });

                    //Associated characters
                    if (data.template?.Characters?.Characters?.value) {
                        const characters = data.template.Characters.Characters.value;
                        characters.forEach((characterRef: string) => {
                            //Extract character name from link
                            const match = characterRef.match(/\[\[(.*?)(\|.*?)?\]\]/);
                            if (match) {
                                const characterName = cleanHtml(cleanLink(characterRef));
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

        //EVENT
        for (const file of eventFiles) {
            try {
                const fileContent = await this.app.vault.read(file);
                const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;

                if (frontmatter && frontmatter.data) {
                    const data = frontmatter.data;
                    const date = data.template?.BasicInformation?.Date?.value || '';
                    const name = data.template?.BasicInformation?.Name?.value || file.basename;
                    const description = data.template?.BasicInformation?.Description?.value || '';

                    events.push({
                        id: file.path,
                        title: cleanHtml(name),
                        date: cleanHtml(date),
                        type: 'event',
                        description: cleanHtml(description),
                        file: file.path
                    });

                    //Try to find related stories or characters
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

        for (const file of characterFiles) {
            try {
                const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;

                if (frontmatter && frontmatter.data) {
                    const data = frontmatter.data;
                    const name = data.template?.BasicInformation?.FullName?.value || file.basename;
                    let status = "alive";


                    if (data.template?.BasicInformation?.BirthDate?.value) {
                        //Add Birth death as an event
                        events.push({
                            id: `${file.path}-birth`,
                            title: `Birth of ${name}`,
                            date: cleanHtml(data.template?.BasicInformation.BirthDate?.value) || '',
                            type: 'characterEvent',
                            description: `Birth of ${name}`,
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

                        //Add character death as an event
                        events.push({
                            id: `${file.path}-death`,
                            title: `Death of ${name}`,
                            date: cleanHtml(data.template?.BasicInformation.DeathDate?.value) || '',
                            type: 'characterEvent',
                            description: `Death of ${name}`,
                            file: file.path,
                            status: status as TimelineEvent['status']
                        });

                        connections.push({
                            from: `${file.path}-death`,
                            to: file.path,
                            type: 'status_change'
                        });
                    } else if (data.template?.State?.Injured?.value === true) {
                        status = "injured";
                    }

                    // Add character as entity
                    events.push({
                        id: file.path,
                        title: cleanHtml(name),
                        date: cleanHtml(data.template?.BasicInformation?.BirthDate?.value) || '',
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
    date: string;
    type: 'story' | 'event' | 'character' | 'characterEvent';
    description: string;
    file: string;
    status?: 'alive' | 'dead' | 'injured';
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

        containerEl.createEl('h2', { text: 'Timeline Visualizer Settings' });

        new Setting(containerEl)
            .setName('Stories Folder')
            .setDesc('The folder containing your story files')
            .addText(text => text
                .setValue(this.plugin.settings.storiesFolder)
                .onChange(async (value) => {
                    this.plugin.settings.storiesFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Events Folder')
            .setDesc('The folder containing your event files')
            .addText(text => text
                .setValue(this.plugin.settings.eventsFolder)
                .onChange(async (value) => {
                    this.plugin.settings.eventsFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Characters Folder')
            .setDesc('The folder containing your character files')
            .addText(text => text
                .setValue(this.plugin.settings.charactersFolder)
                .onChange(async (value) => {
                    this.plugin.settings.charactersFolder = value;
                    await this.plugin.saveSettings();
                }));
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
}