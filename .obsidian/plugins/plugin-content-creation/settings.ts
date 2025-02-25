import { App, PluginSettingTab, Setting } from 'obsidian';
import ContentCreatorPlugin from './main';

export class CreatorSettingTab extends PluginSettingTab {
  plugin: ContentCreatorPlugin;

  constructor(app: App, plugin: ContentCreatorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Content Creator Settings' });

    // Characters folder setting
    new Setting(containerEl)
      .setName('Characters Folder')
      .setDesc('The folder where new character files will be created')
      .addText(text => text
        .setPlaceholder('1. Characters')
        .setValue(this.plugin.settings.defaultFolders.characters)
        .onChange(async (value) => {
          this.plugin.settings.defaultFolders.characters = value;
          await this.plugin.saveSettings();
        }));

    // Items folder setting
    new Setting(containerEl)
      .setName('Items Folder')
      .setDesc('The folder where new item files will be created')
      .addText(text => text
        .setPlaceholder('2. Items')
        .setValue(this.plugin.settings.defaultFolders.items)
        .onChange(async (value) => {
          this.plugin.settings.defaultFolders.items = value;
          await this.plugin.saveSettings();
        }));

    // Locations folder setting
    new Setting(containerEl)
      .setName('Locations Folder')
      .setDesc('The folder where new location files will be created')
      .addText(text => text
        .setPlaceholder('3. Locations')
        .setValue(this.plugin.settings.defaultFolders.locations)
        .onChange(async (value) => {
          this.plugin.settings.defaultFolders.locations = value;
          await this.plugin.saveSettings();
        }));

    // Events folder setting
    new Setting(containerEl)
      .setName('Events Folder')
      .setDesc('The folder where new event files will be created')
      .addText(text => text
        .setPlaceholder('5. Evenements')
        .setValue(this.plugin.settings.defaultFolders.events)
        .onChange(async (value) => {
          this.plugin.settings.defaultFolders.events = value;
          await this.plugin.saveSettings();
        }));

    // Filename template setting
    new Setting(containerEl)
      .setName('Filename Template')
      .setDesc('Template for filenames. Use {{name}} as a placeholder for the content name')
      .addText(text => text
        .setPlaceholder('{{name}}')
        .setValue(this.plugin.settings.fileNameTemplate)
        .onChange(async (value) => {
          this.plugin.settings.fileNameTemplate = value || '{{name}}';
          await this.plugin.saveSettings();
        }));
  }
}