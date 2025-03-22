import { ItemView, WorkspaceLeaf, TFile, Modal, Notice, App } from 'obsidian';
import TimelineVisualizerPlugin, { TimelineEvent, TimelineConnection, TimelineData } from './main';

export const VIEW_TYPE_TIMELINE = 'timeline-visualizer';

export class TimelineView extends ItemView {
    private plugin: TimelineVisualizerPlugin;
    private contentEl: HTMLElement;
    private timelineEl: HTMLElement;
    private headerEl: HTMLElement;
    private controlsEl: HTMLElement;
    private filterEl: HTMLElement;
    private timelineData: TimelineData | null = null;
    private displayMode: 'chronological' | 'character' | 'story' = 'chronological';
    private focusCharacter: string | null = null;
    private focusStory: string | null = null;
    private filteredTimelineData: TimelineData | null = null;
    private activeFilters: Record<string, boolean> = {
        'story': true,
        'event': true,
        'character': true,
        'characterEvent': true
    };
    private searchTerm: string = '';

    constructor(leaf: WorkspaceLeaf, plugin: TimelineVisualizerPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_TIMELINE;
    }

    getDisplayText(): string {
        return 'Timeline Visualizer';
    }

    async onOpen() {
        this.contentEl = this.containerEl.children[1] as HTMLElement;
        this.contentEl.empty();
        this.contentEl.addClass('timeline-visualizer-container');

        this.headerEl = this.contentEl.createEl('div', { cls: 'timeline-header' });
        this.headerEl.createEl('h2', { text: 'Timeline Visualizer' });
        
        this.controlsEl = this.headerEl.createEl('div', { cls: 'timeline-controls' });
        const viewModeContainer = this.controlsEl.createEl('div', { cls: 'timeline-view-mode' });
        viewModeContainer.createEl('span', { text: 'View Mode: ' });

        // Chronological view button
        const chronoButton = viewModeContainer.createEl('button', {
            cls: 'timeline-view-button active',
            text: 'Chronological'
        });
        chronoButton.addEventListener('click', () => this.setDisplayMode('chronological'));

        // Character-centric view button
        const characterButton = viewModeContainer.createEl('button', {
            cls: 'timeline-view-button',
            text: 'Character'
        });
        characterButton.addEventListener('click', () => this.promptForCharacter());

        // Story-centric view button
        const storyButton = viewModeContainer.createEl('button', {
            cls: 'timeline-view-button',
            text: 'Story'
        });
        storyButton.addEventListener('click', () => this.promptForStory());

        // Refresh button
        const refreshButton = this.controlsEl.createEl('button', {
            cls: 'timeline-refresh-button',
            text: 'Refresh'
        });
        refreshButton.addEventListener('click', () => this.refresh());

        // Filters section
        this.filterEl = this.contentEl.createEl('div', { cls: 'timeline-filters' });
        const filterControls = this.filterEl.createEl('div', { cls: 'filter-controls' });

        // Type filters
        const typeFilterContainer = filterControls.createEl('div', { cls: 'filter-section' });
        const filterButtonsContainer = typeFilterContainer.createEl('div', { cls: 'filter-buttons' });

        this.createFilterButton(filterButtonsContainer, 'story', 'Stories');
        this.createFilterButton(filterButtonsContainer, 'event', 'Events');
        this.createFilterButton(filterButtonsContainer, 'character', 'Characters');
        this.createFilterButton(filterButtonsContainer, 'characterEvent', 'Character Events');

        // Search filter
        const searchContainer = filterControls.createEl('div', { cls: 'filter-section filter-search' });
        const searchInput = searchContainer.createEl('input', {
            cls: 'timeline-search-input',
            attr: {
                type: 'text',
                placeholder: 'Search timeline...'
            }
        });
        searchInput.addEventListener('input', (e) => {
            this.searchTerm = (e.target as HTMLInputElement).value;
            this.applyFilters();
        });

        this.timelineEl = this.contentEl.createEl('div', { cls: 'timeline-content' });
        await this.refresh();
    }

    private createFilterButton(container: HTMLElement, type: string, label: string): HTMLElement {
        const button = container.createEl('button', {
            cls: `filter-button ${this.activeFilters[type] ? 'is-active' : ''}`,
            text: label,
            attr: {
                'data-filter-type': type
            }
        });
        button.addEventListener('click', () => {
            this.activeFilters[type] = !this.activeFilters[type];
            if (this.activeFilters[type])
                button.addClass('is-active');
            else
                button.removeClass('is-active');
            this.applyFilters();
        });
        return button;
    }

    async refresh() {
        this.timelineEl.empty();
        this.timelineEl.createEl('div', {
            cls: 'timeline-loading',
            text: 'Loading timeline data...'
        });

        try {
            this.timelineData = await this.plugin.getTimelineData();
            this.filteredTimelineData = this.timelineData;
            this.applyFilters();
        } catch (error) {
            this.timelineEl.empty();
            this.timelineEl.createEl('div', {
                cls: 'timeline-error',
                text: `Error loading timeline data: ${error.message}`
            });
            console.error("Timeline Visualizer error:", error);
        }
    }

    private applyFilters() {
        if (!this.timelineData) return;

        // Get active filters
        const activeTypes = Object.entries(this.activeFilters)
            .filter(([_, isActive]) => isActive)
            .map(([type]) => type);

        // Filter by type and search term
        const filteredEvents = this.timelineData.events.filter(event => {
            // Check if the event type is active
            if (!activeTypes.includes(event.type)) return false;
            
            // Apply search filter if a search term exists
            if (this.searchTerm) {
                const searchLower = this.searchTerm.toLowerCase();
                return (
                    event.title.toLowerCase().includes(searchLower) ||
                    event.description.toLowerCase().includes(searchLower) ||
                    (event.displayDate && event.displayDate.toLowerCase().includes(searchLower))
                );
            }
            
            return true;
        });

        // Filter connections based on filtered events
        const filteredEventIds = new Set(filteredEvents.map(e => e.id));
        const filteredConnections = this.timelineData.connections.filter(conn =>
            filteredEventIds.has(conn.from) && filteredEventIds.has(conn.to)
        );

        this.filteredTimelineData = {
            events: filteredEvents,
            connections: filteredConnections
        };

        this.renderTimeline();
    }

    private renderTimeline() {
        this.timelineEl.empty();

        if (!this.filteredTimelineData || this.filteredTimelineData.events.length === 0) {
            this.timelineEl.createEl('div', {
                cls: 'timeline-empty',
                text: 'No timeline events found. Add dates to your stories and events to see them here.'
            });
            return;
        }

        if (this.displayMode === 'chronological') {
            this.renderChronologicalTimeline();
        } else if (this.displayMode === 'character') {
            this.renderCharacterTimeline();
        } else if (this.displayMode === 'story') {
            this.renderStoryTimeline();
        }
    }

    private renderChronologicalTimeline() {
        if (!this.filteredTimelineData) return;

        const timeline = this.timelineEl.createEl('div', { cls: 'timeline-chronological' });

        const events = this.processEventsWithDateRanges(this.filteredTimelineData.events);
        const eventsByYear = this.groupEventsByYear(events);
        const sortedYears = this.getSortedYears(eventsByYear);

        const timelineLine = timeline.createEl('div', { cls: 'timeline-line' });
        let index = 0;
        
        // Process range events (events that span multiple years)
        const rangeEvents = events.filter(event => event.isRange && event.type !== 'character');
        const dateRanges = new Map<string, {start: string, end: string, events: TimelineEvent[]}>();
        
        rangeEvents.forEach(event => {
            if (event.beginDate && event.endDate) {
                const key = `${event.id}`;
                if (!dateRanges.has(key)) {
                    dateRanges.set(key, {
                        start: event.beginDate,
                        end: event.endDate,
                        events: [event]
                    });
                } else {
                    dateRanges.get(key)?.events.push(event);
                }
            }
        });

        // Render year markers with events
        sortedYears.forEach(year => {
            const yearEvents = eventsByYear[year];
            
            const dateMarker = timelineLine.createEl('div', { cls: 'timeline-date-marker' });
            dateMarker.createEl('div', { cls: 'timeline-date', text: year });
            
            // Check if any range spans this year
            const activeRanges = Array.from(dateRanges.values()).filter(range => 
                this.isDateInRange(year, range.start, range.end)
            );
            
            if (activeRanges.length > 0) {
                const rangeIndicator = timelineLine.createEl('div', { 
                    cls: 'timeline-range-indicator',
                    attr: { 'data-date': year }
                });
                
                activeRanges.forEach(range => {
                    const rangeEl = rangeIndicator.createEl('div', { 
                        cls: 'timeline-range',
                        attr: { 
                            'data-begin': range.start,
                            'data-end': range.end
                        }
                    });
                    
                    range.events.forEach(event => {
                        const rangeEventEl = rangeEl.createEl('div', { 
                            cls: `timeline-range-event timeline-range-${event.type}`,
                            text: event.title
                        });
                        rangeEventEl.style.backgroundColor = this.getEventColor(event.type);
                        
                        // Add click handler to open the file
                        rangeEventEl.addEventListener('click', () => {
                            this.openFile(event.file);
                        });
                    });
                });
            }
            
            // Render point events for this year
            yearEvents
                .filter(event => event.type !== 'character' && !event.isRange)
                .forEach((event) => {
                    const eventEl = this.createEventElement(event, index++);
                    timelineLine.appendChild(eventEl);
                });
        });
    }
    
    private isDateInRange(year: string, startYear: string, endYear: string): boolean {
        // Simple string comparison for years (or year components of dates)
        // Extract just the year if full dates are provided
        const yearOnly = (dateStr: string) => {
            if (!dateStr) return '';
            // If the date is just a year, use it directly
            if (/^\d{4}$/.test(dateStr)) return dateStr;
            // Otherwise extract the year from the sortable format (YYYY-MM-DD)
            return dateStr.split('-')[0];
        };
        
        const startYearOnly = yearOnly(startYear);
        const endYearOnly = yearOnly(endYear);
        
        return year >= startYearOnly && year <= endYearOnly;
    }
    
    private processEventsWithDateRanges(events: TimelineEvent[]): TimelineEvent[] {
        // Process events to determine which ones are ranges vs. points
        return events.map(event => {
            const processed = { ...event };
            
            // If beginDate and endDate exist and are different, it's a range
            if (event.beginDate && event.endDate && event.beginDate !== event.endDate) {
                processed.isRange = true;
            } else {
                processed.isRange = false;
            }
            
            return processed;
        });
    }

    private renderCharacterTimeline() {
        if (!this.focusCharacter) {
            this.timelineEl.createEl('div', {
                cls: 'timeline-empty',
                text: 'No character selected.'
            });
            return;
        }
        if (!this.filteredTimelineData || !this.timelineData) {
            this.timelineEl.createEl('div', {
                cls: 'timeline-empty',
                text: 'No timeline data.'
            });
            return;
        }
        const character = this.timelineData.events.find(e => e.id === this.focusCharacter);
        if (!character) {
            this.timelineEl.createEl('div', {
                cls: 'timeline-empty',
                text: 'Selected character not found in timeline data.'
            });
            return;
        }

        const characterHeader = this.timelineEl.createEl('div', { cls: 'character-timeline-header' });
        characterHeader.createEl('h3', { text: `Timeline for ${character.title}` });

        if (character.status && character.status !== 'alive') {
            characterHeader.appendChild(document.createTextNode(' '));
            characterHeader.createEl('span', {
                cls: `status-badge ${character.status}`,
                text: character.status
            });
        }

        const relatedEventIds = new Set<string>();

        this.filteredTimelineData.connections.forEach(conn => {
            if (conn.from === this.focusCharacter) {
                relatedEventIds.add(conn.to);
            }
            if (conn.to === this.focusCharacter) {
                relatedEventIds.add(conn.from);
            }
        });

        let characterEvents: TimelineData = {
            events: this.filteredTimelineData.events.filter(e =>
                relatedEventIds.has(e.id)
            ),
            connections: []
        }

        const processedEvents = this.processEventsWithDateRanges(characterEvents.events);
        const eventsByYear = this.groupEventsByYear(processedEvents);
        const sortedYears = this.getSortedYears(eventsByYear);

        const timeline = this.timelineEl.createEl('div', { cls: 'timeline-chronological' });
        const timelineLine = timeline.createEl('div', { cls: 'timeline-line' });

        let index = 0;
        sortedYears.forEach(year => {
            const yearEvents = eventsByYear[year];

            const dateMarker = timelineLine.createEl('div', { cls: 'timeline-date-marker' });
            dateMarker.createEl('div', { cls: 'timeline-date', text: year });

            yearEvents.forEach((event) => {
                const eventEl = this.createEventElement(event, index++);
                timelineLine.appendChild(eventEl);
            });
        });
    }
    
    private renderStoryTimeline() {
        if (!this.focusStory) {
            this.timelineEl.createEl('div', {
                cls: 'timeline-empty',
                text: 'No story selected.'
            });
            return;
        }
        if (!this.filteredTimelineData || !this.timelineData) {
            this.timelineEl.createEl('div', {
                cls: 'timeline-empty',
                text: 'No timeline data.'
            });
            return;
        }
        
        const story = this.timelineData.events.find(e => e.id === this.focusStory);
        if (!story) {
            this.timelineEl.createEl('div', {
                cls: 'timeline-empty',
                text: 'Selected story not found in timeline data.'
            });
            return;
        }

        const storyHeader = this.timelineEl.createEl('div', { cls: 'story-timeline-header' });
        storyHeader.createEl('h3', { text: `Timeline for ${story.title}` });

        // Find story date range
        const storyBeginDate = story.beginDate || story.date;
        const storyEndDate = story.endDate || story.date;
        
        if (story.displayBeginDate && story.displayEndDate) {
            storyHeader.createEl('div', { 
                cls: 'story-date-range',
                text: `${story.displayBeginDate} to ${story.displayEndDate}`
            });
        }

        // Find events related to this story (mentioned in story or from same period)
        const relatedEvents = this.filteredTimelineData.events.filter(event => 
            (event.type === 'event' || event.type === 'characterEvent') && 
            this.isEventInStoryTimeframe(event, storyBeginDate, storyEndDate)
        );
        
        // Also include characters mentioned in the story
        const storyCharacters = this.findStoryCharacters(story, this.filteredTimelineData);
        
        const storyTimelineData: TimelineData = {
            events: [...relatedEvents, ...storyCharacters],
            connections: []
        };

        const processedEvents = this.processEventsWithDateRanges(storyTimelineData.events);
        const eventsByYear = this.groupEventsByYear(processedEvents);
        const sortedYears = this.getSortedYears(eventsByYear);

        const timeline = this.timelineEl.createEl('div', { cls: 'timeline-chronological' });
        const timelineLine = timeline.createEl('div', { cls: 'timeline-line' });

        let index = 0;
        sortedYears.forEach(year => {
            const yearEvents = eventsByYear[year];

            const dateMarker = timelineLine.createEl('div', { cls: 'timeline-date-marker' });
            dateMarker.createEl('div', { cls: 'timeline-date', text: year });

            yearEvents.forEach((event) => {
                const eventEl = this.createEventElement(event, index++);
                timelineLine.appendChild(eventEl);
            });
        });
    }
    
    private isEventInStoryTimeframe(event: TimelineEvent, storyBegin: string, storyEnd: string): boolean {
        const eventDate = event.date || '';
        const eventBegin = event.beginDate || eventDate;
        const eventEnd = event.endDate || eventDate;
        
        // Extract just the year if full dates are provided
        const yearOnly = (dateStr: string) => {
            if (!dateStr) return '';
            if (/^\d{4}$/.test(dateStr)) return dateStr;
            return dateStr.split('-')[0]; // Extract year from YYYY-MM-DD
        };
        
        const storyBeginYear = yearOnly(storyBegin);
        const storyEndYear = yearOnly(storyEnd);
        const eventBeginYear = yearOnly(eventBegin);
        const eventEndYear = yearOnly(eventEnd);
        
        // Check if event range overlaps with story range
        return (eventBeginYear && eventEndYear && storyBeginYear && storyEndYear &&
                ((eventBeginYear >= storyBeginYear && eventBeginYear <= storyEndYear) || 
                 (eventEndYear >= storyBeginYear && eventEndYear <= storyEndYear) || 
                 (eventBeginYear <= storyBeginYear && eventEndYear >= storyEndYear)));
    }
    
    private findStoryCharacters(story: TimelineEvent, timelineData: TimelineData): TimelineEvent[] {
        // Find characters connected to this story
        const characterIds = new Set<string>();
        
        timelineData.connections.forEach(conn => {
            if (conn.from === story.id && conn.type === 'appears_in') {
                characterIds.add(conn.to);
            }
        });
        
        return timelineData.events.filter(event => 
            event.type === 'character' && characterIds.has(event.id)
        );
    }

    private createEventElement(event: TimelineEvent, index: number): HTMLElement {
        const eventEl = document.createElement('div');
        eventEl.className = `timeline-event timeline-event-${event.type} ${index % 2 == 0 ? 'timeline-event-odd' : 'timeline-event-even'}`;
        eventEl.dataset.id = event.id;

        eventEl.style.backgroundColor = this.getEventColor(event.type);

        const eventHeader = eventEl.createEl('div', { cls: 'event-header' });
        const titleSpan = eventHeader.createEl('span', { cls: 'event-title', text: event.title });

        if (event.status && event.status != 'alive') {
            titleSpan.appendChild(document.createTextNode(' '));
            titleSpan.createEl('span', { cls: `status-badge ${event.status}`, text: event.status });
        }

        // Add date if available
        if (event.displayBeginDate && event.displayEndDate && event.displayBeginDate !== event.displayEndDate) {
            eventHeader.createEl('span', { 
                cls: 'event-date', 
                text: `${event.displayBeginDate} - ${event.displayEndDate}` 
            });
        } else if (event.displayDate && event.displayDate !== '') {
            eventHeader.createEl('span', { cls: 'event-date', text: event.displayDate });
        }

        // Description
        if (event.description) {
            const desc = eventEl.createEl('div', { cls: 'event-description' });
            desc.innerHTML = this.truncateDescription(event.description, 150);
        }

        // Actions buttons
        const actionBar = eventEl.createEl('div', { cls: 'event-actions' });

        if (event.type === 'character') {
            const viewTimelineBtn = actionBar.createEl('button', { cls: 'event-action-button', text: 'View Timeline' });
            viewTimelineBtn.addEventListener('click', () => {
                this.focusCharacter = event.id;
                this.setDisplayMode('character');
            });
        } else if (event.type === 'story') {
            const viewStoryTimelineBtn = actionBar.createEl('button', { cls: 'event-action-button', text: 'View Timeline' });
            viewStoryTimelineBtn.addEventListener('click', () => {
                this.focusStory = event.id;
                this.setDisplayMode('story');
            });
        }

        const openFileBtn = actionBar.createEl('button', { cls: 'event-action-button', text: 'Open File' });
        openFileBtn.addEventListener('click', () => { this.openFile(event.file); });

        eventEl.createEl('span', {
            cls: 'event-type-badge',
            text: event.type
        });

        return eventEl;
    }
    
    private getEventColor(type: string): string {
        switch (type) {
            case 'story':
                return this.plugin.settings.storyColor || '#4A90E2';
            case 'event':
                return this.plugin.settings.eventColor || '#50C878';
            case 'character':
                return this.plugin.settings.characterColor || '#F5A623';
            case 'characterEvent':
                return this.plugin.settings.characterEventColor || '#D36582';
            default:
                return '#888888';
        }
    }

    private truncateDescription(description: string, maxLength: number): string {
        if (description.length <= maxLength) return description;
        return description.slice(0, maxLength) + '...';
    }

    private openFile(path: string) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
            this.app.workspace.getLeaf().openFile(file);
        }
    }

    private groupEventsByYear(events: TimelineEvent[]): Record<string, TimelineEvent[]> {
        const eventsByYear: Record<string, TimelineEvent[]> = {};
        if (!events) return eventsByYear;
        
        events.forEach(event => {
            // Use the date field or beginDate if available
            const dateStr = event.date || event.beginDate || '';
            if (!dateStr) return;
            
            // Extract just the year for grouping
            let year: string;
            
            // If the date is already a year, use it directly
            if (/^\d{4}$/.test(dateStr)) {
                year = dateStr;
            } else {
                // Extract the year component from the sortable date format (YYYY-MM-DD)
                const parts = dateStr.split('-');
                year = parts[0];
            }
            
            if (!eventsByYear[year]) eventsByYear[year] = [];
            eventsByYear[year].push(event);
        });
        return eventsByYear;
    }

    private getSortedYears(eventsByYear: Record<string, TimelineEvent[]>): string[] {
        const years = Object.keys(eventsByYear);

        // Sort years numerically
        years.sort((a, b) => {
            const yearA = parseInt(a);
            const yearB = parseInt(b);
            return yearA - yearB;
        });

        return years;
    }

    private setDisplayMode(mode: 'chronological' | 'character' | 'story') {
        this.displayMode = mode;

        const buttons = this.controlsEl.querySelectorAll('.timeline-view-button');
        buttons.forEach(button => {
            button.classList.remove('active');
            if (button.textContent === 'Chronological' && mode === 'chronological') {
                button.classList.add('active');
            } else if (button.textContent === 'Character' && mode === 'character') {
                button.classList.add('active');
            } else if (button.textContent === 'Story' && mode === 'story') {
                button.classList.add('active');
            }
        });

        this.renderTimeline();
    }

    private async promptForCharacter() {
        if (!this.timelineData) return;
        const characters = this.timelineData.events.filter(e => e.type === 'character');
        if (characters.length === 0) {
            new Notice('No characters found in timeline data.');
            return;
        }
        const modal = new SelectModal(this.app, characters, 'character', (id) => {
            if (id) {
                this.focusCharacter = id;
                this.setDisplayMode('character');
            }
        });
        modal.open();
    }
    
    private async promptForStory() {
        if (!this.timelineData) return;
        const stories = this.timelineData.events.filter(e => e.type === 'story');
        if (stories.length === 0) {
            new Notice('No stories found in timeline data.');
            return;
        }
        const modal = new SelectModal(this.app, stories, 'story', (id) => {
            if (id) {
                this.focusStory = id;
                this.setDisplayMode('story');
            }
        });
        modal.open();
    }
}

// Modal for item selection
class SelectModal extends Modal {
    private items: TimelineEvent[];
    private type: string;
    private onSelect: (id: string) => void;

    constructor(app: App, items: TimelineEvent[], type: string, onSelect: (id: string) => void) {
        super(app);
        this.items = items;
        this.type = type;
        this.onSelect = onSelect;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h3', { text: `Select a ${this.type}` });
        const itemList = contentEl.createEl('div', { cls: 'timeline-select-list' });
        this.items.forEach(item => {
            const itemElement = itemList.createEl('div', { cls: 'timeline-select-item' });
            itemElement.createEl('span', { text: item.title });
            itemElement.addEventListener('click', () => {
                this.onSelect(item.id);
                this.close();
            });
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}