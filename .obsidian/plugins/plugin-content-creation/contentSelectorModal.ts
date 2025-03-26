import { App, Modal, Setting } from 'obsidian';
import ContentCreatorPlugin from './main';
import * as templates from './template';
import { node, formatDisplayName } from './utils';

export class ContentSelectorModal extends Modal {
  plugin: ContentCreatorPlugin;

  constructor(app: App, plugin: ContentCreatorPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.addClass('content-selector-modal');
    contentEl.appendChild(node('h2', { 
      text: 'Select Content Type to Create',
      class: 'selector-title' 
    }));
    
    const optionsContainer = node('div', { class: 'content-options-container' });
    contentEl.appendChild(optionsContainer);
    
    Object.entries(templates.templates).forEach(([type]) => {
      const label = type.charAt(0).toUpperCase() + type.slice(1);

      const optionContainer = node('div', { class: 'content-option' });
      optionsContainer.appendChild(optionContainer);
      
      new Setting(optionContainer)
        .setName(label)
        .addButton(button => button
          .setButtonText('Create')
          .setCta()
          .onClick(() => {
            this.close();
            this.plugin.createNewContent(type);
          }));
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}