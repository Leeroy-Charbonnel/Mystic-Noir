import { App, Plugin, PluginSettingTab, Setting, TFile, normalizePath, Notice, TFolder } from 'obsidian';
import { DynamicFormModal } from './dynamicFormModal';
import { ContentSelectorModal } from './contentSelectorModal';
import { TEMPLATES } from './template';

export default class ContentCreatorPlugin extends Plugin {
  async onload() {
    console.log("loading " + this.manifest.name + " plugin: v" + this.manifest.version)
    const ribbonIconEl = this.addRibbonIcon('file-plus', 'Create Content', (evt: MouseEvent) => {      new ContentSelectorModal(this.app, this).open();    });
    ribbonIconEl.addClass('creator-plugin-ribbon-class');
  }

  openFormForContentType(contentType: string) {
    // Validate content type
    if (!TEMPLATES[contentType]) {
      new Notice(`Unknown content type: ${contentType}`);
      return;
    }
    new DynamicFormModal(this.app, this, contentType).open();
  }

  async createContentFile(contentType: string, formData: any, contentName: string) {
    try {
      const folderPath = TEMPLATES[contentType].defaultFolder;

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
    return this.settings.fileNameTemplate.replace('{{name}}', name);
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
        const displayName = this.getDisplayName(key);
        content += `${heading} ${displayName}\n`;
        content += this.formatContentData(value, depth + 1);
      } else if (Array.isArray(value)) {
        if (value.length > 0 && value.some(item => item.trim().length > 0)) {
          const displayName = this.getDisplayName(key);
          content += `**${displayName}:** `;
          content += value.filter(item => item.trim().length > 0).map(item => item.trim()).join(', ');
          content += '\n\n';
        }
      } else if (value !== null && value !== undefined && String(value).trim()) {
        const displayName = this.getDisplayName(key);
        content += `**${displayName}:** ${value}\n\n`;
      }
    }

    return content;
  }

  private getDisplayName(name: string): string {
    const result = name.replace(/([A-Z])/g, ' $1').trim();
    return result.charAt(0).toUpperCase() + result.slice(1);
  }
}

// Helper class for multi-value input fields
export class MultiValueField {
  private container: HTMLElement;
  private values: string[];
  private inputsContainer: HTMLElement;
  private onValuesChanged: (values: string[]) => void;

  constructor(
    containerEl: HTMLElement,
    labelText: string,
    initialValues: string[],
    onChange: (values: string[]) => void
  ) {
    this.container = containerEl;
    this.values = [...initialValues];
    this.onValuesChanged = onChange;

    // Create label
    const labelContainer = this.container.createDiv('multi-value-label');
    labelContainer.createEl('span', { text: labelText });

    // Create button to add new field
    const addButton = labelContainer.createEl('button', {
      cls: 'multi-value-add-button',
      text: '+'
    });
    addButton.addEventListener('click', () => this.addValue());

    // Container for input fields
    this.inputsContainer = this.container.createDiv('multi-value-inputs');

    // Initialize with initial values or at least one empty field
    if (this.values.length === 0) {
      this.values.push('');
    }

    // Create input fields for each value
    this.renderInputs();
  }

  private renderInputs() {
    this.inputsContainer.empty();

    this.values.forEach((value, index) => {
      const inputRow = this.inputsContainer.createDiv('multi-value-input-row');

      // Create text input
      const input = inputRow.createEl('input', {
        type: 'text',
        value: value
      });

      input.addEventListener('input', (e) => {
        this.values[index] = (e.target as HTMLInputElement).value;
        this.onValuesChanged(this.values);
      });

      // Add remove button if there's more than one field
      if (this.values.length > 1) {
        const removeButton = inputRow.createEl('button', {
          cls: 'multi-value-remove-button',
          text: '×'
        });

        removeButton.addEventListener('click', () => {
          this.values.splice(index, 1);
          this.onValuesChanged(this.values);
          this.renderInputs();
        });
      }
    });
  }

  private addValue() {
    this.values.push('');
    this.onValuesChanged(this.values);
    this.renderInputs();

    // Focus the new input
    const inputs = this.inputsContainer.querySelectorAll('input');
    if (inputs.length > 0) {
      (inputs[inputs.length - 1] as HTMLInputElement).focus();
    }
  }

  getValues(): string[] {
    return [...this.values];
  }

  setValues(newValues: string[]) {
    this.values = [...newValues];
    this.onValuesChanged(this.values);
    this.renderInputs();
  }
}