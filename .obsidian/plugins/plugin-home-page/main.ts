import { App, Plugin, PluginSettingTab, Setting, MarkdownView, TFile, Notice } from 'obsidian';
import { statsKeys, node, convertLinks } from "./utils"

export default class HomeStatsPlugin extends Plugin {
    lastRefresh: number = 0;

    async onload() {

        const ribbonIconEl = this.addRibbonIcon('bar-chart', 'Refresh Home Stats', (evt: MouseEvent) => { this.refreshHomeStats(); });
        ribbonIconEl.addClass('home-stats-ribbon-icon');

        this.addCommand({
            id: 'refresh-home-stats',
            name: 'Home Stats',
            callback: () => { this.refreshHomeStats(); }
        });

        this.registerEvent(
            this.app.workspace.on('file-open', (file) => {
                if (file && this.isHomePage(file)) {
                    const now = Date.now();
                    this.refreshHomeStats();
                    this.lastRefresh = now;
                }
            })
        );
    }

    onunload() {
        console.log('Unloading Home Stats plugin');
    }


    private isHomePage(file: TFile): boolean {
        return file.path === 'Home.md';
    }

    async refreshHomeStats() {
        console.log('Refreshing Home Stats');
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || !this.isHomePage(activeFile)) {
            return;
        }

        const stats = await this.generateStats();
        const statsHtml = this.formatStats(stats);

        this.updateHomePageContent(activeFile, statsHtml);
    }

    private async generateStats(): Promise<{ stats: Record<string, number>, details: Record<string, any[]> }> {

        const stats: Record<string, number> = {
            unlinkedFiles: 0,
            totalLinks: 0,
            totalWords: 0
        };

        const details: Record<string, any[]> = {
            unlinkedFiles: [],
            recentlyUpdatedFiles: []
        };

        statsKeys.forEach((stat: string) => {
            stats[stat] = 0;
            details[stat] = [];
        });

        const markdownFiles = this.app.vault.getMarkdownFiles();

        for (const file of markdownFiles) {
            if (this.isHomePage(file)) continue;
            const cache = this.app.metadataCache.getFileCache(file);
            const fileContent = await this.app.vault.read(file);
            const fileWordscount = fileContent.split(/\s+/).length;
            stats.totalWords += fileWordscount;



            if (cache) {
                if (cache.links)
                    stats.totalLinks += cache.links.length;

                if (cache.tags) {
                    for (const tagObj of cache.tags) {
                        const tag = tagObj.tag.toLowerCase().slice(1);

                        if (statsKeys.includes(tag)) {
                            stats[tag]++;

                            if (cache.frontmatter && cache.frontmatter.data) {
                                const data = cache.frontmatter.data;

                                if (tag == "characters") {
                                    let name = file.basename;
                                    let note = "Unknown";
                                    let state = "Alive";

                                    if (data.template?.BasicInformation?.FullName?.value)
                                        name = this.cleanHtml(data.template.BasicInformation.FullName.value);

                                    if (data.template?.BasicInformation?.Occupation?.value)
                                        note = this.cleanHtml(data.template.BasicInformation.Occupation.value);

                                    if (data.template?.State.Dead?.value === true) {
                                        state = "Dead";
                                    } else if (data.template?.State.Injured?.value === true) {
                                        state = "Injured";
                                    }

                                    details.characters.push({
                                        name: name,
                                        path: file.path,
                                        note: note,
                                        state: state
                                    });
                                }

                                if (tag == "stories") {
                                    details.stories.push({
                                        name: file.basename,
                                        path: file.path,
                                        note: `${fileWordscount} words`
                                    });
                                }


                                if (tag == "locations") {
                                    let name = file.basename;
                                    let note = "No description";

                                    if (data.template?.BasicInformation?.Name?.value)
                                        name = this.cleanHtml(data.template.BasicInformation.Name.value);

                                    if (data.template?.BasicInformation?.location?.value)
                                        note = this.cleanHtml(data.template.BasicInformation.location.value);

                                    details.locations.push({
                                        name: name,
                                        path: file.path,
                                        note: note
                                    });
                                }

                                if (tag == "items") {
                                    let name = file.basename;
                                    let note = "No description";

                                    if (data.template?.BasicInformation?.Name?.value)
                                        name = this.cleanHtml(data.template.BasicInformation.Name.value);

                                    if (data.template?.BasicInformation?.Description?.value)
                                        note = this.cleanHtml(data.template.BasicInformation.Description.value).substring(0, 50) + "...";

                                    details.items.push({
                                        name: name,
                                        path: file.path,
                                        note: note
                                    });
                                }


                                if (tag == "events") {
                                    let name = file.basename;
                                    let note = "No date specified";

                                    if (cache.frontmatter && cache.frontmatter.data) {
                                        if (data.template?.BasicInformation?.Name?.value)
                                            name = this.cleanHtml(data.template.BasicInformation.Name.value);

                                        if (data.template?.BasicInformation?.Date?.value)
                                            note = this.cleanHtml(data.template.BasicInformation.Date.value);
                                    }
                                    details.events.push({
                                        name: name,
                                        path: file.path,
                                        note: note
                                    });
                                }
                            }
                        }
                    }
                }



            }

            if (!cache || !cache.links || cache.links.length === 0) {
                stats.unlinkedFiles++;
                details.unlinkedFiles.push({
                    name: file.basename,
                    path: file.path
                });
            }
        }

        return { stats, details };
    }

    private cleanHtml(text: string): string {
        if (!text) return "";
        return text.replace(/<\/?[^>]+(>|$)/g, "").trim();
    }



    private formatStats(statsData: { stats: Record<string, number>, details: Record<string, any[]> }): string {
        const stats = statsData.stats;
        const details = statsData.details;
        const currentDate = new Date().toLocaleDateString();
        const currentTime = new Date().toLocaleTimeString();

        //Main container
        const statsContainer = node('div', { class: 'home-stats-container' });

        //Header
        statsContainer.appendChild(node('h2', { text: 'Mystic Noir' }));
        statsContainer.appendChild(node('div', {
            class: 'home-stats-date',
            text: `Last updated: ${currentDate} ${currentTime}`
        }));

        const statsGrid = node('div', {
            class: 'home-stats-grid',
            children: [
                this.createStatCardNode('Stories', stats.stories, '📚'),
                this.createStatCardNode('Characters', stats.characters, '🎭'),
                this.createStatCardNode('Locations', stats.locations, '🧭'),
                this.createStatCardNode('Items', stats.items, '🧰'),
                this.createStatCardNode('Events', stats.events, '📅'),
            ]
        });

        const advancedMetrics = node('div', { class: 'home-stats-advanced-metrics' });
        advancedMetrics.appendChild(node('h3', { text: 'Advanced' }));
        const metricsGrid = node('div', { class: 'home-stats-metrics-grid' });

        const advancedMetricsToShow = [
            { key: 'totalWords', label: 'Total Words' },
            { key: 'totalLinks', label: 'Total Links' },
            { key: 'unlinkedFiles', label: 'Unlinked Files' }
        ];

        advancedMetricsToShow.forEach(metric => {
            const metricEl = node('div', { class: 'home-stats-metric' });
            const value = stats[metric.key];

            metricEl.appendChild(node('div', {
                class: 'home-stats-metric-value',
                text: value.toString()
            }));

            metricEl.appendChild(node('div', {
                class: 'home-stats-metric-label',
                text: metric.label
            }));

            metricsGrid.appendChild(metricEl);
        });

        statsContainer.appendChild(statsGrid);
        statsContainer.appendChild(advancedMetrics);
        advancedMetrics.appendChild(metricsGrid);

        this.addDetailSections(statsContainer, details);
        return statsContainer.outerHTML;
    }

    private createStatCardNode(label: string, value: number, icon: string): HTMLElement {
        const card = node('div', { class: 'home-stats-card has-details' });
        card.appendChild(node('div', { class: 'home-stats-icon', text: icon }));
        card.appendChild(node('div', { class: 'home-stats-value', text: value.toString() }));
        card.appendChild(node('div', { class: 'home-stats-label', text: label }));
        return card;
    }

    private addDetailSections(container: HTMLElement, details: Record<string, any[]>): void {
        container.appendChild(this.createDetailSection('Characters', details.characters,
            item => {
                const itemEl = node('div', { class: 'home-stats-detail-item' });
                const nameEl = node('div', { class: 'home-stats-detail-name' });
                nameEl.appendChild(node('a', {
                    text: item.name,
                    attributes: {
                        'href': item.path,
                        'class': 'internal-link'
                    }
                }));

                if (item.state === 'Dead') {
                    nameEl.appendChild(node('span', {
                        text: 'Dead',
                        class: 'home-stats-state-badge dead'
                    }));
                } else if (item.state === 'Injured') {
                    nameEl.appendChild(node('span', {
                        text: 'Injured',
                        class: 'home-stats-state-badge injured'
                    }));
                }

                itemEl.appendChild(nameEl);
                itemEl.appendChild(node('div', {
                    class: 'home-stats-detail-meta',
                    text: item.note
                }));

                return itemEl;
            }
        ));

        container.appendChild(this.createDetailSection('Stories', details.stories));
        container.appendChild(this.createDetailSection('Locations', details.locations));
        container.appendChild(this.createDetailSection('Items', details.items));
        container.appendChild(this.createDetailSection('Events', details.events));
    }

    private createDetailSection(title: string, items: any[], itemFormatter?: (item: any) => HTMLElement): HTMLElement {
        if (!items || items.length === 0) return document.createElement('div');

        const section = node('div', {
            class: 'home-stats-details-section',
            attributes: { 'id': title.toLowerCase().replace(/ /g, '-') }
        });

        section.appendChild(node('div', {
            class: 'home-stats-details-header',
            text: `${title} (${items.length})`
        }));

        const content = node('div', { class: 'home-stats-details-content' });
        section.appendChild(content);


        if (!itemFormatter) {
            itemFormatter = (item) => {
                const metaDiv = node('div', { class: 'home-stats-detail-meta' });
                metaDiv.innerHTML = convertLinks(item.note);
                const itemEl = node('div', {
                    class: 'home-stats-detail-item',
                    children: [
                        node('div', {
                            class: 'home-stats-detail-name', children: [
                                node('a', { text: item.name, attributes: { 'href': item.path, 'class': 'internal-link' } })
                            ]
                        }),
                        metaDiv
                    ]
                });
                return itemEl;
            }
        }

        items.forEach(item => {
            content.appendChild(itemFormatter(item));
        });

        return section;
    }

    private async updateHomePageContent(homeFile: TFile, statsHtml: string) {
        try {
            await this.app.vault.modify(homeFile, statsHtml);
        } catch (error) {
            console.error('Error updating home page:', error);
            new Notice('Failed to update home page stats');
        }
    }
}

