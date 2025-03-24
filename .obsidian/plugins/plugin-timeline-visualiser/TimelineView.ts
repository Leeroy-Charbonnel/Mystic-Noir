import { ItemView, WorkspaceLeaf, TFile, setIcon } from 'obsidian';
import TimelineVisualizerPlugin, { TimelineData, TimelineEvent } from './main';
import { hexToHSL, hslToString, node } from './utils';

export const VIEW_TYPE_TIMELINE = 'timeline-visualizer';

export class TimelineView extends ItemView {
    private plugin: TimelineVisualizerPlugin;
    public contentEl: HTMLElement;
    private calendarEl: HTMLElement;
    private activeFilters: Set<string> = new Set(['story', 'event', 'character', 'characterEvent']);
    private activeStory: string | null = null;
    private storyDropdown: HTMLSelectElement | null = null;

    private showDates = true;
    private showDescriptions = true;
    private showTags = true;


    constructor(leaf: WorkspaceLeaf, plugin: TimelineVisualizerPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.contentEl = node('div', { class: 'timeline-visualizer-container' });
    }

    getViewType(): string {
        return VIEW_TYPE_TIMELINE;
    }

    getDisplayText(): string {
        return 'Timeline Visualizer';
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();
        container.appendChild(this.contentEl);
        this.renderTimeline();
    }

    async onClose(): Promise<void> {
        this.contentEl.empty();
    }

    refresh(): void {
        this.renderTimeline();
    }

    private async renderTimeline(): Promise<void> {
        this.contentEl.empty();

        const headerEl = node('div', { class: 'timeline-header' });

        headerEl.appendChild(node('h3', { text: 'Timeline Visualizer' }));

        //Refresh button
        const refreshButton = node('button', { class: 'timeline-refresh-button', text: 'Refresh' });
        refreshButton.addEventListener('click', () => this.refresh());
        headerEl.appendChild(refreshButton);

        this.contentEl.appendChild(headerEl);

        //Filters
        const filtersEl = node('div', { class: 'timeline-filters' });

        const eventTypeFilterEl = node('div', { class: 'filter-section' });
        eventTypeFilterEl.appendChild(node('span', { text: 'Show: ' }));

        const createFilterButton = (type: string, label: string) => {
            const button = node('button', {
                class: `filter-button ${this.activeFilters.has(type) ? 'is-active' : ''}`,
                text: label
            });

            button.addEventListener('click', () => {
                if (this.activeFilters.has(type)) {
                    this.activeFilters.delete(type);
                    button.classList.remove('is-active');
                } else {
                    this.activeFilters.add(type);
                    button.classList.add('is-active');
                }
                this.renderCalendar();
            });

            return button;
        };

        eventTypeFilterEl.appendChild(createFilterButton('story', 'Stories'));
        eventTypeFilterEl.appendChild(createFilterButton('event', 'Events'));
        eventTypeFilterEl.appendChild(createFilterButton('character', 'Characters'));
        eventTypeFilterEl.appendChild(createFilterButton('characterEvent', 'Character Events'));
        filtersEl.appendChild(eventTypeFilterEl);

        //View options
        const viewOptionsEl = node('div', { class: 'filter-section' });
        viewOptionsEl.appendChild(node('span', { text: 'View: ' }));

        const standardViewButton = node('button', {
            class: 'filter-button ' + (this.activeStory === null ? 'is-active' : ''),
            text: 'All Events'
        });
        standardViewButton.addEventListener('click', () => {
            this.activeStory = null;
            if (this.storyDropdown) this.storyDropdown.value = '';
            this.renderCalendar();

            standardViewButton.classList.add('is-active');
            storyCentricButton.classList.remove('is-active');
        });

        const storyCentricButton = node('button', {
            class: 'filter-button ' + (this.activeStory !== null ? 'is-active' : ''),
            text: 'Story-Centric'
        });

        storyCentricButton.addEventListener('click', () => {
            if (!this.storyDropdown) return;

            if (this.storyDropdown.value) {
                this.activeStory = this.storyDropdown.value;
                this.renderCalendar();

                standardViewButton.classList.remove('is-active');
                storyCentricButton.classList.add('is-active');
            } else {
                const storyDropdownContainer = this.storyDropdown.parentElement;
                const notification = document.createElement('span');
                notification.textContent = 'Please select a story first';
                notification.style.color = 'var(--text-error)';
                notification.style.marginLeft = '10px';
                notification.style.fontSize = '12px';

                storyDropdownContainer?.appendChild(notification);

                setTimeout(() => {
                    storyDropdownContainer?.removeChild(notification);
                }, 3000);
            }
        });





        const displaySection = node('div', { class: 'display-controls-section' });
        const showDatesButton = node('button', {
            class: this.showDates ? 'filter-button is-active' : 'filter-button',
            text: 'Show Dates'
        });
        showDatesButton.addEventListener('click', () => {
            this.showDates = !this.showDates;
            showDatesButton.classList.toggle('is-active');
            this.refresh();
        });
        const showDescriptionsButton = node('button', {
            class: this.showDescriptions ? 'filter-button is-active' : 'filter-button',
            text: 'Show Descriptions'
        });
        showDescriptionsButton.addEventListener('click', () => {
            this.showDescriptions = !this.showDescriptions;
            showDescriptionsButton.classList.toggle('is-active');
            this.refresh();
        });

        const showTagsButton = node('button', {
            class: this.showTags ? 'filter-button is-active' : 'filter-button',
            text: 'Show Tags'
        })
        showTagsButton.addEventListener('click', () => {
            this.showTags = !this.showTags;
            showTagsButton.classList.toggle('is-active');
            this.refresh();
        })

        displaySection.appendChild(showDatesButton);
        displaySection.appendChild(showDescriptionsButton);
        displaySection.appendChild(showTagsButton);


        viewOptionsEl.appendChild(standardViewButton);
        viewOptionsEl.appendChild(displaySection);
        viewOptionsEl.appendChild(storyCentricButton);

        filtersEl.appendChild(viewOptionsEl);




        //Story dropdown
        const storySelectEl = node('div', { class: 'filter-section' });
        storySelectEl.appendChild(node('span', { text: 'Story: ' }));

        this.storyDropdown = document.createElement('select');
        this.storyDropdown.className = 'story-select-dropdown';

        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.text = '-- Select a story --';
        placeholderOption.selected = true;
        this.storyDropdown.appendChild(placeholderOption);

        const timelineData = await this.plugin.getTimelineData();

        const storyEvents = timelineData.events.filter(event => event.type === 'story');
        storyEvents.forEach(story => {
            const option = document.createElement('option');
            option.value = story.id;
            option.text = story.title;
            if (this.activeStory === story.id) {
                option.selected = true;
            }
            if (this.storyDropdown)
                this.storyDropdown.appendChild(option);
        });

        this.storyDropdown.addEventListener('change', () => {
            this.activeStory = this.storyDropdown?.value || null;
            if (this.activeStory) {
                standardViewButton.classList.remove('is-active');
                storyCentricButton.classList.add('is-active');
            } else {
                standardViewButton.classList.add('is-active');
                storyCentricButton.classList.remove('is-active');
            }
            this.renderCalendar();
        });

        storySelectEl.appendChild(this.storyDropdown);
        filtersEl.appendChild(storySelectEl);

        this.contentEl.appendChild(filtersEl);

        this.calendarEl = node('div', { class: 'timeline-content' });
        this.contentEl.appendChild(this.calendarEl);

        await this.renderCalendar();
    }

    private async renderCalendar(): Promise<void> {
        this.calendarEl.empty();

        this.calendarEl.appendChild(node('div', {
            class: 'timeline-loading',
            text: 'Loading timeline data...'
        }));

        try {
            let timelineData = await this.plugin.getTimelineData();

            if (this.activeFilters.size > 0) {
                timelineData.events = timelineData.events.filter(event =>
                    this.activeFilters.has(event.type)
                );
            }

            if (this.activeStory) {
                const storyConnections = timelineData.connections.filter(
                    conn => conn.from === this.activeStory || conn.to === this.activeStory
                );

                const relatedEventIds = new Set<string>();
                relatedEventIds.add(this.activeStory);

                storyConnections.forEach(conn => {
                    relatedEventIds.add(conn.from);
                    relatedEventIds.add(conn.to);
                });

                timelineData.events = timelineData.events.filter(event =>
                    relatedEventIds.has(event.id) ||
                    (event.type === 'characterEvent' && relatedEventIds.has(event.file))
                );
            }

            this.calendarEl.empty();

            if (timelineData.events.length === 0) {
                this.calendarEl.appendChild(node('div', {
                    class: 'timeline-empty',
                    text: 'No events found with the current filters.'
                }));
                return;
            }

            this.renderCalendarGrid(timelineData);
        } catch (error) {
            console.error('Error rendering timeline:', error);
            this.calendarEl.empty();
            this.calendarEl.appendChild(node('div', {
                class: 'timeline-error',
                text: 'Error loading timeline data. Check the console for details.'
            }));
        }
    }

    private renderCalendarGrid(timelineData: TimelineData): void {
        //Remove events without dates
        const events = timelineData.events.filter(
            event => event.beginDate !== null
        );

        if (events.length === 0) {
            this.calendarEl.appendChild(node('div', {
                class: 'timeline-empty',
                text: 'No events with valid dates found.'
            }));
            return;
        }

        //Sort events by begin date
        events.sort((a, b) => {
            if (!a.beginDate || !b.beginDate) return 0;
            return a.beginDate.getTime() - b.beginDate.getTime();
        });

        //Get all unique dates for rows
        let allDates: Date[] = [];
        events.forEach(event => {
            if (event.beginDate) allDates.push(event.beginDate);
            if (event.endDate) allDates.push(event.endDate);
        });

        //Remove duplicates and sort
        const uniqueDatesMap = new Map<number, Date>();
        allDates.forEach(date => {
            const year = date.getFullYear();
            const month = date.getMonth();
            const key = year * 100 + month;
            if (!uniqueDatesMap.has(key)) {
                uniqueDatesMap.set(key, new Date(year, month, 1));
            }
        });

        const rowDates = Array.from(uniqueDatesMap.values())
            .sort((a, b) => a.getTime() - b.getTime());

        //Assign grid positions to events
        const columns: TimelineEvent[][] = [];

        events.forEach(event => {
            //Find first available column
            let columnIndex = 0;
            let placed = false;

            while (!placed) {
                if (!columns[columnIndex]) {
                    columns[columnIndex] = [];
                }

                //Check if current event can be placed in this column
                const canPlace = !columns[columnIndex].some(existingEvent =>
                    this.eventsOverlap(event, existingEvent)
                );

                if (canPlace) {
                    columns[columnIndex].push(event);
                    event.column = columnIndex + 1;
                    placed = true;
                } else {
                    columnIndex++;
                }
            }
        });

        const columnCount = columns.length + 1; //+1 for date column

        events.forEach(event => {
            if (!event.beginDate) return;

            //Find start row
            const startRowIndex = rowDates.findIndex(date =>
                date.getFullYear() === event.beginDate!.getFullYear() &&
                date.getMonth() === event.beginDate!.getMonth()
            );

            //Find end row
            let endRowIndex = startRowIndex;
            if (event.endDate) {
                endRowIndex = rowDates.findIndex(date =>
                    date.getFullYear() === event.endDate!.getFullYear() &&
                    date.getMonth() === event.endDate!.getMonth()
                );
            }

            //Assign grid positions
            event.startRow = startRowIndex + 1; // +1 for header row
            event.endRow = endRowIndex + 1; // +1 for header row
        });

        //Create grid container
        const gridContainer = node('div', { class: 'calendar-grid' });
        gridContainer.style.gridTemplateColumns = `min-content repeat(${columnCount - 1}, minmax(0, 1fr))`;
        gridContainer.style.gridTemplateRows = `repeat(${rowDates.length + 1}, auto)`;

        //Add date rows
        rowDates.forEach((date, index) => {
            const rowIndex = index + 1; // +1 for header row

            const dateCell = node('div', {
                class: 'calendar-date-cell',
                text: `${date.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                })}`
            });

            dateCell.style.gridRow = `${rowIndex}`;
            dateCell.style.gridColumn = '1';

            gridContainer.appendChild(dateCell);
        });

        const titleArray = [] as HTMLElement[];
        events.forEach(event => {
            if (!event.startRow || !event.endRow || !event.column) return;

            const eventEl = node('div', { class: 'calendar-event' });
            eventEl.style.gridColumnStart = `${event.column + 1}`; //+1 for date column
            eventEl.style.gridRowStart = `${event.startRow}`;
            eventEl.style.gridRowEnd = `${event.endRow + 1}`;

            let bgColor = { h: 0, s: 0, l: 0 };

            switch (event.type) {
                case 'story':
                    bgColor = hexToHSL(this.plugin.settings.storyColor);
                    break;
                case 'event':
                    bgColor = hexToHSL(this.plugin.settings.eventColor);
                    break;
                case 'character':
                    bgColor = hexToHSL(this.plugin.settings.characterColor);
                    break;
                case 'characterEvent':
                    bgColor = hexToHSL(this.plugin.settings.characterEventColor);
                    break;
            }

            eventEl.style.setProperty('--background-color', hslToString(bgColor));
            eventEl.style.setProperty('--background-darker-color', hslToString({ ...bgColor, l: bgColor.l * 0.5 }));
            eventEl.style.setProperty('--border-color', hslToString(bgColor));



            //Title
            const titleEl = node('div', { class: 'event-title', text: event.title });
            eventEl.appendChild(titleEl);
            titleEl.addEventListener('click', () => {
                const file = this.app.vault.getAbstractFileByPath(event.file);
                if (file && file instanceof TFile) {
                    this.app.workspace.getLeaf().openFile(file);
                }
            });
            titleArray.push(titleEl);

            //Add date
            if (this.showDates && event.beginDate) {
                const dateEl = node('div', {
                    class: 'event-date',
                    children:
                        event.beginDate === event.endDate ?
                            [node('li', { text: event.beginDate!.toLocaleDateString() })]
                            :
                            [node('li', { text: event.beginDate!.toLocaleDateString() }),
                            node('li', { text: event.endDate!.toLocaleDateString() })]
                });
                eventEl.appendChild(dateEl);
            }


            //Add description
            if (this.showDescriptions && event.description) {
                const eventBody = node('div', {
                    class: 'event-description',
                    text: event.description
                });
                eventEl.appendChild(eventBody);
            }

            //Add badge
            if (this.showTags) {
                const badgeEl = node('span', {
                    class: 'event-type-badge',
                    text: event.type === 'characterEvent' ? 'char event' : event.type
                });
                eventEl.appendChild(badgeEl);
            }

            gridContainer.appendChild(eventEl);
        });


        this.calendarEl.addEventListener('scroll', () => {
            titleArray.forEach(titleEl => {
                const isScrolled = titleEl.offsetTop > 10;
                titleEl.classList.toggle('isSticky', isScrolled);
            });
        });

        this.calendarEl.appendChild(gridContainer);
    }

    private eventsOverlap(eventA: TimelineEvent, eventB: TimelineEvent): boolean {
        if (!eventA.beginDate || !eventB.beginDate) return false;

        const aStart = eventA.beginDate.getTime();
        const aEnd = eventA.endDate ? eventA.endDate.getTime() : aStart;

        const bStart = eventB.beginDate.getTime();
        const bEnd = eventB.endDate ? eventB.endDate.getTime() : bStart;

        return aStart <= bEnd && bStart <= aEnd;
    }
}