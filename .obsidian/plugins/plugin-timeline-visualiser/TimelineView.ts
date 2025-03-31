import { ItemView, WorkspaceLeaf, TFile, setIcon } from 'obsidian';
import TimelineVisualizerPlugin, { TimelineData, TimelineEvent } from './main';
import { hexToHSL, hslToString, node } from './utils';
import { title } from 'process';

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

        const timelineControlsEl = node('div', { class: 'timeline-controls' });


        //Filters
        const eventTypeFilterEl = node('div', { class: 'filter-section' });

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

        const FilterButtons: { [key: string]: HTMLButtonElement } = {};

        FilterButtons.story = createFilterButton('story', 'Stories');
        FilterButtons.event = createFilterButton('event', 'Events');
        FilterButtons.character = createFilterButton('character', 'Characters');
        FilterButtons.characterEvent = createFilterButton('characterEvent', 'Character Events');



        for (const [key, btn] of Object.entries(FilterButtons)) {
            eventTypeFilterEl.appendChild(btn);

            let bgColor = this.getEventColor(key)
            btn.style.setProperty('--background-color', hslToString(bgColor));
            btn.style.setProperty('--background-darker-color', hslToString({ ...bgColor, l: bgColor.l * 0.5 }));
        }


        //View options
        const viewOptionsEl = node('div', { class: 'view-section' });

        const standardViewButton = node('button', {
            class: 'control-button ' + (this.activeStory === null ? 'is-active' : ''),
            text: 'All Events'
        });
        standardViewButton.addEventListener('click', () => {
            this.activeStory = null;
            if (this.storyDropdown) this.storyDropdown.value = '';
            standardViewButton.classList.add('is-active');
            this.renderCalendar();
        });


        //Story dropdown
        const storySelectEl = node('div');
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
            } else {
                standardViewButton.classList.add('is-active');
            }
            this.renderCalendar();
        });

        storySelectEl.appendChild(this.storyDropdown);

        viewOptionsEl.appendChild(standardViewButton);
        viewOptionsEl.appendChild(storySelectEl);


        //Display
        const displaySectionEl = node('div', { class: 'display-section' });

        const showDatesButton = node('button', {
            class: this.showDates ? 'control-button is-active' : 'control-button',
            text: 'Show Dates'
        });
        showDatesButton.addEventListener('click', () => {
            this.showDates = !this.showDates;
            showDatesButton.classList.toggle('is-active');
            this.refresh();
        });
        const showDescriptionsButton = node('button', {
            class: this.showDescriptions ? 'control-button is-active' : 'control-button',
            text: 'Show Descriptions'
        });
        showDescriptionsButton.addEventListener('click', () => {
            this.showDescriptions = !this.showDescriptions;
            showDescriptionsButton.classList.toggle('is-active');
            this.refresh();
        });

        const showTagsButton = node('button', {
            class: this.showTags ? 'control-button is-active' : 'control-button',
            text: 'Show Tags'
        })
        showTagsButton.addEventListener('click', () => {
            this.showTags = !this.showTags;
            showTagsButton.classList.toggle('is-active');
            this.refresh();
        })

        displaySectionEl.appendChild(showDatesButton);
        displaySectionEl.appendChild(showDescriptionsButton);
        displaySectionEl.appendChild(showTagsButton);


        timelineControlsEl.appendChild(viewOptionsEl);
        timelineControlsEl.appendChild(displaySectionEl);
        timelineControlsEl.appendChild(eventTypeFilterEl);

        this.contentEl.appendChild(timelineControlsEl);

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

        const rowDates = Array.from(uniqueDatesMap.values()).sort((a, b) => a.getTime() - b.getTime());


        // console.log(uniqueDatesMap);
        // console.log(rowDates);
        // console.log(events);

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


            const bgColor = this.getEventColor(event.type);
            eventEl.style.setProperty('--background-color', hslToString(bgColor));
            eventEl.style.setProperty('--background-darker-color', hslToString({ ...bgColor, l: bgColor.l * 0.5 }));
            eventEl.style.setProperty('--border-color', hslToString(bgColor));



            //Title
            const titleEl = node('div', { class: 'event-title', text: event.title, attributes: { title: event.title } });
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
                const elapsedTime = this.getElapsedTimeString(event.beginDate, event.endDate!);

                const dateEl = node('div', { class: 'event-date' });
                const dateText = `${event.beginDate.toLocaleDateString()} - ${event.endDate!.toLocaleDateString()}`;


                if (elapsedTime) dateEl.appendChild(node('li', { class: 'elapsed-time', text: elapsedTime, attributes: { title: dateText } }));
                dateEl.appendChild(node('li', { class: 'date', text: event.beginDate!.toLocaleDateString() }));


                if (event.endDate && event.beginDate.getTime() != event.endDate.getTime()) {
                    if (elapsedTime) dateEl.appendChild(node('br', { class: 'elapsed-time' }));
                    dateEl.appendChild(node('li', { class: 'date', text: event.endDate!.toLocaleDateString() }));
                }

                eventEl.appendChild(dateEl);
            }


            //Add description
            if (this.showDescriptions && event.description) {
                const eventDescription = node('div', {
                    class: 'event-description',
                    text: event.description,
                });
                eventDescription.style.webkitLineClamp = ((event.endRow - event.startRow) + 1).toString();
                eventEl.appendChild(eventDescription);
            }
            //Add badge
            if (this.showTags) {
                const badgeEl = node('span', {
                    class: 'event-type-badge',
                    text: event.type === 'characterEvent' ? 'char event' : event.type
                });
                eventEl.appendChild(badgeEl);
            }



            //Story button
            eventEl.dataset.type = event.type;

            if (event.type === 'story' && this.activeStory !== event.id) {
                const storyCentricBtn = node('button', {
                    class: 'story-centric-button',
                    text: 'Focus'
                });

                storyCentricBtn.addEventListener('click', (e) => {
                    e.stopPropagation();

                    this.activeStory = event.id;
                    this.refresh();

                    if (this.storyDropdown)
                        this.storyDropdown.value = event.id;
                });
                eventEl.appendChild(storyCentricBtn);

            }




            gridContainer.appendChild(eventEl);
        });




        this.calendarEl.addEventListener('scroll', () => {
            titleArray.forEach(titleEl => {
                const isScrolled = titleEl.offsetTop > 12;
                titleEl.classList.toggle('isSticky', isScrolled);
            });
        });

        this.calendarEl.appendChild(gridContainer);
    }

    private getEventColor(eventType: string): { h: number, s: number, l: number } {
        let bgColor = { h: 0, s: 0, l: 0 };
        switch (eventType) {
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
        return bgColor;
    }

    private getElapsedTimeString(startDate: Date, endDate: Date): string {
        const diffMs = endDate.getTime() - startDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Same day';
        if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'}`;

        const diffMonths = Math.floor(diffDays / 30);
        if (diffMonths <= 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'}`;
        const diffYears = Math.floor(diffDays / 365);
        return `${diffYears} year${diffYears === 1 ? '' : 's'}`;
    }

    private eventsOverlap(eventA: TimelineEvent, eventB: TimelineEvent): boolean {
        if (!eventA.beginDate || !eventB.beginDate) return false;

        const aStart = eventA.beginDate;
        const aEnd = eventA.endDate;

        const bStart = eventB.beginDate;
        const bEnd = eventB.endDate;

        return aStart <= bEnd! && bStart <= aEnd!;
    }
}


























