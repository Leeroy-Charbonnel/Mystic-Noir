import { App, Plugin, PluginSettingTab, Setting, MarkdownView, TFile, Notice } from 'obsidian';


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

        // if (this.app.workspace.getActiveFile() && this.isHomePage(this.app.workspace.getActiveFile())) {
        //     this.refreshHomeStats();
        //     this.lastRefresh = Date.now();
        // }
    }

    onunload() {
        console.log('Unloading Home Stats plugin');
    }


    private isHomePage(file: TFile): boolean {
        return file.path === 'Home.md';
    }

    // Main function to refresh stats
    async refreshHomeStats() {
        console.log('Refreshing Home Stats');
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || !this.isHomePage(activeFile)) {
            return;
        }

        const stats = await this.generateStats();
        console.log(stats)
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

        statsKey.forEach(stat => {
            stats[stat] = 0;
            details[stat] = [];
        });

        const now = Date.now();
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

                        if (statsKey.includes(tag)) {
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
                                        note: fileWordscount
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
                                        note = this.cleanHtml(data.template.BasicInformation.Description.value).substring(0, 100);

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

    // Format statistics as HTML
    private formatStats(statsData: { stats: Record<string, number>, details: Record<string, any[]> }): string {
        const stats = statsData.stats;
        const details = statsData.details;
        const currentDate = new Date().toLocaleDateString();
        const currentTime = new Date().toLocaleTimeString();

        let html = `<div class="home-stats-container">
            <h2>Vault Statistics</h2>
            <div class="home-stats-date">Last updated: ${currentDate} ${currentTime}</div>
            <div class="home-stats-grid">`;

        html += this.createStatCard('Stories', stats.stories, '📚', 'stories-details');
        html += this.createStatCard('Characters', stats.characters, '👤', 'characters-details');
        html += this.createStatCard('Locations', stats.locations, '🏙️', 'locations-details');
        html += this.createStatCard('Items', stats.items, '🧰', 'items-details');
        html += this.createStatCard('Events', stats.events, '📅', 'events-details');

        html += `</div>`;

        // Advanced metrics
        html += `<div class="home-stats-advanced-metrics">
            <h3>Advanced Metrics</h3>
            <div class="home-stats-metrics-grid">
                <div class="home-stats-metric">
                    <div class="home-stats-metric-value">${stats.totalWords.toLocaleString()}</div>
                    <div class="home-stats-metric-label">Total Words</div>
                </div>
                <div class="home-stats-metric">
                    <div class="home-stats-metric-value">${stats.totalLinks}</div>
                    <div class="home-stats-metric-label">Total Links</div>
                </div>
                <div class="home-stats-metric">
                    <div class="home-stats-metric-value">${stats.recentlyUpdatedFiles}</div>
                    <div class="home-stats-metric-label">Recently Updated</div>
                </div>
                <div class="home-stats-metric">
                    <div class="home-stats-metric-value">${stats.unlinkedFiles}</div>
                    <div class="home-stats-metric-label">Unlinked Files</div>
                </div>
            </div>
        </div>`;

        // Detailed expandable sections
        html += this.createDetailSection('Characters', details.characters,
            item => `<div class="home-stats-detail-item">
                <div class="home-stats-detail-name">
                    <a href="${item.path}" class="internal-link">${item.name}</a>
                    ${item.state === 'Dead' ? '<span class="home-stats-state-badge dead">Dead</span>' :
                    item.state === 'Injured' ? '<span class="home-stats-state-badge injured">Injured</span>' : ''}
                </div>
                <div class="home-stats-detail-meta">${item.occupation}</div>
            </div>`
        );

        html += this.createDetailSection('Stories', details.stories,
            item => `<div class="home-stats-detail-item">
                <div class="home-stats-detail-name">
                    <a href="${item.path}" class="internal-link">${item.name}</a>
                </div>
                <div class="home-stats-detail-meta">
                    ${item.characters} character${item.characters !== 1 ? 's' : ''} referenced
                </div>
            </div>`
        );

        html += this.createDetailSection('Locations', details.locations,
            item => `<div class="home-stats-detail-item">
                <div class="home-stats-detail-name">
                    <a href="${item.path}" class="internal-link">${item.name}</a>
                </div>
                <div class="home-stats-detail-meta">${item.description}</div>
            </div>`
        );

        html += this.createDetailSection('Items', details.items,
            item => `<div class="home-stats-detail-item">
                <div class="home-stats-detail-name">
                    <a href="${item.path}" class="internal-link">${item.name}</a>
                </div>
                <div class="home-stats-detail-meta">${item.description}</div>
            </div>`
        );

        html += this.createDetailSection('Recently Updated', details.recentlyUpdatedFiles,
            item => `<div class="home-stats-detail-item">
                <div class="home-stats-detail-name">
                    <a href="${item.path}" class="internal-link">${item.name}</a>
                </div>
                <div class="home-stats-detail-meta">Updated: ${item.modifiedDate}</div>
            </div>`
        );

        html += this.createDetailSection('Unlinked Files', details.unlinkedFiles,
            item => `<div class="home-stats-detail-item">
                <div class="home-stats-detail-name">
                    <a href="${item.path}" class="internal-link">${item.name}</a>
                </div>
            </div>`
        );

        html += `</div>`;

        return html;
    }

    // Create a detailed section for specific type of details
    private createDetailSection(title: string, items: any[], itemFormatter: (item: any) => string): string {
        if (!items || items.length === 0) return '';

        return `
        <div class="home-stats-details-section">
            <div class="home-stats-details-header">${title} (${items.length})</div>
            <div class="home-stats-details-content">
                ${items.map(itemFormatter).join('')}
            </div>
        </div>`;
    }

    // Create a stat card with optional details
    private createStatCard(label: string, value: number, icon: string, detailsId?: string): string {
        return `<div class="home-stats-card ${detailsId ? 'has-details' : ''}" ${detailsId ? `data-details="${detailsId}"` : ''}>
            <div class="home-stats-icon">${icon}</div>
            <div class="home-stats-value">${value}</div>
            <div class="home-stats-label">${label}</div>
            ${detailsId ? `<div class="home-stats-expand-icon">↓</div>` : ''}
        </div>`;
    }

    // Update home page content with the stats
    private async updateHomePageContent(homeFile: TFile, statsHtml: string) {
        try {
            // Read the current content
            let content = await this.app.vault.read(homeFile);

            // Check if the content contains the #Home tag
            if (!content.includes('#Home')) {
                new Notice('The Home page does not have the #Home tag. Stats not added.');
                return;
            }

            // If setting is enabled, clear the home page content
            if (this.settings.clearHomePageOnRefresh) {
                // Keep only the #Home tag and any YAML frontmatter
                const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n/);
                const frontmatterContent = frontmatterMatch ? frontmatterMatch[0] : '';

                content = frontmatterContent + '#Home\n\n' + statsHtml;
            } else {
                // Append stats to the existing content
                if (this.settings.insertLocation === 'top') {
                    content = content.includes('#Home')
                        ? content.replace('#Home', '#Home\n\n' + statsHtml)
                        : statsHtml + '\n\n' + content;
                } else {
                    // Bottom insertion
                    content += '\n\n' + statsHtml;
                }
            }

            // Modify the file
            await this.app.vault.modify(homeFile, content);
        } catch (error) {
            console.error('Error updating home page:', error);
            new Notice('Failed to update home page stats');
        }
    }
}

// Settings Tab
class HomeStatsSettingTab extends PluginSettingTab {
    plugin: HomeStatsPlugin;

    constructor(app: App, plugin: HomeStatsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Home Stats Settings' });

        // Insert Location Setting
        new Setting(containerEl)
            .setName('Insert Location')
            .setDesc('Where to insert the stats on the Home page')
            .addDropdown(dropdown => dropdown
                .addOption('top', 'Top of page')
                .addOption('bottom', 'Bottom of page')
                .setValue(this.plugin.settings.insertLocation)
                .onChange(async (value) => {
                    this.plugin.settings.insertLocation = value;
                    await this.plugin.saveSettings();
                }));

        // Clear Home Page Setting
        new Setting(containerEl)
            .setName('Clear Home Page')
            .setDesc('Clear the home page content before inserting stats')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.clearHomePageOnRefresh)
                .onChange(async (value) => {
                    this.plugin.settings.clearHomePageOnRefresh = value;
                    await this.plugin.saveSettings();
                }));

        // Stats to Show
        const statsOptions = [
            { id: 'stories', name: 'Stories' },
            { id: 'characters', name: 'Characters' },
            { id: 'locations', name: 'Locations' },
            { id: 'items', name: 'Items' },
            { id: 'events', name: 'Events' },
            { id: 'detailedStats', name: 'Detailed Stats' }
        ];

        const statsSetting = new Setting(containerEl)
            .setName('Stats to Show')
            .setDesc('Select which statistics to display on your Home page');

        statsOptions.forEach(option => {
            statsSetting.addToggle(toggle => toggle
                .setValue(this.plugin.settings.statsToShow.includes(option.id))
                .setTooltip(option.name)
                .onChange(async (value) => {
                    if (value && !this.plugin.settings.statsToShow.includes(option.id)) {
                        this.plugin.settings.statsToShow.push(option.id);
                    } else if (!value) {
                        this.plugin.settings.statsToShow = this.plugin.settings.statsToShow.filter(id => id !== option.id);
                    }
                    await this.plugin.saveSettings();
                }));
        });

        // Refresh Frequency
        new Setting(containerEl)
            .setName('Refresh Frequency')
            .setDesc('How often to refresh stats (in minutes) when opening the Home page')
            .addSlider(slider => slider
                .setLimits(5, 1440, 5)
                .setValue(this.plugin.settings.refreshFrequency)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.refreshFrequency = value;
                    await this.plugin.saveSettings();
                })
            );

        // Refresh Button
        const refreshContainer = containerEl.createDiv('setting-item');
        const refreshButton = refreshContainer.createEl('button', { text: 'Refresh Stats Now' });
        refreshButton.addEventListener('click', () => {
            this.plugin.refreshHomeStats();
            new Notice('Home Stats refreshed');
        });
    }
}