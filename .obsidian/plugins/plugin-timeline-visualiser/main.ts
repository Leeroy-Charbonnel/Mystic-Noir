import { App, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile, WorkspaceLeaf, ItemView, ViewStateResult, TFolder, Notice } from 'obsidian';
import { TimelineView, VIEW_TYPE_TIMELINE } from './TimelineView';
import { cleanHtml, cleanLink, extractLinks, sortAndRemoveDuplicateDates } from './utils';

interface TimelineVisualizerSettings {
    storyColor: string;
    eventColor: string;
    characterEventColor: string;
    characterColor: string;
}

const DEFAULT_SETTINGS: TimelineVisualizerSettings = {
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
        const events: TimelineEvent[] = [];
        const connections: TimelineConnection[] = [];

        const files = this.app.vault.getMarkdownFiles();

        // debugger
        for (const file of files) {

            const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
            if (frontmatter && frontmatter.data) {
                const data = frontmatter.data;

                //STORIES
                if (data.contentType == "stories") {
                    try {
                        const basicInfo = data.template.BasicInformation.fields;

                        if (basicInfo) {
                            const name = cleanHtml(basicInfo?.Name.value);
                            const synopsis = cleanHtml(basicInfo?.Synopsis.value);

                            const beginDate = basicInfo?.BeginDate.value;
                            const endDate = basicInfo?.EndDate.value;
                            const parsedBeginDate = beginDate != null ? new Date(beginDate) : null;
                            const parsedEndDate = endDate != null ? new Date(endDate) : null;

                            const storyEvent: TimelineEvent = {
                                type: 'story',
                                id: file.path,
                                title: name,
                                beginDate: parsedBeginDate,
                                endDate: parsedEndDate,
                                description: synopsis,
                                file: file.path
                            };

                            events.push(storyEvent);
                        }

                        //Extract characters from story
                        const characters = data.template.Associated.fields.Characters.value;
                        if (characters && characters.length > 0) {
                            characters.forEach((characterRef: string) => {
                                const extractedLinks = extractLinks(characterRef);
                                if (extractedLinks.length > 0) {
                                    const characterName = cleanHtml(cleanLink(extractedLinks[0]));
                                    connections.push({
                                        from: file.path,
                                        to: `${characterName}.md`,
                                        type: 'appears_in'
                                    });
                                }
                            });
                        }


                        //Extract event from story
                        const storyEventsList = data.template.Associated.fields.Events.value;
                        if (storyEventsList && storyEventsList.length > 0) {
                            storyEventsList.forEach((eventRef: string) => {
                                const extractedLinks = extractLinks(eventRef);
                                if (extractedLinks.length > 0) {
                                    const eventName = cleanHtml(cleanLink(extractedLinks[0]));
                                    connections.push({
                                        from: `${eventName}.md`,
                                        to: file.path,
                                        type: 'part_of'
                                    });
                                }
                            });
                        }
                    } catch (error) {
                        console.error(`Error processing story file ${file.path}:`, error);
                    }
                }
                //EVENTS
                if (data.contentType == "events") {
                    try {
                        const basicInfo = data.template.BasicInformation.fields;
                        if (basicInfo) {
                            const name = cleanHtml(basicInfo.Name.value);
                            const description = cleanHtml(basicInfo.Description.value);

                            const beginDate = basicInfo.BeginDate.value;
                            const endDate = basicInfo.EndDate.value;
                            const parsedBeginDate = beginDate != null ? new Date(beginDate) : null;
                            const parsedEndDate = endDate != null ? new Date(endDate) : null;

                            events.push({
                                type: 'event',
                                id: file.path,
                                title: name,
                                beginDate: parsedBeginDate,
                                endDate: parsedEndDate,
                                description: description,
                                file: file.path
                            });
                        }

                    } catch (error) {
                        console.error(`Error processing event file ${file.path}:`, error);
                    }
                }

                //CHARACTERS
                if (data.contentType == "characters") {
                    try {
                        const basicInfo = data.template.BasicInformation?.fields;

                        if (basicInfo) {
                            const name = cleanHtml(basicInfo.FullName.value);
                            const description = cleanHtml(basicInfo.Background.value);

                            const beginDate = basicInfo.BirthDate.value;
                            const endDate = basicInfo.DeathDate.value;
                            const parsedBeginDate = beginDate != null ? new Date(beginDate) : null;
                            const parsedEndDate = endDate != null ? new Date(endDate) : null;

                            let status = data.template.State.fields.CurrentStatus.value || [];

                            events.push({
                                type: 'characterEvent',
                                id: `${file.path}-birth`,
                                title: `Birth of ${name}`,
                                beginDate: parsedBeginDate,
                                endDate: parsedBeginDate,
                                description: `Birth of ${name}`,
                                file: file.path
                            });

                            connections.push({
                                from: `${file.path}-birth`,
                                to: file.path,
                                type: 'status_change'
                            });



                            if (status.includes("Dead")) {
                                if (parsedEndDate) {
                                    events.push({
                                        type: 'characterEvent',
                                        id: `${file.path}-death`,
                                        title: `Death of ${name}`,
                                        beginDate: parsedEndDate,
                                        endDate: parsedEndDate,
                                        description: `Death of ${name}`,
                                        file: file.path,
                                        status: status
                                    });

                                    connections.push({
                                        from: `${file.path}-death`,
                                        to: file.path,
                                        type: 'status_change'
                                    });
                                }
                            }
                            events.push({
                                type: 'character',
                                id: file.path,
                                title: name,
                                beginDate: parsedBeginDate,
                                endDate: parsedEndDate,
                                description: description,
                                file: file.path,
                                status: status
                            });
                        }
                    } catch (error) {
                        console.error(`Error processing character file ${file.path}:`, error);
                    }
                }
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

        console.log("Timeline Data:", timelineData);
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


        containerEl.createEl('h2', { text: 'Timeline Visualizer Settings' });


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
}