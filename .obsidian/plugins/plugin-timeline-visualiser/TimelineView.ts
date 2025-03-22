import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
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
    private displayMode: 'chronological' | 'character' = 'chronological';
    private focusCharacter: string | null = null;
    private filteredTimelineData: TimelineData | null = null;

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

        // Add header
        this.headerEl = this.contentEl.createEl('div', { cls: 'timeline-header' });
        const titleEl = this.headerEl.createEl('h2', { text: 'Noir Universe Timeline' });
        
        // Add controls
        this.controlsEl = this.headerEl.createEl('div', { cls: 'timeline-controls' });
        
        // View mode toggle
        const viewModeContainer = this.controlsEl.createEl('div', { cls: 'timeline-view-mode' });
        viewModeContainer.createEl('span', { text: 'View Mode: ' });
        
        const chronoButton = viewModeContainer.createEl('button', { 
            cls: 'timeline-view-button active',
            text: 'Chronological'
        });
        chronoButton.addEventListener('click', () => this.setDisplayMode('chronological'));
        
        const characterButton = viewModeContainer.createEl('button', { 
            cls: 'timeline-view-button',
            text: 'Character-Centric'
        });
        characterButton.addEventListener('click', () => this.promptForCharacter());
        
        // Refresh button
        const refreshButton = this.controlsEl.createEl('button', {
            cls: 'timeline-refresh-button',
            text: 'Refresh Timeline'
        });
        refreshButton.addEventListener('click', () => this.refresh());
        
        // Add filter controls
        this.filterEl = this.contentEl.createEl('div', { cls: 'timeline-filters' });
        const filterControls = this.filterEl.createEl('div', { cls: 'filter-controls' });
        
        // Type filters
        const typeFilterContainer = filterControls.createEl('div', { cls: 'filter-section' });
        typeFilterContainer.createEl('span', { text: 'Show: ' });
        
        const storyCheckbox = this.createFilterCheckbox(typeFilterContainer, 'story', 'Stories', true);
        const eventCheckbox = this.createFilterCheckbox(typeFilterContainer, 'event', 'Events', true);
        const characterCheckbox = this.createFilterCheckbox(typeFilterContainer, 'character', 'Characters', true);
        
        // Search filter
        const searchContainer = filterControls.createEl('div', { cls: 'filter-search' });
        const searchInput = searchContainer.createEl('input', { 
            cls: 'timeline-search-input',
            attr: { 
                type: 'text',
                placeholder: 'Search timeline...'
            }
        });
        searchInput.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value.toLowerCase();
            this.filterTimeline(value);
        });
        
        // Add timeline container
        this.timelineEl = this.contentEl.createEl('div', { cls: 'timeline-content' });
        
        // Load and render timeline data
        await this.refresh();
    }

    private createFilterCheckbox(container: HTMLElement, type: string, label: string, checked: boolean): HTMLInputElement {
        const wrapper = container.createEl('label', { cls: 'filter-checkbox-wrapper' });
        const checkbox = wrapper.createEl('input', {
            attr: {
                type: 'checkbox',
                'data-filter-type': type,
                checked: checked
            }
        });
        wrapper.createEl('span', { text: label });
        
        checkbox.addEventListener('change', () => {
            this.applyFilters();
        });
        
        return checkbox;
    }

    // Remove the createLegend method as we no longer need it

    async refresh() {
        // Show loading indicator
        this.timelineEl.empty();
        this.timelineEl.createEl('div', { cls: 'timeline-loading', text: 'Loading timeline data...' });
        
        try {
            // Fetch timeline data
            this.timelineData = await this.plugin.getTimelineData();
            this.filteredTimelineData = this.timelineData;
            
            // Render the timeline
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
    
    private filterTimeline(searchTerm: string) {
        if (!this.timelineData) return;
        
        if (!searchTerm) {
            this.filteredTimelineData = this.timelineData;
        } else {
            // Filter events by search term
            const filteredEvents = this.timelineData.events.filter(event => 
                event.title.toLowerCase().includes(searchTerm) || 
                event.description.toLowerCase().includes(searchTerm) ||
                event.date.toLowerCase().includes(searchTerm)
            );
            
            // Include only connections involving filtered events
            const filteredEventIds = new Set(filteredEvents.map(e => e.id));
            const filteredConnections = this.timelineData.connections.filter(conn => 
                filteredEventIds.has(conn.from) || filteredEventIds.has(conn.to)
            );
            
            this.filteredTimelineData = {
                events: filteredEvents,
                connections: filteredConnections
            };
        }
        
        this.renderTimeline();
    }
    
    private applyFilters() {
        if (!this.timelineData) return;
        
        // Get active type filters
        const activeFilters: string[] = [];
        this.filterEl.querySelectorAll('input[data-filter-type]').forEach((checkbox: HTMLInputElement) => {
            if (checkbox.checked) {
                activeFilters.push(checkbox.dataset.filterType);
            }
        });
        
        // Filter events by type
        const filteredEvents = this.timelineData.events.filter(event => 
            activeFilters.includes(event.type)
        );
        
        // Include only connections involving filtered events
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
        // Create timeline container
        const timeline = this.timelineEl.createEl('div', { cls: 'timeline-chronological' });
        
        // Group events by date
        const eventsByDate = this.groupEventsByDate();
        
        // Sort dates (handling special cases like "Unknown" or "Present")
        const sortedDates = this.getSortedDates(eventsByDate);
        
        // Create a vertical timeline with the events
        const timelineLine = timeline.createEl('div', { cls: 'timeline-line' });
        
        sortedDates.forEach(date => {
            const events = eventsByDate[date];
            
            // Create date marker
            const dateMarker = timelineLine.createEl('div', { cls: 'timeline-date-marker' });
            dateMarker.createEl('div', { cls: 'timeline-date', text: date });
            
            // Create events for this date
            const eventsContainer = dateMarker.createEl('div', { cls: 'timeline-date-events' });
            
            events.forEach(event => {
                const eventEl = this.createEventElement(event);
                eventsContainer.appendChild(eventEl);
            });
        });
    }
    
    private renderCharacterTimeline() {
        if (!this.focusCharacter) {
            this.timelineEl.createEl('div', { 
                cls: 'timeline-empty', 
                text: 'No character selected. Please select a character to view their timeline.'
            });
            return;
        }
        
        // Get character info
        const character = this.filteredTimelineData.events.find(e => e.id === this.focusCharacter);
        if (!character) {
            this.timelineEl.createEl('div', { 
                cls: 'timeline-empty', 
                text: 'Selected character not found in timeline data.'
            });
            return;
        }
        
        // Create character header
        const characterHeader = this.timelineEl.createEl('div', { cls: 'character-timeline-header' });
        characterHeader.createEl('h3', { text: `Timeline for ${character.title}` });
        
        // Add status badge if available
        if (character.status) {
            characterHeader.appendChild(document.createTextNode(' '));
            const statusBadge = characterHeader.createEl('span', { 
                cls: `status-badge ${character.status}`, 
                text: character.status
            });
        }
        
        // Get events related to this character
        const relatedEventIds = new Set<string>();
        
        // Add character's own ID
        relatedEventIds.add(this.focusCharacter);
        
        // Find directly connected events
        this.filteredTimelineData.connections.forEach(conn => {
            if (conn.from === this.focusCharacter) {
                relatedEventIds.add(conn.to);
            }
            if (conn.to === this.focusCharacter) {
                relatedEventIds.add(conn.from);
            }
        });
        
        // Filter events to only those related to the character
        const characterEvents = this.filteredTimelineData.events.filter(e => 
            relatedEventIds.has(e.id)
        );
        
        // Create timeline container
        const timeline = this.timelineEl.createEl('div', { cls: 'timeline-character' });
        
        // Group character events by type
        const eventsByType = this.groupEventsByType(characterEvents);
        
        // First show character-specific events
        if (eventsByType.character_event && eventsByType.character_event.length > 0) {
            const characterEventsSection = timeline.createEl('div', { cls: 'timeline-section' });
            characterEventsSection.createEl('h4', { text: 'Character Events' });
            
            const eventsContainer = characterEventsSection.createEl('div', { cls: 'timeline-events-container' });
            eventsByType.character_event.forEach(event => {
                const eventEl = this.createEventElement(event);
                eventsContainer.appendChild(eventEl);
            });
        }
        
        // Then show stories this character appears in
        if (eventsByType.story && eventsByType.story.length > 0) {
            const storiesSection = timeline.createEl('div', { cls: 'timeline-section' });
            storiesSection.createEl('h4', { text: 'Stories' });
            
            const eventsContainer = storiesSection.createEl('div', { cls: 'timeline-events-container' });
            eventsByType.story.forEach(event => {
                const eventEl = this.createEventElement(event);
                eventsContainer.appendChild(eventEl);
            });
        }
        
        // Finally show other events
        if (eventsByType.event && eventsByType.event.length > 0) {
            const eventsSection = timeline.createEl('div', { cls: 'timeline-section' });
            eventsSection.createEl('h4', { text: 'Related Events' });
            
            const eventsContainer = eventsSection.createEl('div', { cls: 'timeline-events-container' });
            eventsByType.event.forEach(event => {
                const eventEl = this.createEventElement(event);
                eventsContainer.appendChild(eventEl);
            });
        }
    }
    
    private createEventElement(event: TimelineEvent): HTMLElement {
        // Create event container
        const eventEl = document.createElement('div');
        eventEl.className = `timeline-event timeline-event-${event.type}`;
        eventEl.dataset.id = event.id;
        
        // Set background color based on event type
        switch(event.type) {
            case 'story':
                eventEl.style.backgroundColor = this.plugin.settings.storyColor;
                break;
            case 'event':
                eventEl.style.backgroundColor = this.plugin.settings.eventColor;
                break;
            case 'character_event':
                eventEl.style.backgroundColor = this.plugin.settings.characterEventColor;
                break;
            case 'character':
                // Characters use status indicators instead of background color
                eventEl.style.backgroundColor = this.plugin.settings.defaultColor;
                break;
        }
        
        // Add a data attribute for position to be used by CSS
        const randomPosition = Math.random() < 0.5 ? 'left' : 'right';
        eventEl.dataset.position = randomPosition;
        
        // Create event header with title
        const eventHeader = eventEl.createEl('div', { cls: 'event-header' });
        
        // Title with status badge for characters
        const titleSpan = eventHeader.createEl('span', { cls: 'event-title', text: event.title });
        
        // Add status badge for characters
        if (event.status) {
            titleSpan.appendChild(document.createTextNode(' '));
            const statusBadge = titleSpan.createEl('span', { 
                cls: `status-badge ${event.status}`,
                text: event.status
            });
        }
        
        // Add date if available
        if (event.date && event.date !== 'Unknown') {
            eventHeader.createEl('span', { cls: 'event-date', text: event.date });
        }
        
        // Add description if available
        if (event.description) {
            const desc = eventEl.createEl('div', { cls: 'event-description' });
            desc.innerHTML = this.truncateDescription(event.description, 150);
        }
        
        // Add action buttons
        const actionBar = eventEl.createEl('div', { cls: 'event-actions' });
        
        if (event.type === 'character') {
            // For characters, add "View Timeline" button
            const viewTimelineBtn = actionBar.createEl('button', { 
                cls: 'event-action-button',
                text: 'View Timeline'
            });
            viewTimelineBtn.addEventListener('click', () => {
                this.focusCharacter = event.id;
                this.setDisplayMode('character');
            });
        }
        
        // Add "Open File" button for all events
        const openFileBtn = actionBar.createEl('button', { 
            cls: 'event-action-button',
            text: 'Open File'
        });
        openFileBtn.addEventListener('click', () => {
            this.openFile(event.file);
        });
        
        // Add type badge at the bottom
        let displayType = event.type;
        if (displayType === 'character_event') {
            displayType = 'character event';
        }
        
        const typeBadge = eventEl.createEl('span', {
            cls: 'event-type-badge',
            text: displayType
        });
        
        return eventEl;
    }
    
    private truncateDescription(description: string, maxLength: number): string {
        if (description.length <= maxLength) return description;
        return description.substr(0, maxLength) + '...';
    }
    
    private openFile(path: string) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
            this.app.workspace.getLeaf().openFile(file);
        }
    }
    
    private groupEventsByDate(): Record<string, TimelineEvent[]> {
        const eventsByDate: Record<string, TimelineEvent[]> = {};
        
        this.filteredTimelineData.events.forEach(event => {
            if (!event.date) event.date = 'Unknown';
            
            if (!eventsByDate[event.date]) {
                eventsByDate[event.date] = [];
            }
            
            eventsByDate[event.date].push(event);
        });
        
        return eventsByDate;
    }
    
    private groupEventsByType(events: TimelineEvent[]): Record<string, TimelineEvent[]> {
        const eventsByType: Record<string, TimelineEvent[]> = {};
        
        events.forEach(event => {
            if (!eventsByType[event.type]) {
                eventsByType[event.type] = [];
            }
            
            eventsByType[event.type].push(event);
        });
        
        return eventsByType;
    }
    
    private getSortedDates(eventsByDate: Record<string, TimelineEvent[]>): string[] {
        const dates = Object.keys(eventsByDate);
        
        // Special handling for certain date values
        const specialDates = ['Unknown', 'Present', 'Future', 'Past', '???'];
        
        // Remove special dates from the array
        const specialDateValues = dates.filter(date => specialDates.includes(date));
        const regularDates = dates.filter(date => !specialDates.includes(date));
        
        // Sort regular dates
        // This is a simple sort that works for years or simple date formats
        // For more complex dates, you would need a more sophisticated sorting approach
        regularDates.sort((a, b) => {
            // Try to extract years if possible
            const yearA = parseInt(a.match(/\d{4}/)?.[0] || a);
            const yearB = parseInt(b.match(/\d{4}/)?.[0] || b);
            
            if (!isNaN(yearA) && !isNaN(yearB)) {
                return yearA - yearB;
            }
            
            // Fallback to string comparison
            return a.localeCompare(b);
        });
        
        // Put "Unknown" at the beginning, "Present" and "Future" at the end
        const result = [];
        
        // Add Past
        if (specialDateValues.includes('Past')) {
            result.push('Past');
        }
        
        // Add Unknown
        if (specialDateValues.includes('Unknown') || specialDateValues.includes('???')) {
            result.push('Unknown');
        }
        
        // Add regular dates
        result.push(...regularDates);
        
        // Add Present
        if (specialDateValues.includes('Present')) {
            result.push('Present');
        }
        
        // Add Future
        if (specialDateValues.includes('Future')) {
            result.push('Future');
        }
        
        return result;
    }
    
    private setDisplayMode(mode: 'chronological' | 'character') {
        this.displayMode = mode;
        
        // Update active button
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
        
        // Get all characters
        const characters = this.timelineData.events.filter(e => e.type === 'character');
        
        if (characters.length === 0) {
            // No characters found
            new Notice('No characters found in timeline data.');
            return;
        }
        
        // Simple modal to select a character
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
            
            // Create name span
            const nameSpan = characterItem.createEl('span', { text: character.title });
            
            // Add status badge if available
            if (character.status) {
                nameSpan.appendChild(document.createTextNode(' '));
                const statusBadge = nameSpan.createEl('span', { 
                    cls: `status-badge ${character.status}`,
                    text: character.status
                });
            }
            
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

import { Modal } from 'obsidian';