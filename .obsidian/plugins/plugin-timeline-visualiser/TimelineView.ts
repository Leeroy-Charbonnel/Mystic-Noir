import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import TimelineVisualizerPlugin, { TimelineEvent, TimelineData } from './main';
import { node, sortAndRemoveDuplicateDates } from 'utils';

export const VIEW_TYPE_TIMELINE = 'timeline-visualizer';

export class TimelineView extends ItemView {
    private plugin: TimelineVisualizerPlugin;
    public contentEl: HTMLElement;
    private timelineData: TimelineData | null = null;
    private filterControls: HTMLElement;
    private filterTypes: { [key: string]: boolean } = {
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
                    text: 'No timeline data available.'
                });
                timelineContent.appendChild(emptyEl);
                return;
            }
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
            if (this.filterTypes[type]) buttonClasses.push('is-active');

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
            text: 'Timeline Calendar View'
        });
        container.appendChild(calendarTitle);

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

        const processedEvents = this.processEventsForCalendar(sortedEvents);

        const calendarGrid = node('div', {
            class: 'calendar-grid',
            style: {
                'grid-template-columns': `auto repeat(${processedEvents.columnCount}, 1fr)`,
                'grid-template-rows': `repeat(${processedEvents.rowDates.length}, min-content)`,
            }
        });
        container.appendChild(calendarGrid);

        //Render date cells in first column
        for (let i = 0; i < processedEvents.rowDates.length; i++) {
            const dateCell = node('div', {
                class: 'calendar-date-cell',
                style: { 'grid-row': `${i + 1}` }
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

        processedEvents.events.forEach(event => {
            if (event.startRow === undefined || event.endRow === undefined || event.column === undefined) return;

            let bgColor = '';

            if (event.type === 'story') bgColor = this.plugin.settings.storyColor;
            else if (event.type === 'event') bgColor = this.plugin.settings.eventColor;
            else if (event.type === 'characterEvent') bgColor = this.plugin.settings.characterEventColor;
            else if (event.type === 'character') bgColor = this.plugin.settings.characterColor;

            const eventEl = node('div', {
                class: 'calendar-event',
                style: {
                    'grid-row': `${event.startRow + 1} / ${event.endRow + 1}`,
                    'grid-column': `${event.column + 2}`, // +2 instead of +1 to account for date column
                    'background-color': bgColor,
                }
            });

            //Create event content
            const eventHeader = node('div',
                {
                    class: 'event-header',
                    children: [
                        node('div', {
                            class: 'event-title',
                            text: event.title
                        }),
                        node('nav', {
                            class: 'event-date',
                            children:
                                event.beginDate === event.endDate ?
                                    [node('li', { text: event.beginDate!.toLocaleDateString() })]
                                    :
                                    [node('li', { text: event.beginDate!.toLocaleDateString() }),
                                    node('li', { text: event.endDate!.toLocaleDateString() })]
                        })
                    ]
                });


            const eventBody = node('div', {
                class: 'event-body',
                children: event.beginDate === event.endDate ? [] : [
                    node('p', { text: event.description.length  > 30 ? `${event.description.substring(0, 100)}...` : event.description })
                ]
            })

            const typeBadge = node('div', {
                class: 'event-type-badge',
                text: event.type
            });


            eventEl.appendChild(eventHeader);
            eventEl.appendChild(eventBody);
            eventEl.appendChild(typeBadge);

            calendarGrid.appendChild(eventEl);
        });
    }

    private processEventsForCalendar(events: TimelineEvent[]): { events: TimelineEvent[], columnCount: number, rowDates: Date[] } {

        let rowDates = sortAndRemoveDuplicateDates(events.reduce((state, value) => {
            if (value.beginDate) {
                state.push(value.beginDate);
            }
            if (value.endDate) {
                state.push(value.endDate);
            }
            return state;
        }, ([] as Date[])));

        function doEventsOverlap(event1: TimelineEvent, event2: TimelineEvent) {
            return event1.beginDate! <= event2.endDate! && event2.beginDate! <= event1.endDate!;
        }

        let eventColumns = new Map();
        let requiredColumns = 0;

        const sortedEvents = [...events].sort((a, b) => {
            return a.beginDate!.getTime() - b.beginDate!.getTime();
        });


        sortedEvents.forEach(event => {
            //Find the first available column for this event
            let column = 0;
            let columnFound = false;

            while (!columnFound) {
                let isColumnAvailable = true;

                //Check all events that have already been assigned to this column
                for (const [eventId, colIndex] of eventColumns.entries()) {
                    if (colIndex === column) {
                        const otherEvent = events.find(e => e.id === eventId);
                        if (otherEvent && doEventsOverlap(event, otherEvent)) {
                            isColumnAvailable = false;
                            break;
                        }
                    }
                }

                if (isColumnAvailable) {
                    columnFound = true;
                } else {
                    column++;
                }
            }

            eventColumns.set(event.id, column);

            if (column + 1 > requiredColumns) {
                requiredColumns = column + 1;
            }
        });

        //Add grid properties to each event
        events.forEach(event => {
            event.column = eventColumns.get(event.id) || 0;
            event.startRow = 0;
            event.endRow = 0;

            const startRowIndex = rowDates.findIndex(date => date.getTime() === event.beginDate!.getTime());
            event.startRow = startRowIndex !== -1 ? startRowIndex : 0;

            const endRowIndex = rowDates.findIndex(date => date.getTime() === event.endDate!.getTime());
            event.endRow = (endRowIndex !== -1 ? endRowIndex : rowDates.length) + 1;
        });
        return {
            events: events,
            columnCount: requiredColumns,
            rowDates: rowDates
        }
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