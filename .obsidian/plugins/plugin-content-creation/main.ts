import { App, Plugin, PluginSettingTab, Setting, TFile, Modal, Notice } from 'obsidian';
import { ContentSelectorModal } from './contentSelectorModal';
import { DynamicFormModal } from './dynamicFormModal';
import { TEMPLATES } from './template';

interface ContentCreatorSettings {
  defaultFolders: {
    characters: string;
    items: string;
    events: string;
    locations: string;
  };
  fileNameTemplate: string;
}

const DEFAULT_SETTINGS: ContentCreatorSettings = {
  defaultFolders: {
    characters: '1. Characters',
    items: '2. Items',
    events: '5. Evenements',
    locations: '3. Locations'
  },
  fileNameTemplate: '{{name}}'
};

export default class ContentCreatorPlugin extends Plugin {
  settings: ContentCreatorSettings;

  async onload() {
    await this.loadSettings();

    console.log(`Loading ${this.manifest.name} plugin v${this.manifest.version}`);

    // Add ribbon icon
    this.addRibbonIcon('file-plus', 'Create Content', () => {
      new ContentSelectorModal(this.app, this).open();
    });

    // Add commands for each content type
    this.addCommand({
      id: 'create-character',
      name: 'Create Character',
      callback: () => {
        this.openFormForContentType('characters');
      }
    });

    this.addCommand({
      id: 'create-item',
      name: 'Create Item',
      callback: () => {
        this.openFormForContentType('items');
      }
    });

    this.addCommand({
      id: 'create-event',
      name: 'Create Event',
      callback: () => {
        this.openFormForContentType('events');
      }
    });

    this.addCommand({
      id: 'create-location',
      name: 'Create Location',
      callback: () => {
        this.openFormForContentType('locations');
      }
    });

    // Add settings tab
    this.addSettingTab(new CreatorSettingTab(this.app, this));
  }

  onunload() {
    console.log(`Unloading ${this.manifest.name} plugin`);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  openFormForContentType(contentType: string) {
    if (TEMPLATES[contentType]) {
      new DynamicFormModal(this.app, this, contentType).open();
    } else {
      new Notice(`Unknown content type: ${contentType}`);
    }
  }

  async createContent(contentType: string, data: any) {
    try {
      // Determine folder path based on content type
      const folderPath = this.settings.defaultFolders[contentType];
      
      // Create folder if it doesn't exist
      if (!await this.app.vault.adapter.exists(folderPath)) {
        await this.app.vault.createFolder(folderPath);
      }
      
      // Get the name field based on content type
      let name = '';
      if (contentType === 'characters') {
        name = data.BasicInformation.FullName;
      } else {
        name = data.BasicInformation.Name;
      }
      
      if (!name) {
        new Notice('Content name is required');
        return false;
      }
      
      // Generate filename
      let filename = this.settings.fileNameTemplate.replace('{{name}}', name);
      
      // Create file path
      const filePath = `${folderPath}/${filename}.md`;
      
      // Check if file already exists
      if (await this.app.vault.adapter.exists(filePath)) {
        const userConfirmed = confirm(`File "${filename}.md" already exists. Do you want to overwrite it?`);
        if (!userConfirmed) {
          return false;
        }
      }
      
      // Generate content based on content type and data
      let content = this.generateContentFromData(contentType, data);
      
      // Create or update file
      const existingFile = this.app.vault.getAbstractFileByPath(filePath);
      if (existingFile instanceof TFile) {
        await this.app.vault.modify(existingFile, content);
      } else {
        await this.app.vault.create(filePath, content);
      }
      
      // Open the newly created file
      const newFile = this.app.vault.getAbstractFileByPath(filePath);
      if (newFile instanceof TFile) {
        await this.app.workspace.getLeaf().openFile(newFile);
      }
      
      return true;
    } catch (error) {
      console.error('Error creating content:', error);
      new Notice(`Error creating content: ${error.message}`);
      return false;
    }
  }

  private generateContentFromData(contentType: string, data: any): string {
    switch (contentType) {
      case 'characters':
        return this.generateCharacterContent(data);
      case 'items':
        return this.generateItemContent(data);
      case 'events':
        return this.generateEventContent(data);
      case 'locations':
        return this.generateLocationContent(data);
      default:
        throw new Error(`Unknown content type: ${contentType}`);
    }
  }

  private generateCharacterContent(data: any): string {
    let content = `#Character\n\n`;
    
    // Basic Information
    content += `### Basic Information\n`;
    if (data.BasicInformation.FullName) content += `- **Full Name:** ${data.BasicInformation.FullName}  \n`;
    if (data.BasicInformation.Age) content += `- **Age:** ${data.BasicInformation.Age}  \n`;
    if (data.BasicInformation.Occupation) content += `- **Occupation:** ${data.BasicInformation.Occupation}  \n`;
    if (data.BasicInformation.Background) content += `- **Background:** ${data.BasicInformation.Background}  \n`;
    
    // Appearance
    content += `\n### Appearance\n`;
    if (data.Appearance.Height) content += `- **Height:** ${data.Appearance.Height}  \n`;
    if (data.Appearance.Build) content += `- **Build:** ${data.Appearance.Build}  \n`;
    if (data.Appearance.Hair) content += `- **Hair:** ${data.Appearance.Hair}  \n`;
    if (data.Appearance.Eyes) content += `- **Eyes:** ${data.Appearance.Eyes}  \n`;
    if (data.Appearance.ClothingStyle) content += `- **Clothing Style:** ${data.Appearance.ClothingStyle}  \n`;
    if (data.Appearance.DefiningFeatures) content += `- **Defining Features:** ${data.Appearance.DefiningFeatures}  \n`;

    // Personality
    content += `\n### Personality\n`;
    if (data.Personality.GeneralTraits) content += `- **General Traits:** ${data.Personality.GeneralTraits}  \n`;
    
    if (data.Personality.Strengths && data.Personality.Strengths.length > 0) {
      content += `- **Strengths:** ${data.Personality.Strengths.join(', ')}  \n`;
    }
    
    if (data.Personality.Weaknesses && data.Personality.Weaknesses.length > 0) {
      content += `- **Weaknesses:** ${data.Personality.Weaknesses.join(', ')}  \n`;
    }
    
    if (data.Personality.HabitsAndQuirks && data.Personality.HabitsAndQuirks.length > 0) {
      content += `- **Habits & Quirks:** ${data.Personality.HabitsAndQuirks.join(', ')}  \n`;
    }

    // Relationships
    content += `\n### Relationships\n`;
    
    if (data.Relationships.Family && data.Relationships.Family.length > 0) {
      content += `- **Family:** ${data.Relationships.Family.map(name => `[[${name}]]`).join(', ')}  \n`;
    }
    
    if (data.Relationships.FriendsAndAllies && data.Relationships.FriendsAndAllies.length > 0) {
      content += `- **Friends & Allies:** ${data.Relationships.FriendsAndAllies.map(name => `[[${name}]]`).join(', ')}  \n`;
    }
    
    if (data.Relationships.EnemiesAndRivals && data.Relationships.EnemiesAndRivals.length > 0) {
      content += `- **Enemies & Rivals:** ${data.Relationships.EnemiesAndRivals.map(name => `[[${name}]]`).join(', ')}  \n`;
    }
    
    if (data.Relationships.RomanticInterests && data.Relationships.RomanticInterests.length > 0) {
      content += `- **Romantic Interests:** ${data.Relationships.RomanticInterests.map(name => `[[${name}]]`).join(', ')}  \n`;
    }

    // Belongings
    content += `\n### Belongings\n`;
    if (data.Belongings && data.Belongings.length > 0) {
      data.Belongings.forEach(item => {
        content += `- [[${item}]]\n`;
      });
    }

    // Additional Notes
    if (data.AdditionalNotes) {
      content += `\n### Additional Notes\n${data.AdditionalNotes}\n`;
    }

    return content;
  }

  private generateItemContent(data: any): string {
    let content = `#Item \n\n`;
    
    // Basic Information
    content += `### Basic Information\n`;
    if (data.BasicInformation.Name) content += `- **Name:** ${data.BasicInformation.Name}\n`;
    if (data.BasicInformation.Owner) content += `- **Owner:** [[${data.BasicInformation.Owner}]]\n`;
    if (data.BasicInformation.Description) content += `- **Description:** ${data.BasicInformation.Description}\n`;
    if (data.BasicInformation.Value) content += `- **Value:** ${data.BasicInformation.Value}\n`;
    
    // History
    content += `\n### History\n`;
    if (data.History.Origin) content += `- **Origin:** ${data.History.Origin}\n`;
    if (data.History.Age) content += `- **Age:** ${data.History.Age}\n`;
    
    if (data.History.PreviousOwners && data.History.PreviousOwners.length > 0) {
      content += `- **Previous Owners:** ${data.History.PreviousOwners.map(name => `[[${name}]]`).join(', ')}\n`;
    }
    
    // Significance
    content += `\n### Significance\n`;
    if (data.Significance.Purpose) content += `- **Purpose:** ${data.Significance.Purpose}\n`;
    if (data.Significance.CulturalMeaning) content += `- **Cultural Meaning:** ${data.Significance.CulturalMeaning}\n`;

    // Current Status
    content += `\n### Current Status\n`;
    if (data.CurrentStatus.Condition) content += `- **Condition:** ${data.CurrentStatus.Condition}\n`;
    if (data.CurrentStatus.Location) content += `- **Location:** [[${data.CurrentStatus.Location}]]\n`;
    if (data.CurrentStatus.Accessibility) content += `- **Accessibility:** ${data.CurrentStatus.Accessibility}\n`;

    // Additional Notes
    if (data.AdditionalNotes) {
      content += `\n### Additional Notes\n${data.AdditionalNotes}\n`;
    }

    return content;
  }

  private generateEventContent(data: any): string {
    let content = `#Evenement \n\n`;
    
    // Basic Information
    if (data.BasicInformation.Name) content += `## ${data.BasicInformation.Name}\n\n`;
    if (data.BasicInformation.Date) content += `**Date:** ${data.BasicInformation.Date}\n\n`;
    if (data.BasicInformation.Location) content += `**Location:** [[${data.BasicInformation.Location}]]\n\n`;
    if (data.BasicInformation.Description) content += `${data.BasicInformation.Description}\n\n`;
    
    // Participants
    if (data.Participants && 
        (data.Participants.MainParticipants.length > 0 || 
         data.Participants.KeyFigures.length > 0 || 
         data.Participants.Spectators.length > 0)) {
      
      content += `## Participants\n\n`;
      
      if (data.Participants.MainParticipants && data.Participants.MainParticipants.length > 0) {
        data.Participants.MainParticipants.forEach(participant => {
          content += `- [[${participant}]]\n`;
        });
        content += '\n';
      }
      
      if (data.Participants.KeyFigures && data.Participants.KeyFigures.length > 0) {
        content += `### Key Figures\n`;
        data.Participants.KeyFigures.forEach(figure => {
          content += `- [[${figure}]]\n`;
        });
        content += '\n';
      }
    }
    
    // Additional Notes
    if (data.AdditionalNotes) {
      content += `## Notes\n\n${data.AdditionalNotes}\n`;
    }

    return content;
  }

  private generateLocationContent(data: any): string {
    let content = `#Location\n\n`;
    
    // Basic Information
    content += `### Basic Information\n`;
    if (data.BasicInformation.Name) content += `- **Name:** ${data.BasicInformation.Name}\n`;
    if (data.BasicInformation.Type) content += `- **Type:** ${data.BasicInformation.Type}\n`;
    if (data.BasicInformation.Address) content += `- **Address/Location:** ${data.BasicInformation.Address}\n`;
    if (data.BasicInformation.Owner) content += `- **Owner/Proprietor:** [[${data.BasicInformation.Owner}]]\n`;
    
    // Appearance
    content += `\n### Appearance\n`;
    if (data.Appearance.Exterior) content += `- **Exterior:** ${data.Appearance.Exterior}\n`;
    if (data.Appearance.Interior) content += `- **Interior:** ${data.Appearance.Interior}\n`;
    if (data.Appearance.Size) content += `- **Size:** ${data.Appearance.Size}\n`;
    if (data.Appearance.DistinguishingFeatures) content += `- **Distinguishing Features:** ${data.Appearance.DistinguishingFeatures}\n`;

    // Atmosphere
    content += `\n### Atmosphere\n`;
    if (data.Atmosphere.Lighting) content += `- **Lighting:** ${data.Atmosphere.Lighting}\n`;
    if (data.Atmosphere.Sounds) content += `- **Sounds:** ${data.Atmosphere.Sounds}\n`;
    if (data.Atmosphere.Smells) content += `- **Smells:** ${data.Atmosphere.Smells}\n`;
    if (data.Atmosphere.Mood) content += `- **Mood:** ${data.Atmosphere.Mood}\n`;

    // Purpose & History
    content += `\n### Purpose & History\n`;
    if (data.PurposeAndHistory.PrimaryUse) content += `- **Primary Use:** ${data.PurposeAndHistory.PrimaryUse}\n`;
    if (data.PurposeAndHistory.History) content += `- **History:** ${data.PurposeAndHistory.History}\n`;
    if (data.PurposeAndHistory.Significance) content += `- **Significance:** ${data.PurposeAndHistory.Significance}\n`;

    // Characters Associated
    content += `\n### Characters Associated\n`;
    if (data.AssociatedCharacters && data.AssociatedCharacters.length > 0) {
      data.AssociatedCharacters.forEach(character => {
        content += `- [[${character}]]\n`;
      });
    }

    // Additional Notes
    if (data.AdditionalNotes) {
      content += `\n### Additional Notes\n${data.AdditionalNotes}\n`;
    }

    return content;
  }
}

// Create setting tab
class CreatorSettingTab extends PluginSettingTab {
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