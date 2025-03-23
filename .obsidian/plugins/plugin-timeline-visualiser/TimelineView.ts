import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import TimelineVisualizerPlugin, { TimelineEvent, TimelineData } from './main';

export const VIEW_TYPE_TIMELINE = 'timeline-visualizer';

export interface NodeProperties {
    children?: HTMLElement[];
    attributes?: Record<string,string>;
    text?: string;
    class?: string;
    classes?: string[];
    style?: Record<string,string>;
}

export function node<K extends keyof HTMLElementTagNameMap>(tag: K,properties?: NodeProperties): HTMLElementTagNameMap[K] {
    const element=document.createElement(tag);
    if(properties?.children)
        for(const c of properties.children) element.appendChild(c);
    if(properties?.class)
        element.setAttribute('class',properties.class);
    if(properties?.classes)
        properties?.classes.forEach(c => { element.addClass(c); });
    if(properties?.attributes)
        for(const [k,v] of Object.entries(properties.attributes)) element.setAttribute(k,v);
    if(properties?.text)
        element.textContent=properties.text;
    if(properties?.style)
        for(const [k,v] of Object.entries(properties.style)) element.attributeStyleMap.set(k,v);
    return element;
}

export class TimelineView extends ItemView {
    private plugin: TimelineVisualizerPlugin;
    private contentEl: HTMLElement;
    private timelineData: TimelineData | null = null;
    private filterControls: HTMLElement;
    private filterTypes: {[key: string]: boolean} = {
        story: true,
        event: true,
        character: true,
        characterEvent: true
    };

    constructor(leaf: WorkspaceLeaf, plugin: TimelineVisualizerPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.contentEl = node('div', { class: 'timeline-visualizer-container' });
        this.containerEl.children[1].appendChild(this.contentEl);
    }

    getViewType(): string {
        return VIEW_TYPE_TIMELINE;
    }

    getDisplayText(): string {
        return 'Timeline Visualizer';
    }

    async onOpen(): Promise<void> {
        await this.refresh();
    }

    async refresh(): Promise<void> {
        //Clear content
        this.contentEl.empty();
        
        //Create header
        const headerEl = node('div', { class: 'timeline-header' });
        const title = node('h2', { text: 'Timeline Visualizer' });
        headerEl.appendChild(title);
        
        //Create controls
        const controlsEl = node('div', { class: 'timeline-controls' });
        const refreshBtn = node('button', { 
            class: 'timeline-refresh-button',
            text: 'Refresh'
        });
        refreshBtn.addEventListener('click', () => this.refresh());
        controlsEl.appendChild(refreshBtn);
        headerEl.appendChild(controlsEl);
        
        this.contentEl.appendChild(headerEl);
        
        //Create filter controls
        this.filterControls = node('div', { class: 'timeline-filters' });
        this.contentEl.appendChild(this.filterControls);
        this.createFilterControls();
        
        //Create timeline content container
        const timelineContent = node('div', { class: 'timeline-content' });
        this.contentEl.appendChild(timelineContent);
        
        //Show loading indicator
        const loadingEl = node('div', { 
            class: 'timeline-loading',
            text: 'Loading timeline data...'
        });
        timelineContent.appendChild(loadingEl);
        
        try {
            //Get timeline data from plugin
            this.timelineData = await this.plugin.getTimelineData();
            
            //Remove loading indicator
            loadingEl.remove();
            
            if (!this.timelineData.events || this.timelineData.events.length === 0) {
                const emptyEl = node('div', { 
                    class: 'timeline-empty',
                    text: 'No timeline data available. Please check folder settings and ensure your files have date information.'
                });
                timelineContent.appendChild(emptyEl);
                return;
            }
            
            //Render calendar view
            this.renderCalendarView(timelineContent);
            
        } catch (error) {
            loadingEl.remove();
            const errorEl = node('div', { 
                class: 'timeline-error',
                text: `Error loading timeline data: ${error.message}`
            });
            timelineContent.appendChild(errorEl);
            console.error('Timeline Visualizer error:', error);
        }
    }

    private createFilterControls(): void {
        this.filterControls.empty();
        
        const filterControlsEl = node('div', { class: 'filter-controls' });
        this.filterControls.appendChild(filterControlsEl);
        
        const typeFilterEl = node('div', { class: 'filter-section' });
        filterControlsEl.appendChild(typeFilterEl);
        
        const filterLabel = node('span', { 
            class: 'filter-label',
            text: 'Filter by type:' 
        });
        typeFilterEl.appendChild(filterLabel);
        
        const createFilterButton = (type: string, label: string) => {
            const buttonClasses = ['filter-button', `filter-type-${type}`];
            if(this.filterTypes[type]) buttonClasses.push('is-active');
            
            const button = node('button', {
                classes: buttonClasses,
                text: label
            });
            
            button.addEventListener('click', () => {
                this.filterTypes[type] = !this.filterTypes[type];
                this.refresh();
            });
            
            typeFilterEl.appendChild(button);
        };
        
        createFilterButton('story', 'Stories');
        createFilterButton('event', 'Events');
        createFilterButton('character', 'Characters');
        createFilterButton('characterEvent', 'Character Events');
    }

    private renderCalendarView(container: HTMLElement): void {
        if (!this.timelineData || !this.timelineData.events || this.timelineData.events.length === 0) return;
        
        //Add calendar title
        const calendarTitle = node('div', {
            class: 'calendar-title',
            style: {
                'font-size': '1.2em',
                'font-weight': 'bold',
                'margin-bottom': '15px',
                'text-align': 'center'
            },
            text: 'Timeline Calendar View'
        });
        container.appendChild(calendarTitle);
        
        //Filter events based on current filters
        const filteredEvents = this.timelineData.events.filter(event => this.filterTypes[event.type]);
        
        if (filteredEvents.length === 0) {
            const emptyEl = node('div', { 
                class: 'timeline-empty',
                text: 'No events match the current filters.'
            });
            container.appendChild(emptyEl);
            return;
        }
        
        //Sort events by begin date
        const sortedEvents = [...filteredEvents].sort((a, b) => {
            if (!a.beginDate) return 1;
            if (!b.beginDate) return -1;
            return new Date(a.beginDate).getTime() - new Date(b.beginDate).getTime();
        });
        
        //Process events to determine grid positioning
        const processedEvents = this.processEventsForCalendar(sortedEvents);
        
        //Create calendar grid
        const calendarGrid = node('div', { 
            class: 'calendar-grid',
            style: {
                'display': 'grid',
                'grid-template-columns': `200px repeat(${processedEvents.columnCount}, 1fr)`,
                'grid-template-rows': `repeat(${processedEvents.rowDates.length}, auto)`,
                'gap': '8px',
                'position': 'relative',
                'min-height': '500px'
            }
        });
        container.appendChild(calendarGrid);
        
        //Render date cells in first column
        for (let i = 0; i < processedEvents.rowDates.length; i++) {
            const dateCell = node('div', { 
                class: 'calendar-date-cell',
                style: {
                    'grid-row': `${i + 1}`,
                    'grid-column': '1',
                    'background': 'var(--background-secondary)',
                    'padding': '10px',
                    'font-weight': 'bold',
                    'border-right': '1px solid var(--background-modifier-border)',
                    'border-bottom': '1px solid var(--background-modifier-border)',
                    'display': 'flex',
                    'align-items': 'center',
                    'justify-content': 'center',
                    'text-align': 'center'
                }
            });
            
            //Format date
            const dateObj = new Date(processedEvents.rowDates[i]);
            const formattedDate = `${dateObj.toLocaleDateString(undefined, { 
                year: 'numeric', 
                month: 'short',
                day: 'numeric'
            })}`;
            
            dateCell.textContent = formattedDate;
            calendarGrid.appendChild(dateCell);
        }
        
        //Render events
        processedEvents.events.forEach(event => {
            if (event.startRow === undefined || event.endRow === undefined || event.column === undefined) return;
            
            //Set event styling based on type
            let bgColor = '#64748b'; //Default color
            
            if (event.type === 'story') {
                bgColor = this.plugin.settings.storyColor || '#3b82f6';
            } else if (event.type === 'event') {
                bgColor = this.plugin.settings.eventColor || '#10b981';
            } else if (event.type === 'characterEvent') {
                bgColor = this.plugin.settings.characterEventColor || '#f59e0b';
            } else if (event.type === 'character') {
                bgColor = '#8b5cf6';
            }
            
            const eventEl = node('div', { 
                class: 'calendar-event',
                style: {
                    'grid-row': `${event.startRow + 1} / ${event.endRow + 1}`,
                    'grid-column': `${event.column + 2}`, // +2 instead of +1 to account for date column
                    'background-color': bgColor,
                    'color': 'white',
                    'padding': '10px',
                    'border-radius': '4px',
                    'box-shadow': '0 1px 3px rgba(0,0,0,0.12)',
                    'cursor': 'pointer',
                    'overflow': 'hidden',
                    'z-index': '2'
                }
            });
            
            //Create event content
            const eventHeader = node('div', { class: 'event-header' });
            eventEl.appendChild(eventHeader);
            
            const eventTitle = node('div', { 
                class: 'event-title',
                text: event.title
            });
            eventHeader.appendChild(eventTitle);
            
            if (event.beginDate) {
                const startDate = new Date(event.beginDate);
                const endDate = event.endDate ? new Date(event.endDate) : null;
                
                let dateText = startDate.toLocaleDateString();
                if (endDate && event.endDate !== event.beginDate) {
                    dateText += ` - ${endDate.toLocaleDateString()}`;
                }
                
                const eventDate = node('div', { 
                    class: 'event-date',
                    text: dateText
                });
                eventHeader.appendChild(eventDate);
            }
            
            if (event.description) {
                const eventDescription = node('div', { 
                    class: 'event-description',
                    text: event.description
                });
                eventEl.appendChild(eventDescription);
            }
            
            //Add type badge
            const typeBadge = node('div', { 
                class: 'event-type-badge',
                text: event.type
            });
            eventEl.appendChild(typeBadge);
            
            //Handle click to open the file
            eventEl.addEventListener('click', (e) => {
                e.preventDefault();
                this.openEventFile(event);
            });
            
            calendarGrid.appendChild(eventEl);
        });
    }

    private processEventsForCalendar(events: TimelineEvent[]): {events: TimelineEvent[], columnCount: number, rowDates: string[]} {
        if (!events || events.length === 0) {
            return { events: [], columnCount: 0, rowDates: [] };
        }
        
        //Collect all unique dates
        const allDates = new Set<string>();
        
        events.forEach(event => {
            if (event.beginDate) allDates.add(event.beginDate);
            if (event.endDate) allDates.add(event.endDate);
        });
        
        //Sort dates chronologically
        const rowDates = Array.from(allDates).sort((a, b) => 
            new Date(a).getTime() - new Date(b).getTime()
        );
        
        //Create a map of dates to row indices
        const dateToRowIndex = new Map<string, number>();
        rowDates.forEach((date, index) => {
            dateToRowIndex.set(date, index);
        });
        
        //Process events to assign columns
        const columns: TimelineEvent[][] = [];
        
        events.forEach(event => {
            if (!event.beginDate) return;
            
            const startRow = dateToRowIndex.get(event.beginDate);
            const endRow = event.endDate ? dateToRowIndex.get(event.endDate) : startRow;
            
            if (startRow === undefined || endRow === undefined) return;
            
            //Find a suitable column
            let columnIndex = 0;
            let placed = false;
            
            while (!placed) {
                if (!columns[columnIndex]) {
                    columns[columnIndex] = [];
                    placed = true;
                } else {
                    //Check if this column has space
                    let hasOverlap = false;
                    
                    for (const existingEvent of columns[columnIndex]) {
                        const existingStartRow = existingEvent.startRow;
                        const existingEndRow = existingEvent.endRow;
                        
                        if (existingStartRow === undefined || existingEndRow === undefined) continue;
                        
                        //Check for overlap
                        if (!(endRow < existingStartRow || startRow > existingEndRow)) {
                            hasOverlap = true;
                            break;
                        }
                    }
                    
                    if (!hasOverlap) {
                        placed = true;
                    } else {
                        columnIndex++;
                    }
                }
            }
            
            //Assign position data to event
            event.column = columnIndex;
            event.startRow = startRow;
            event.endRow = endRow;
            
            //Add to column
            columns[columnIndex].push(event);
        });
        
        return {
            events: events,
            columnCount: columns.length,
            rowDates: rowDates
        };
    }

    private openEventFile(event: TimelineEvent): void {
        if (!event.file) return;
        
        const file = this.app.vault.getAbstractFileByPath(event.file);
        if (file instanceof TFile) {
            this.app.workspace.getLeaf().openFile(file);
        } else {
            new Notice(`Could not find file: ${event.file}`);
        }
    }
}