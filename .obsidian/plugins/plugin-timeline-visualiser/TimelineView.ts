import { ItemView, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import TimelineVisualizerPlugin, { TimelineData, TimelineEvent } from './main';

export const VIEW_TYPE_TIMELINE = 'timeline-visualizer';

export class TimelineView extends ItemView {
    private plugin: TimelineVisualizerPlugin;
    private contentEl: HTMLElement;
    private timelineData: TimelineData | null = null;
    private loadingIndicator: HTMLElement;
    private viewMode: 'grid' | 'simple' = 'grid';

    constructor(leaf: WorkspaceLeaf, plugin: TimelineVisualizerPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.contentEl = this.containerEl.createDiv({ cls: 'timeline-visualizer-container' });
        this.loadingIndicator = this.contentEl.createDiv({ cls: 'timeline-loading', text: 'Loading timeline...' });
    }

    async onOpen() {
        this.renderHeader();
        await this.loadTimelineData();
    }

    getViewType(): string {
        return VIEW_TYPE_TIMELINE;
    }

    getDisplayText(): string {
        return 'Timeline Visualizer';
    }

    async onClose() {
        this.contentEl.empty();
    }

    private renderHeader() {
        const headerEl = this.contentEl.createDiv({ cls: 'timeline-header' });
        
        const titleEl = headerEl.createEl('h2', { text: 'Timeline Visualizer' });
        
        const controlsEl = headerEl.createDiv({ cls: 'timeline-controls' });
        
        //View mode controls
        const viewModeEl = controlsEl.createDiv({ cls: 'timeline-view-mode' });
        viewModeEl.createSpan({ text: 'View:' });
        
        const gridViewBtn = viewModeEl.createEl('button', { 
            cls: `timeline-view-button ${this.viewMode === 'grid' ? 'active' : ''}`,
            text: 'Grid' 
        });
        
        const simpleViewBtn = viewModeEl.createEl('button', { 
            cls: `timeline-view-button ${this.viewMode === 'simple' ? 'active' : ''}`,
            text: 'Simple' 
        });
        
        //Add events to buttons
        gridViewBtn.addEventListener('click', () => {
            this.viewMode = 'grid';
            gridViewBtn.classList.add('active');
            simpleViewBtn.classList.remove('active');
            this.renderTimeline();
        });
        
        simpleViewBtn.addEventListener('click', () => {
            this.viewMode = 'simple';
            simpleViewBtn.classList.add('active');
            gridViewBtn.classList.remove('active');
            this.renderTimeline();
        });
        
        //Refresh button
        const refreshBtn = controlsEl.createEl('button', {
            cls: 'timeline-refresh-button',
            text: 'Refresh'
        });
        
        refreshBtn.addEventListener('click', () => {
            this.refresh();
        });
    }

    private renderFilters() {
        //Remove existing filters
        const existingFilters = this.contentEl.querySelector('.timeline-filters');
        if (existingFilters) {
            existingFilters.remove();
        }

        if (!this.timelineData || !this.timelineData.events || this.timelineData.events.length === 0) {
            return;
        }

        const filtersEl = this.contentEl.createDiv({ cls: 'timeline-filters' });
        const filterControlsEl = filtersEl.createDiv({ cls: 'filter-controls' });

        //Type filters
        const typeFiltersEl = filterControlsEl.createDiv({ cls: 'filter-section' });
        typeFiltersEl.createSpan({ text: 'Type:' });

        const allTypesBtn = typeFiltersEl.createEl('button', {
            cls: 'filter-button is-active',
            text: 'All'
        });

        const storyBtn = typeFiltersEl.createEl('button', {
            cls: 'filter-button',
            text: 'Stories'
        });

        const eventBtn = typeFiltersEl.createEl('button', {
            cls: 'filter-button',
            text: 'Events'
        });

        const characterBtn = typeFiltersEl.createEl('button', {
            cls: 'filter-button',
            text: 'Characters'
        });

        //Date range filter
        const dateFiltersEl = filterControlsEl.createDiv({ cls: 'filter-section' });
        dateFiltersEl.createSpan({ text: 'Date Range:' });
        
        //TODO: Implement date range filter
    }

    async loadTimelineData() {
        try {
            this.loadingIndicator.style.display = 'flex';
            this.timelineData = await this.plugin.getTimelineData();
            this.loadingIndicator.style.display = 'none';
            
            this.renderFilters();
            this.renderTimeline();
        } catch (error) {
            console.error('Error loading timeline data:', error);
            this.loadingIndicator.style.display = 'none';
            
            const errorEl = this.contentEl.createDiv({ 
                cls: 'timeline-error', 
                text: `Error loading timeline data: ${error.message}` 
            });
        }
    }

    private renderTimeline() {
        //Remove existing timeline content
        const existingContent = this.contentEl.querySelector('.timeline-content');
        if (existingContent) {
            existingContent.remove();
        }

        if (!this.timelineData || !this.timelineData.events || this.timelineData.events.length === 0) {
            this.contentEl.createDiv({
                cls: 'timeline-empty',
                text: 'No timeline data available. Please check your folder settings and make sure you have content.'
            });
            return;
        }

        const timelineContentEl = this.contentEl.createDiv({ cls: 'timeline-content' });

        if (this.viewMode === 'grid') {
            this.renderGridTimeline(timelineContentEl);
        } else {
            this.renderSimpleTimeline(timelineContentEl);
        }
    }

    private renderGridTimeline(containerEl: HTMLElement) {
        if (!this.timelineData?.grid || !this.timelineData?.rowDates) {
            containerEl.createDiv({
                cls: 'timeline-empty',
                text: 'Grid data not available. Please refresh the timeline.'
            });
            return;
        }

        const { grid, rowDates, columnCount } = this.timelineData;
        
        //Create grid container
        const gridContainer = containerEl.createEl('div', { cls: 'timeline-grid' });
        
        //Style the grid container
        gridContainer.style.display = 'grid';
        gridContainer.style.gridTemplateColumns = `repeat(${columnCount}, minmax(280px, 1fr))`;
        gridContainer.style.gridAutoRows = 'minmax(100px, auto)';
        gridContainer.style.gap = '10px';
        gridContainer.style.position = 'relative';
        gridContainer.style.padding = '10px';
        gridContainer.style.paddingLeft = '140px';
        
        //Add date labels column 
        const dateLabelsContainer = gridContainer.createEl('div', { cls: 'timeline-date-labels' });
        dateLabelsContainer.style.position = 'absolute';
        dateLabelsContainer.style.left = '-140px';
        dateLabelsContainer.style.top = '0';
        dateLabelsContainer.style.bottom = '0';
        dateLabelsContainer.style.width = '140px';
        dateLabelsContainer.style.borderRight = '1px solid var(--background-modifier-border)';
        
        //Add date labels
        rowDates.forEach((dateStr, index) => {
            const date = new Date(dateStr);
            const dateLabel = dateLabelsContainer.createEl('div', { 
                cls: 'timeline-date-label',
                text: this.formatDate(date)
            });
            
            dateLabel.style.position = 'absolute';
            dateLabel.style.top = `${index * 100}px`;
            dateLabel.style.right = '10px';
            dateLabel.style.padding = '4px 8px';
            dateLabel.style.borderRadius = '4px';
            dateLabel.style.backgroundColor = 'var(--background-primary-alt)';
            dateLabel.style.fontSize = '12px';
            dateLabel.style.zIndex = '1';
        });
        
        //Add horizontal lines for each date
        rowDates.forEach((_, index) => {
            if (index === 0) return; //Skip first line
            
            const line = gridContainer.createEl('div');
            line.style.position = 'absolute';
            line.style.left = '0';
            line.style.right = '0';
            line.style.top = `${index * 100}px`;
            line.style.height = '1px';
            line.style.backgroundColor = 'var(--background-modifier-border)';
            line.style.zIndex = '0';
        });
        
        //Add events to grid
        let processedEvents = new Set();
        
        //Process the grid
        grid.forEach((row, rowIndex) => {
            row.forEach((event, colIndex) => {
                if (!event || processedEvents.has(event.id)) {
                    return;
                }
                
                processedEvents.add(event.id);
                
                const eventEl = this.createEventElement(event);
                gridContainer.appendChild(eventEl);
                
                //Set grid position
                eventEl.style.gridColumnStart = `${event.column + 1}`;
                eventEl.style.gridColumnEnd = `${event.column + 2}`;
                eventEl.style.gridRowStart = `${event.startRow + 1}`;
                eventEl.style.gridRowEnd = `${event.endRow + 2}`;
            });
        });
    }

    private renderSimpleTimeline(containerEl: HTMLElement) {
        if (!this.timelineData || !this.timelineData.events) {
            return;
        }
        
        //Group events by year/month
        const eventsByDate = this.groupEventsByDate(this.timelineData.events);
        
        const simpleTimelineEl = containerEl.createDiv({ cls: 'simple-timeline' });
        
        //Add central line
        simpleTimelineEl.createDiv({ cls: 'center-line' });
        
        //Track if we should position events left or right
        let isLeft = true;
        
        //Add each date section
        Object.entries(eventsByDate).forEach(([dateKey, events]) => {
            const [year, month] = dateKey.split('-').map(Number);
            const date = new Date(year, month - 1);
            
            const dateSectionEl = simpleTimelineEl.createDiv({ 
                cls: `date-section ${isLeft ? 'date-left' : 'date-right'}` 
            });
            
            //Add date label
            dateSectionEl.createDiv({
                cls: 'date-label',
                text: this.formatDate(date)
            });
            
            //Add events container
            const eventsContainerEl = dateSectionEl.createDiv({ cls: 'date-events-container' });
            
            //Add each event
            events.forEach(event => {
                eventsContainerEl.appendChild(this.createEventElement(event));
            });
            
            //Alternate left and right
            isLeft = !isLeft;
        });
    }

    private createEventElement(event: TimelineEvent): HTMLElement {
        const eventEl = document.createElement('div');
        eventEl.className = `timeline-event event-type-${event.type}`;
        
        //Set background color based on event type
        if (event.type === 'story') {
            eventEl.style.backgroundColor = this.plugin.settings.storyColor || '#3a6ea5';
        } else if (event.type === 'event') {
            eventEl.style.backgroundColor = this.plugin.settings.eventColor || '#6d4c41';
        } else if (event.type === 'character' || event.type === 'characterEvent') {
            eventEl.style.backgroundColor = this.plugin.settings.characterEventColor || '#388e3c';
        }
        
        //Add event header with title and date
        const headerEl = eventEl.createDiv({ cls: 'event-header' });
        headerEl.createDiv({ cls: 'event-title', text: event.title });
        
        const dateText = this.getEventDateRangeText(event);
        if (dateText) {
            headerEl.createDiv({ cls: 'event-date', text: dateText });
        }
        
        //Add description
        if (event.description) {
            eventEl.createDiv({ 
                cls: 'event-description',
                text: this.truncateText(event.description, 100)
            });
        }
        
        //Add type badge
        eventEl.createDiv({
            cls: 'event-type-badge',
            text: event.type
        });
        
        //Add actions buttons
        const actionsEl = eventEl.createDiv({ cls: 'event-actions' });
        
        const openBtn = actionsEl.createEl('button', {
            cls: 'event-action-button',
            text: 'Open'
        });
        
        openBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openFile(event.file);
        });
        
        //Make the whole event element clickable
        eventEl.addEventListener('click', () => {
            this.openFile(event.file);
        });
        
        return eventEl;
    }

    private openFile(path: string) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
            this.app.workspace.getLeaf().openFile(file);
        } else {
            new Notice(`File not found: ${path}`);
        }
    }

    private formatDate(date: Date): string {
        const options: Intl.DateTimeFormatOptions = { 
            year: 'numeric', 
            month: 'short'
        };
        return date.toLocaleDateString(undefined, options);
    }

    private getEventDateRangeText(event: TimelineEvent): string {
        if (!event.beginDate) return '';
        
        const beginDate = new Date(event.beginDate);
        
        if (!event.endDate || event.beginDate === event.endDate) {
            return this.formatDate(beginDate);
        }
        
        const endDate = new Date(event.endDate);
        return `${this.formatDate(beginDate)} - ${this.formatDate(endDate)}`;
    }

    private truncateText(text: string, maxLength: number): string {
        if (!text || text.length <= maxLength) return text;
        return text.slice(0, maxLength) + '...';
    }


    private groupEventsByDate(events: TimelineEvent[]): Record<string, TimelineEvent[]> {
        const eventsByDate: Record<string, TimelineEvent[]> = {};
        
        events.forEach(event => {
            if (!event.beginDate) return;
            
            const date = new Date(event.beginDate);
            const yearMonth = `${date.getFullYear()}-${date.getMonth() + 1}`;
            
            if (!eventsByDate[yearMonth]) {
                eventsByDate[yearMonth] = [];
            }
            
            eventsByDate[yearMonth].push(event);
        });
        
        //Sort dates
        return Object.fromEntries(
            Object.entries(eventsByDate).sort(([dateA], [dateB]) => {
                return dateA.localeCompare(dateB);
            })
        );
    }

    async refresh() {
        await this.loadTimelineData();
    }
}