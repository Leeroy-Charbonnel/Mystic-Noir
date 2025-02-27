import { App, Modal, Setting } from 'obsidian';
import ContentCreatorPlugin from './main';
import { TEMPLATES } from './template';

export class ContentSelectorModal extends Modal {
  plugin: ContentCreatorPlugin;

  constructor(app: App, plugin: ContentCreatorPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Select Content Type to Create' });
    
    // Create options for each template type
    const contentTypes = {
      characters: 'Character',
      items: 'Item',
      locations: 'Location',
      stories:"Story",
      events: 'Event'
    };
    
    // Generate a button for each content type
    Object.entries(contentTypes).forEach(([type, label]) => {
      if (TEMPLATES[type]) {
        new Setting(contentEl)
          .setName(label)
          .setDesc(`Create a new ${label.toLowerCase()}`)
          .addButton(button => button
            .setButtonText('Create')
            .setCta()
            .onClick(() => {
              this.close();
              this.plugin.openFormForContentType(type);
            }));
      }
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}