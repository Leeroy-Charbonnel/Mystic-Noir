import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import TimelineVisualizerPlugin, { TimelineEvent, TimelineConnection, TimelineData } from './main';
import { Modal, Notice, App } from 'obsidian';

export const VIEW_TYPE_TIMELINE = 'timeline-visualizer';

export class TimelineView extends ItemView {
    private plugin: TimelineVisualizerPlugin;
    private contentEl: HTMLElement;
    private timelineEl: HTMLElement;
    private headerEl: HTMLElement;
    private controlsEl: HTMLElement;
    private filterEl: HTMLElement;
    private timelineData: TimelineData | null = null;
    private displayMode: 'chronological' | 'character' = 'chronological';
    private focusCharacter: string | null = null;
    private filteredTimelineData: TimelineData | null = null;
    private activeFilters: Record<string, boolean> = {
        'story': true,
        'event': true,
        'character': true,
        'characterEvent': true
    };

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
        this.controlsEl = this.headerEl.createEl('div', { cls: 'timeline-controls' });
        const viewModeContainer = this.controlsEl.createEl('div', { cls: 'timeline-view-mode' });
        viewModeContainer.createEl('span', { text: 'View Mode: ' });

        //Chrono
        const chronoButton = viewModeContainer.createEl('button', {
            cls: 'timeline-view-button active',
            text: 'Chronological'
        });
        chronoButton.addEventListener('click', () => this.setDisplayMode('chronological'));

        //Characters
        const characterButton = viewModeContainer.createEl('button', {
            cls: 'timeline-view-button',
            text: 'Character-Centric'
        });
        characterButton.addEventListener('click', () => this.promptForCharacter());

        //Refresh
        const refreshButton = this.controlsEl.createEl('button', {
            cls: 'timeline-refresh-button',
            text: 'Refresh Timeline'
        });
        refreshButton.addEventListener('click', () => this.refresh());

        //Filters 
        this.filterEl = this.contentEl.createEl('div', { cls: 'timeline-filters' });
        const filterControls = this.filterEl.createEl('div', { cls: 'filter-controls' });

        const typeFilterContainer = filterControls.createEl('div', { cls: 'filter-section' });
        const filterButtonsContainer = typeFilterContainer.createEl('div', { cls: 'filter-buttons' });

        this.createFilterButton(filterButtonsContainer, 'story', 'Stories');
        this.createFilterButton(filterButtonsContainer, 'event', 'Events');
        this.createFilterButton(filterButtonsContainer, 'characterEvent', 'Characters Events');

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

        try {
            this.timelineData = await this.plugin.getTimelineData();
            this.filteredTimelineData = this.timelineData;
            this.applyFilters();
            this.renderTimeline();
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

        //Get active filters
        const activeTypes = Object.entries(this.activeFilters)
            .filter(([_, isActive]) => isActive)
            .map(([type]) => type);

        //Filter
        const filteredEvents = this.timelineData.events.filter(event =>
            activeTypes.includes(event.type)
        );

        //Filter connections
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
        }
    }

    private renderChronologicalTimeline() {
        if (!this.filteredTimelineData) return;

        // Group events by date
        const eventsByDate = this.groupEventsByDate(this.filteredTimelineData);
        const sortedDates = this.getSortedDates(eventsByDate);
        
        // Create a simple timeline container
        const timelineContainer = this.timelineEl.createDiv({ cls: "simple-timeline" });
        
        // Add a center line
        const centerLine = document.createElement('div');
        centerLine.className = 'center-line';
        timelineContainer.appendChild(centerLine);
        
        // Track which side to place events (left/right alternating)
        let side = 'left';
        
        // Add each date with its events
        sortedDates.forEach(date => {
            const events = eventsByDate[date].filter(e => e.type !== 'character');
            if (events.length === 0) return;
            
            // Create a date section
            const dateSection = document.createElement('div');
            dateSection.className = `date-section date-${side}`;
            timelineContainer.appendChild(dateSection);
            
            // Add date label
            const dateLabel = document.createElement('div');
            dateLabel.className = 'date-label';
            dateLabel.textContent = date;
            dateSection.appendChild(dateLabel);
            
            // Create container for all events on this date
            const eventsContainer = document.createElement('div');
            eventsContainer.className = 'date-events-container';
            dateSection.appendChild(eventsContainer);
            
            // Add each event
            events.forEach(event => {
                const eventDiv = this.createSimpleEventElement(event);
                eventsContainer.appendChild(eventDiv);
            });
            
            // Switch sides for next date
            side = side === 'left' ? 'right' : 'left';
        });
    }
    
    private renderCharacterTimeline() {
        if (!this.focusCharacter || !this.filteredTimelineData || !this.timelineData) {
            this.timelineEl.createEl('div', {
                cls: 'timeline-empty',
                text: 'No character selected or no data available.'
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

        // Add character header
        const characterHeader = this.timelineEl.createEl('div', { cls: 'character-timeline-header' });
        characterHeader.createEl('h3', { text: `Timeline for ${character.title}` });
        
        if (character.status && character.status !== 'alive') {
            characterHeader.appendChild(document.createTextNode(' '));
            characterHeader.createEl('span', {
                cls: `status-badge ${character.status}`,
                text: character.status
            });
        }

        // Get related events
        const relatedEventIds = new Set<string>();
        this.filteredTimelineData.connections.forEach(conn => {
            if (conn.from === this.focusCharacter) {
                relatedEventIds.add(conn.to);
            }
            if (conn.to === this.focusCharacter) {
                relatedEventIds.add(conn.from);
            }
        });

        const characterEvents = {
            events: this.filteredTimelineData.events.filter(e => relatedEventIds.has(e.id)),
            connections: []
        };

        // Group events by date
        const eventsByDate = this.groupEventsByDate(characterEvents);
        const sortedDates = this.getSortedDates(eventsByDate);
        
        // Create timeline container
        const timelineContainer = this.timelineEl.createDiv({ cls: "simple-timeline" });
        
        // Add center line
        const centerLine = document.createElement('div');
        centerLine.className = 'center-line';
        timelineContainer.appendChild(centerLine);
        
        // Track which side to place events (left/right alternating)
        let side = 'left';
        
        // Add each date with its events
        sortedDates.forEach(date => {
            const events = eventsByDate[date];
            if (events.length === 0) return;
            
            // Create a date section
            const dateSection = document.createElement('div');
            dateSection.className = `date-section date-${side}`;
            timelineContainer.appendChild(dateSection);
            
            // Add date label
            const dateLabel = document.createElement('div');
            dateLabel.className = 'date-label';
            dateLabel.textContent = date;
            dateSection.appendChild(dateLabel);
            
            // Create container for all events on this date
            const eventsContainer = document.createElement('div');
            eventsContainer.className = 'date-events-container';
            dateSection.appendChild(eventsContainer);
            
            // Add each event
            events.forEach(event => {
                const eventDiv = this.createSimpleEventElement(event);
                eventsContainer.appendChild(eventDiv);
            });
            
            // Switch sides for next date
            side = side === 'left' ? 'right' : 'left';
        });
    }

    private createSimpleEventElement(event: TimelineEvent): HTMLElement {
        const eventDiv = document.createElement('div');
        eventDiv.className = `timeline-event timeline-event-${event.type}`;
        eventDiv.dataset.id = event.id;
        
        // Set background color based on event type
        switch (event.type) {
            case 'story':
                eventDiv.style.backgroundColor = this.plugin.settings.storyColor || '#3498db';
                break;
            case 'event':
                eventDiv.style.backgroundColor = this.plugin.settings.eventColor || '#2ecc71';
                break;
            case 'characterEvent':
                eventDiv.style.backgroundColor = this.plugin.settings.characterEventColor || '#e74c3c';
                break;
        }
        
        // Event header with title and date
        const header = document.createElement('div');
        header.className = 'event-header';
        
        const title = document.createElement('div');
        title.className = 'event-title';
        title.textContent = event.title;
        header.appendChild(title);
        
        if (event.beginDate) {
            const date = document.createElement('div');
            date.className = 'event-date';
            date.textContent = event.beginDate;
            header.appendChild(date);
        }
        
        eventDiv.appendChild(header);
        
        // Event description
        if (event.description) {
            const desc = document.createElement('div');
            desc.className = 'event-description';
            desc.innerHTML = this.truncateDescription(event.description, 150);
            eventDiv.appendChild(desc);
        }
        
        // Event type badge
        const badge = document.createElement('div');
        badge.className = 'event-type-badge';
        badge.textContent = event.type;
        eventDiv.appendChild(badge);
        
        // Action buttons
        const actions = document.createElement('div');
        actions.className = 'event-actions';
        
        // Add character timeline button for character events
        if (event.type === 'characterEvent') {
            const viewTimelineBtn = document.createElement('button');
            viewTimelineBtn.className = 'event-action-button';
            viewTimelineBtn.textContent = 'View Timeline';
            viewTimelineBtn.addEventListener('click', () => {
                this.focusCharacter = event.id;
                this.setDisplayMode('character');
            });
            actions.appendChild(viewTimelineBtn);
        }
        
        // Add open file button
        const openFileBtn = document.createElement('button');
        openFileBtn.className = 'event-action-button';
        openFileBtn.textContent = 'Open File';
        openFileBtn.addEventListener('click', () => {
            this.openFile(event.file);
        });
        actions.appendChild(openFileBtn);
        
        eventDiv.appendChild(actions);
        
        return eventDiv;
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

    private groupEventsByDate(timelineData: TimelineData): Record<string, TimelineEvent[]> {
        const eventsByDate: Record<string, TimelineEvent[]> = {};
        
        if (timelineData) {
            timelineData.events.forEach(event => {
                if (!event.beginDate) return;
                
                // Use formatted date string for grouping
                const dateKey = event.beginDate;
                if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
                eventsByDate[dateKey].push(event);
            });
        }
        
        return eventsByDate;
    }

    private getSortedDates(eventsByDate: Record<string, TimelineEvent[]>): string[] {
        const dates = Object.keys(eventsByDate);

        dates.sort((a, b) => {
            // First try to parse as full dates
            const dateA = new Date(a);
            const dateB = new Date(b);
            
            if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
                return dateA.getTime() - dateB.getTime();
            }
            
            // If that fails, try to compare as years
            const yearA = parseInt(a);
            const yearB = parseInt(b);
            if (!isNaN(yearA) && !isNaN(yearB)) return yearA - yearB;
            
            // Fall back to string comparison
            return a.localeCompare(b);
        });

        return dates;
    }

    private setDisplayMode(mode: 'chronological' | 'character') {
        this.displayMode = mode;

        const buttons = this.controlsEl.querySelectorAll('.timeline-view-button');
        buttons.forEach(button => {
            button.classList.remove('active');
            if (button.textContent === 'Chronological' && mode === 'chronological') {
                button.classList.add('active');
            } else if (button.textContent === 'Character-Centric' && mode === 'character') {
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
        const modal = new CharacterSelectModal(this.app, characters, (characterId) => {
            if (characterId) {
                this.focusCharacter = characterId;
                this.setDisplayMode('character');
            }
        });
        modal.open();
    }
}

// Simple modal for character selection
class CharacterSelectModal extends Modal {
    private characters: TimelineEvent[];
    private onSelect: (characterId: string) => void;

    constructor(app: App, characters: TimelineEvent[], onSelect: (characterId: string) => void) {
        super(app);
        this.characters = characters;
        this.onSelect = onSelect;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h3', { text: 'Select a Character' });
        const characterList = contentEl.createEl('div', { cls: 'character-select-list' });
        this.characters.forEach(character => {
            const characterItem = characterList.createEl('div', { cls: 'character-select-item' });
            characterItem.createEl('span', { text: character.title });
            characterItem.addEventListener('click', () => {
                this.onSelect(character.id);
                this.close();
            });
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}