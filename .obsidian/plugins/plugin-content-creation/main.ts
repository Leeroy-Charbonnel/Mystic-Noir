import { App, Plugin, PluginSettingTab, Setting, TFile, normalizePath, Notice, TFolder } from 'obsidian';
import { DynamicFormModal } from './dynamicFormModal';
import { ContentSelectorModal } from './contentSelectorModal';
import * as templates from './template';
import { node, formatDisplayName } from './utils';
import './styles.css';

export default class ContentCreatorPlugin extends Plugin {
  async onload() {
    console.log("loading " + this.manifest.name + " plugin: v" + this.manifest.version)
    const ribbonIconEl = this.addRibbonIcon('file-plus', 'Create Content', (evt: MouseEvent) => {
      new ContentSelectorModal(this.app, this).open();
    });
    ribbonIconEl.addClass('creator-plugin-ribbon-class');

    this.addCommand({
      id: 'open-content-creator',
      name: 'Create new content',
      callback: () => {
        new ContentSelectorModal(this.app, this).open();
      }
    });
  }

  openFormForContentType(contentType: string) {
    if (!templates.templates[contentType]) {
      new Notice(`Unknown content type: ${contentType}`);
      return;
    }
    new DynamicFormModal(this.app, this, contentType).open();
  }

























  async createContentFile(contentType: string, formData: any, contentName: string) {
    try {
      const folderPath = templateModule.templates[contentType].defaultFolder;

      await this.ensureFolderExists(folderPath);

      // Generate filename
      const fileName = this.generateFileName(contentName);
      const filePath = normalizePath(`${folderPath}/${fileName}.md`);

      // Check if file already exists
      const exists = await this.app.vault.adapter.exists(filePath);
      if (exists) {
        new Notice(`File already exists: ${filePath}`);
        return null;
      }

      // Generate content
      const fileContent = this.generateFileContent(contentType, formData);

      // Create file
      const file = await this.app.vault.create(filePath, fileContent);
      new Notice(`Created ${contentType.slice(0, -1)}: ${contentName}`);

      // Open the file
      this.app.workspace.getLeaf(false).openFile(file);

      return file;
    } catch (error) {
      console.error("Error creating content:", error);
      new Notice(`Error creating content: ${error.message}`);
      return null;
    }
  }

  private async ensureFolderExists(folderPath: string) {
    const folders = folderPath.split('/').filter(p => p.trim());
    let currentPath = '';

    for (const folder of folders) {
      currentPath = currentPath ? `${currentPath}/${folder}` : folder;
      if (!(await this.app.vault.adapter.exists(currentPath))) {
        await this.app.vault.createFolder(currentPath);
      }
    }
  }

  private generateFileName(name: string): string {
    // Remove special characters and replace spaces with dashes
    return name.replace(/[^\w\s]/gi, '').replace(/\s+/g, '-');
  }

  private generateFileContent(contentType: string, formData: any): string {
    const contentTypeTag = contentType.charAt(0).toUpperCase() + contentType.slice(1, -1);
    let content = `#${contentTypeTag}\n\n`;

    const contentName = this.getContentName(formData);
    content += `# ${contentName}\n\n`;

    content += this.formatContentData(formData);
    return content;
  }

  private getContentName(formData: any): string {
    // Try to find a sensible name from the form data
    if (formData.BasicInformation && formData.BasicInformation.Name) {
      return formData.BasicInformation.Name;
    }
    if (formData.BasicInformation && formData.BasicInformation.FullName) {
      return formData.BasicInformation.FullName;
    }
    return "New Content";
  }

  private formatContentData(data: any, depth: number = 2): string {
    let content = '';

    for (const [key, value] of Object.entries(data)) {
      if (key === 'Name' || key === 'FullName') {
        // Skip these as they're used in the heading
        continue;
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const heading = '#'.repeat(depth);
        const displayName = formatDisplayName(key);
        content += `${heading} ${displayName}\n`;
        content += this.formatContentData(value, depth + 1);
      } else if (Array.isArray(value)) {
        if (value.length > 0 && value.some(item => item.trim?.().length > 0)) {
          const displayName = formatDisplayName(key);
          content += `**${displayName}:** `;
          content += value.filter(item => item.trim?.().length > 0).map(item => item.trim()).join(', ');
          content += '\n\n';
        }
      } else if (value !== null && value !== undefined && String(value).trim()) {
        const displayName = formatDisplayName(key);
        content += `**${displayName}:** ${value}\n\n`;
      }
    }

    return content;
  }

  onunload() {
    console.log("unloading plugin");
  }
}
