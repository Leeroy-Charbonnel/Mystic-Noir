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
    private async generateStats(): Promise<{ counts: Record<string, number>, details: Record<string, any[]> }> {
        const stats: Record<string, number> = {
            stories: 0,
            characters: 0,
            locations: 0,
            items: 0,
            events: 0,
            deadCharacters: 0,
            injuredCharacters: 0,
            totalLinks: 0,
            totalTags: 0,
            // Additional indicators
            storyWords: 0,
            averageStoryLength: 0,
            charactersWithLinks: 0,
            locationsUsed: 0,
            itemsUsed: 0
        };
        
        // Details of each type for expanded view
        const details: Record<string, any[]> = {
            characters: [],
            stories: [],
            locations: [],
            items: [],
            events: []
        };

        const markdownFiles = this.app.vault.getMarkdownFiles();
        
        // Collect all tags for analysis
        const allTags = new Set<string>();
        
        // Track which items are linked to
        const linkedItems = new Set<string>();
        
        for (const file of markdownFiles) {
            // Skip the home page itself
            if (this.isHomePage(file)) continue;
            
            const cache = this.app.metadataCache.getFileCache(file);
            const fileContent = await this.app.vault.read(file);
            
            if (cache) {
                // Count by tags in the file
                if (cache.tags) {
                    for (const tagObj of cache.tags) {
                        const tag = tagObj.tag.toLowerCase();
                        allTags.add(tag);
                        
                        if (tag === '#stories') {
                            stats.stories++;
                            stats.storyWords += fileContent.split(/\s+/).length;
                            
                            // Add to details with additional story info
                            details.stories.push({
                                name: file.basename,
                                path: file.path,
                                words: fileContent.split(/\s+/).length,
                                characters: cache.links?.filter(link => 
                                    link.displayText.includes("Character") || 
                                    this.isCharacter(link.link)).length || 0
                            });
                        }
                        else if (tag === '#characters') {
                            stats.characters++;
                            
                            // Get character name from frontmatter or filename
                            let characterName = file.basename;
                            let occupation = "";
                            let state = "Alive";
                            
                            if (cache.frontmatter && cache.frontmatter.data) {
                                try {
                                    const data = typeof cache.frontmatter.data === 'string' 
                                        ? JSON.parse(cache.frontmatter.data) 
                                        : cache.frontmatter.data;
                                    
                                    if (data.template?.BasicInformation?.FullName?.value) {
                                        characterName = this.cleanHtml(data.template.BasicInformation.FullName.value);
                                    }
                                    
                                    if (data.template?.BasicInformation?.Occupation?.value) {
                                        occupation = this.cleanHtml(data.template.BasicInformation.Occupation.value);
                                    }
                                    
                                    if (data.template?.State?.Dead?.value === true) {
                                        state = "Dead";
                                        stats.deadCharacters++;
                                    } else if (data.template?.State?.Injured?.value === true) {
                                        state = "Injured";
                                        stats.injuredCharacters++;
                                    }
                                } catch (e) {
                                    console.error("Error parsing character data:", e);
                                }
                            }
                            
                            // Add to character details
                            details.characters.push({
                                name: characterName,
                                path: file.path,
                                occupation: occupation,
                                state: state
                            });
                        }
                        else if (tag === '#locations') {
                            stats.locations++;
                            
                            // Add to location details
                            let locationName = file.basename;
                            let description = "";
                            
                            if (cache.frontmatter && cache.frontmatter.data) {
                                try {
                                    const data = typeof cache.frontmatter.data === 'string' 
                                        ? JSON.parse(cache.frontmatter.data) 
                                        : cache.frontmatter.data;
                                    
                                    if (data.template?.BasicInformation?.Name?.value) {
                                        locationName = this.cleanHtml(data.template.BasicInformation.Name.value);
                                    }
                                    
                                    if (data.template?.BasicInformation?.location?.value) {
                                        description = this.cleanHtml(data.template.BasicInformation.location.value);
                                    }
                                } catch (e) {
                                    console.error("Error parsing location data:", e);
                                }
                            }
                            
                            details.locations.push({
                                name: locationName,
                                path: file.path,
                                description: description
                            });
                        }
                        else if (tag === '#items') {
                            stats.items++;
                            
                            // Add to item details
                            let itemName = file.basename;
                            let description = "";
                            
                            if (cache.frontmatter && cache.frontmatter.data) {
                                try {
                                    const data = typeof cache.frontmatter.data === 'string' 
                                        ? JSON.parse(cache.frontmatter.data) 
                                        : cache.frontmatter.data;
                                    
                                    if (data.template?.BasicInformation?.Name?.value) {
                                        itemName = this.cleanHtml(data.template.BasicInformation.Name.value);
                                    }
                                    
                                    if (data.template?.BasicInformation?.Description?.value) {
                                        description = this.cleanHtml(data.template.BasicInformation.Description.value).substring(0, 100) + "...";
                                    }
                                } catch (e) {
                                    console.error("Error parsing item data:", e);
                                }
                            }
                            
                            details.items.push({
                                name: itemName,
                                path: file.path,
                                description: description
                            });
                        }
                        else if (tag === '#events') {
                            stats.events++;
                            
                            // Add to event details
                            let eventName = file.basename;
                            let date = "";
                            
                            if (cache.frontmatter && cache.frontmatter.data) {
                                try {
                                    const data = typeof cache.frontmatter.data === 'string' 
                                        ? JSON.parse(cache.frontmatter.data) 
                                        : cache.frontmatter.data;
                                    
                                    if (data.template?.BasicInformation?.Name?.value) {
                                        eventName = this.cleanHtml(data.template.BasicInformation.Name.value);
                                    }
                                    
                                    if (data.template?.BasicInformation?.Date?.value) {
                                        date = this.cleanHtml(data.template.BasicInformation.Date.value);
                                    }
                                } catch (e) {
                                    console.error("Error parsing event data:", e);
                                }
                            }
                            
                            details.events.push({
                                name: eventName,
                                path: file.path,
                                date: date
                            });
                        }
                    }
                    
                    stats.totalTags += cache.tags.length;
                }
                
                // Process links to track used items, locations, and characters
                if (cache.links) {
                    stats.totalLinks += cache.links.length;
                    
                    // Record which items are linked to
                    for (const link of cache.links) {
                        linkedItems.add(link.link);
                    }
                }
            }
        }

        // Calculate derived statistics
        stats.averageStoryLength = stats.stories > 0 ? Math.round(stats.storyWords / stats.stories) : 0;
        
        // Count characters that appear in stories (via links)
        stats.charactersWithLinks = details.characters.filter(char => 
            linkedItems.has(char.path.replace('.md', '')) || 
            linkedItems.has(char.name)
        ).length;
        
        // Count locations used in stories
        stats.locationsUsed = details.locations.filter(loc => 
            linkedItems.has(loc.path.replace('.md', '')) || 
            linkedItems.has(loc.name)
        ).length;
        
        // Count items used in stories
        stats.itemsUsed = details.items.filter(item => 
            linkedItems.has(item.path.replace('.md', '')) || 
            linkedItems.has(item.name)
        ).length;

        return { counts: stats, details: details };
    }
    
    // Helper function to check if a link points to a character
    private isCharacter(link: string): boolean {
        // Check if the link is in the Characters folder or has specific patterns
        return link.includes("Characters/") || 
               link.includes("characters/") || 
               this.app.metadataCache.getFirstLinkpathDest(link, "")?.path.includes("Characters");
    }
    
    // Helper function to clean HTML from text (for displaying names)
    private cleanHtml(text: string): string {
        if (!text) return "";
        return text.replace(/<\/?[^>]+(>|$)/g, "").trim();
    }

    // Format statistics as HTML
    private formatStats(statsData: { counts: Record<string, number>, details: Record<string, any[]> }): string {
        const stats = statsData.counts;
        const details = statsData.details;
        const currentDate = new Date().toLocaleDateString();
        const currentTime = new Date().toLocaleTimeString();
        
        let html = `<div class="home-stats-container">
            <h2>Vault Statistics</h2>
            <div class="home-stats-date">Last updated: ${currentDate} ${currentTime}</div>
            <div class="home-stats-grid">`;
        
        // Core stats with expanded details
        if (this.settings.statsToShow.includes('stories')) {
            html += this.createStatCard('Stories', stats.stories, '📚', 'stories-details');
        }
        
        if (this.settings.statsToShow.includes('characters')) {
            html += this.createStatCard('Characters', stats.characters, '👤', 'characters-details');
        }
        
        if (this.settings.statsToShow.includes('locations')) {
            html += this.createStatCard('Locations', stats.locations, '🏙️', 'locations-details');
        }
        
        if (this.settings.statsToShow.includes('items')) {
            html += this.createStatCard('Items', stats.items, '🧰', 'items-details');
        }
        
        if (this.settings.statsToShow.includes('events')) {
            html += this.createStatCard('Events', stats.events, '📅', 'events-details');
        }
        
        html += `</div>`;
        
        // Additional derived stats
        html += `<div class="home-stats-advanced-metrics">
            <h3>Advanced Metrics</h3>
            <div class="home-stats-metrics-grid">`;
            
        if (this.settings.statsToShow.includes('storyMetrics')) {
            html += `<div class="home-stats-metric">
                <div class="home-stats-metric-value">${stats.averageStoryLength.toLocaleString()}</div>
                <div class="home-stats-metric-label">Words per Story</div>
            </div>`;
            
            html += `<div class="home-stats-metric">
                <div class="home-stats-metric-value">${stats.storyWords.toLocaleString()}</div>
                <div class="home-stats-metric-label">Total Words</div>
            </div>`;
        }
        
        if (this.settings.statsToShow.includes('characterUsage')) {
            const characterUsagePercent = stats.characters > 0 
                ? Math.round((stats.charactersWithLinks / stats.characters) * 100) 
                : 0;
            
            html += `<div class="home-stats-metric">
                <div class="home-stats-metric-value">${stats.charactersWithLinks}/${stats.characters}</div>
                <div class="home-stats-metric-label">Used Characters</div>
                <div class="home-stats-mini-bar">
                    <div class="home-stats-mini-bar-fill" style="width: ${characterUsagePercent}%"></div>
                </div>
            </div>`;
        }
        
        if (this.settings.statsToShow.includes('locationUsage')) {
            const locationUsagePercent = stats.locations > 0 
                ? Math.round((stats.locationsUsed / stats.locations) * 100) 
                : 0;
            
            html += `<div class="home-stats-metric">
                <div class="home-stats-metric-value">${stats.locationsUsed}/${stats.locations}</div>
                <div class="home-stats-metric-label">Used Locations</div>
                <div class="home-stats-mini-bar">
                    <div class="home-stats-mini-bar-fill" style="width: ${locationUsagePercent}%"></div>
                </div>
            </div>`;
        }
        
        if (this.settings.statsToShow.includes('itemUsage')) {
            const itemUsagePercent = stats.items > 0 
                ? Math.round((stats.itemsUsed / stats.items) * 100) 
                : 0;
            
            html += `<div class="home-stats-metric">
                <div class="home-stats-metric-value">${stats.itemsUsed}/${stats.items}</div>
                <div class="home-stats-metric-label">Used Items</div>
                <div class="home-stats-mini-bar">
                    <div class="home-stats-mini-bar-fill" style="width: ${itemUsagePercent}%"></div>
                </div>
            </div>`;
        }
        
        html += `</div></div>`;
        
        // Character stats
        if (stats.characters > 0 && (this.settings.statsToShow.includes('deadCharacters') || this.settings.statsToShow.includes('injuredCharacters'))) {
            html += `<div class="home-stats-character-status">
                <h3>Character Status</h3>`;
            
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
        
        // Detailed expandable sections
        if (this.settings.statsToShow.includes('characterDetails')) {
            html += this.createExpandableSection('characters-details', 'Character Details', details.characters, item => 
                `<div class="home-stats-detail-item">
                    <div class="home-stats-detail-name">
                        <a href="${item.path}" class="internal-link">${item.name}</a>
                        ${item.state === 'Dead' ? '<span class="home-stats-state-badge dead">Dead</span>' : 
                         item.state === 'Injured' ? '<span class="home-stats-state-badge injured">Injured</span>' : ''}
                    </div>
                    <div class="home-stats-detail-meta">${item.occupation || 'No occupation'}</div>
                </div>`
            );
        }
        
        if (this.settings.statsToShow.includes('storyDetails')) {
            html += this.createExpandableSection('stories-details', 'Story Details', details.stories, item => 
                `<div class="home-stats-detail-item">
                    <div class="home-stats-detail-name">
                        <a href="${item.path}" class="internal-link">${item.name}</a>
                    </div>
                    <div class="home-stats-detail-meta">
                        ${item.words.toLocaleString()} words • ${item.characters} character${item.characters !== 1 ? 's' : ''}
                    </div>
                </div>`
            );
        }
        
        if (this.settings.statsToShow.includes('locationDetails')) {
            html += this.createExpandableSection('locations-details', 'Location Details', details.locations, item => 
                `<div class="home-stats-detail-item">
                    <div class="home-stats-detail-name">
                        <a href="${item.path}" class="internal-link">${item.name}</a>
                    </div>
                    <div class="home-stats-detail-meta">${item.description || 'No description'}</div>
                </div>`
            );
        }
        
        if (this.settings.statsToShow.includes('itemDetails')) {
            html += this.createExpandableSection('items-details', 'Item Details', details.items, item => 
                `<div class="home-stats-detail-item">
                    <div class="home-stats-detail-name">
                        <a href="${item.path}" class="internal-link">${item.name}</a>
                    </div>
                    <div class="home-stats-detail-meta">${item.description || 'No description'}</div>
                </div>`
            );
        }
        
        if (this.settings.statsToShow.includes('eventDetails')) {
            html += this.createExpandableSection('events-details', 'Event Details', details.events, item => 
                `<div class="home-stats-detail-item">
                    <div class="home-stats-detail-name">
                        <a href="${item.path}" class="internal-link">${item.name}</a>
                    </div>
                    <div class="home-stats-detail-meta">${item.date || 'No date'}</div>
                </div>`
            );
        }
        
        html += `</div>`;
        
        return html;
    }
    
    // Create an expandable section for details
    private createExpandableSection(id: string, title: string, items: any[], itemFormatter: (item: any) => string): string {
        if (!items || items.length === 0) return '';
        
        return `
        <div class="home-stats-details-section" id="${id}">
            <div class="home-stats-details-header">${title} (${items.length})</div>
            <div class="home-stats-details-content">
                ${items.map(itemFormatter).join('')}
            </div>
        </div>`;
    }
    
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
            
            // First check if the content contains the #Home tag
            if (!content.includes('#Home')) {
                new Notice('The Home page does not have the #Home tag. Stats not added.');
                return;
            }
            
            // Clear the home page content except for the #Home tag if setting is enabled
            if (this.settings.clearHomePageOnRefresh) {
                // Keep only the #Home tag and any YAML frontmatter
                const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n/);
                const front
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