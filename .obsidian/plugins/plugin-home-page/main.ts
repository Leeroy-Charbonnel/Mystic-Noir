import { App, Plugin, PluginSettingTab, Setting, MarkdownView, TFile, Notice } from 'obsidian';

interface HomeStatsPluginSettings {
    insertLocation: string; // Where to insert stats (top, bottom)
    statsToShow: string[]; // Which stats to show
    refreshFrequency: number; // How often to refresh stats in minutes
}

const DEFAULT_SETTINGS: HomeStatsPluginSettings = {
    insertLocation: 'bottom',
    statsToShow: ['stories', 'characters', 'locations', 'items'],
    refreshFrequency: 60 // Refresh every hour by default
}

export default class HomeStatsPlugin extends Plugin {
    settings: HomeStatsPluginSettings;
    lastRefresh: number = 0;

    async onload() {
        await this.loadSettings();

        // Add a ribbon icon
        const ribbonIconEl = this.addRibbonIcon('bar-chart', 'Refresh Home Stats', (evt: MouseEvent) => {
            this.refreshHomeStats();
            new Notice('Home Stats refreshed');
        });
        ribbonIconEl.addClass('home-stats-ribbon-icon');

        // Add a command to refresh stats
        this.addCommand({
            id: 'refresh-home-stats',
            name: 'Refresh Home Stats',
            callback: () => {
                this.refreshHomeStats();
                new Notice('Home Stats refreshed');
            }
        });

        // Register settings tab
        this.addSettingTab(new HomeStatsSettingTab(this.app, this));

        // Register event to listen for file open
        this.registerEvent(
            this.app.workspace.on('file-open', (file) => {
                if (file && this.isHomePage(file)) {
                    // Check if enough time has passed since last refresh
                    const now = Date.now();
                    if (now - this.lastRefresh > this.settings.refreshFrequency * 60 * 1000) {
                        this.refreshHomeStats();
                        this.lastRefresh = now;
                    }
                }
            })
        );

        // If the home page is already open, refresh stats
        if (this.app.workspace.getActiveFile() && this.isHomePage(this.app.workspace.getActiveFile())) {
            this.refreshHomeStats();
            this.lastRefresh = Date.now();
        }
    }

    onunload() {
        console.log('Unloading Home Stats plugin');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // Check if the given file is the home page
    private isHomePage(file: TFile): boolean {
        return file.path === 'Home.md' || 
              (file.basename === 'Home' && file.extension === 'md');
    }

    // Main function to refresh stats
    async refreshHomeStats() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || !this.isHomePage(activeFile)) {
            return;
        }

        const stats = await this.generateStats();
        const statsHtml = this.formatStats(stats);
        
        this.updateHomePageContent(activeFile, statsHtml);
    }

    // Generate statistics from vault files
    private async generateStats(): Promise<Record<string, number>> {
        const stats: Record<string, number> = {
            stories: 0,
            characters: 0,
            locations: 0,
            items: 0,
            events: 0,
            deadCharacters: 0,
            injuredCharacters: 0,
            totalLinks: 0,
            totalTags: 0
        };

        const markdownFiles = this.app.vault.getMarkdownFiles();
        
        // Collect all tags for analysis
        const allTags = new Set<string>();
        
        for (const file of markdownFiles) {
            // Skip the home page itself
            if (this.isHomePage(file)) continue;
            
            const cache = this.app.metadataCache.getFileCache(file);
            
            if (cache) {
                // Count by tags in the file
                if (cache.tags) {
                    for (const tagObj of cache.tags) {
                        const tag = tagObj.tag.toLowerCase();
                        allTags.add(tag);
                        
                        if (tag === '#stories') stats.stories++;
                        else if (tag === '#characters') stats.characters++;
                        else if (tag === '#locations') stats.locations++;
                        else if (tag === '#items') stats.items++;
                        else if (tag === '#events') stats.events++;
                    }
                    
                    stats.totalTags += cache.tags.length;
                }
                
                // Count links
                if (cache.links) {
                    stats.totalLinks += cache.links.length;
                }
                
                // Check for dead/injured characters
                if (cache.frontmatter && cache.tags?.some(t => t.tag.toLowerCase() === '#characters')) {
                    try {
                        const data = cache.frontmatter.data;
                        if (data && typeof data === 'object') {
                            // Parse the data JSON if it's a string
                            const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
                            
                            // Check for character state
                            if (parsedData.template?.State?.Dead?.value === true) {
                                stats.deadCharacters++;
                            }
                            
                            if (parsedData.template?.State?.Injured?.value === true) {
                                stats.injuredCharacters++;
                            }
                        }
                    } catch (e) {
                        console.error("Error parsing frontmatter data:", e);
                    }
                }
            }
        }

        return stats;
    }

    // Format statistics as HTML
    private formatStats(stats: Record<string, number>): string {
        const currentDate = new Date().toLocaleDateString();
        
        let html = `<div class="home-stats-container">
            <h2>Vault Statistics</h2>
            <div class="home-stats-date">Last updated: ${currentDate}</div>
            <div class="home-stats-grid">`;
        
        // Core stats
        if (this.settings.statsToShow.includes('stories')) {
            html += this.createStatCard('Stories', stats.stories, '📚');
        }
        
        if (this.settings.statsToShow.includes('characters')) {
            html += this.createStatCard('Characters', stats.characters, '👤');
        }
        
        if (this.settings.statsToShow.includes('locations')) {
            html += this.createStatCard('Locations', stats.locations, '🏙️');
        }
        
        if (this.settings.statsToShow.includes('items')) {
            html += this.createStatCard('Items', stats.items, '🧰');
        }
        
        if (this.settings.statsToShow.includes('events')) {
            html += this.createStatCard('Events', stats.events, '📅');
        }
        
        html += `</div>`;
        
        // Character stats
        if (stats.characters > 0 && (this.settings.statsToShow.includes('deadCharacters') || this.settings.statsToShow.includes('injuredCharacters'))) {
            html += `<div class="home-stats-character-status">`;
            
            if (this.settings.statsToShow.includes('deadCharacters')) {
                const deadPercent = stats.characters > 0 ? Math.round((stats.deadCharacters / stats.characters) * 100) : 0;
                html += `<div class="home-stats-status-item">
                    <span class="home-stats-label">Dead Characters:</span>
                    <span class="home-stats-value">${stats.deadCharacters}</span>
                    <div class="home-stats-bar">
                        <div class="home-stats-bar-fill" style="width: ${deadPercent}%; background-color: #ff6b6b;"></div>
                    </div>
                    <span class="home-stats-percent">${deadPercent}%</span>
                </div>`;
            }
            
            if (this.settings.statsToShow.includes('injuredCharacters')) {
                const injuredPercent = stats.characters > 0 ? Math.round((stats.injuredCharacters / stats.characters) * 100) : 0;
                html += `<div class="home-stats-status-item">
                    <span class="home-stats-label">Injured Characters:</span>
                    <span class="home-stats-value">${stats.injuredCharacters}</span>
                    <div class="home-stats-bar">
                        <div class="home-stats-bar-fill" style="width: ${injuredPercent}%; background-color: #ffd166;"></div>
                    </div>
                    <span class="home-stats-percent">${injuredPercent}%</span>
                </div>`;
            }
            
            html += `</div>`;
        }
        
        // Connectivity stats
        if (this.settings.statsToShow.includes('totalLinks')) {
            const avgLinks = stats.totalLinks / (stats.stories + stats.characters + stats.locations + stats.items + stats.events);
            html += `<div class="home-stats-footer">
                <div class="home-stats-connectivity">
                    <div class="home-stats-link-count">Total Links: ${stats.totalLinks}</div>
                    <div class="home-stats-avg-links">Average Links per Item: ${avgLinks.toFixed(1)}</div>
                </div>
            </div>`;
        }
        
        html += `</div>`;
        
        return html;
    }
    
    private createStatCard(label: string, value: number, icon: string): string {
        return `<div class="home-stats-card">
            <div class="home-stats-icon">${icon}</div>
            <div class="home-stats-value">${value}</div>
            <div class="home-stats-label">${label}</div>
        </div>`;
    }

    // Update home page content with the stats
    private async updateHomePageContent(homeFile: TFile, statsHtml: string) {
        try {
            // Read the current content
            let content = await this.app.vault.read(homeFile);
            
            // Check if stats block already exists
            const statsBlockRegex = /<div class="home-stats-container">[\s\S]*?<\/div>/g;
            
            if (statsBlockRegex.test(content)) {
                // Replace existing stats block
                content = content.replace(statsBlockRegex, statsHtml);
            } else {
                // Add stats based on settings
                if (this.settings.insertLocation === 'top') {
                    content = statsHtml + '\n\n' + content;
                } else {
                    content = content + '\n\n' + statsHtml;
                }
            }
            
            // Save the updated content
            await this.app.vault.modify(homeFile, content);
            
        } catch (error) {
            console.error('Failed to update home page content:', error);
            new Notice('Failed to update Home Stats');
        }
    }
}

class HomeStatsSettingTab extends PluginSettingTab {
    plugin: HomeStatsPlugin;

    constructor(app: App, plugin: HomeStatsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h2', {text: 'Home Stats Settings'});

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

        const statsOptions = [
            {id: 'stories', name: 'Stories'},
            {id: 'characters', name: 'Characters'},
            {id: 'locations', name: 'Locations'},
            {id: 'items', name: 'Items'},
            {id: 'events', name: 'Events'},
            {id: 'deadCharacters', name: 'Dead Characters'},
            {id: 'injuredCharacters', name: 'Injured Characters'},
            {id: 'totalLinks', name: 'Total Links'}
        ];

        const statsSetting = new Setting(containerEl)
            .setName('Stats to Show')
            .setDesc('Select which statistics to display on your Home page');

        for (const option of statsOptions) {
            statsSetting.addToggle(toggle => toggle
                .setValue(this.plugin.settings.statsToShow.includes(option.id))
                .setTooltip(option.name)
                .onChange(async (value) => {
                    if (value && !this.plugin.settings.statsToShow.includes(option.id)) {
                        this.plugin.settings.statsToShow.push(option.id);
                    } else if (!value && this.plugin.settings.statsToShow.includes(option.id)) {
                        this.plugin.settings.statsToShow = this.plugin.settings.statsToShow.filter(id => id !== option.id);
                    }
                    await this.plugin.saveSettings();
                }))
                .addExtraButton(button => button
                    .setIcon(option.id)
                    .setTooltip(option.name));
        }

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
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('Reset to default (60 minutes)')
                .onClick(async () => {
                    this.plugin.settings.refreshFrequency = DEFAULT_SETTINGS.refreshFrequency;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        containerEl.createEl('h3', {text: 'Refresh Stats'});
        
        const buttonContainer = containerEl.createDiv('setting-item');
        const refreshButton = buttonContainer.createEl('button', {text: 'Refresh Stats Now'});
        refreshButton.addEventListener('click', () => {
            this.plugin.refreshHomeStats();
            new Notice('Home Stats refreshed');
        });
    }
}