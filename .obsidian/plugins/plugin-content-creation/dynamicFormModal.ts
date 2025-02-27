import { App, Modal, Setting, TextAreaComponent, ButtonComponent, ToggleComponent, Notice } from 'obsidian';
import ContentCreatorPlugin from './main';
import { TEMPLATES, getDisplayName, isArray, isObject, isBoolean } from './template';
import { MultiValueField } from './main';

export class DynamicFormModal extends Modal {
  plugin: ContentCreatorPlugin;
  contentType: string;
  formData: any;
  containerElMapping: Map<string, HTMLElement> = new Map();
  multiValueFieldsMap: Map<string, MultiValueField> = new Map();

  constructor(app: App, plugin: ContentCreatorPlugin, contentType: string) {
    super(app);
    this.plugin = plugin;
    this.contentType = contentType;

    this.formData = JSON.parse(JSON.stringify(TEMPLATES[contentType].template));
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dynamic-form-modal');

    // Add scrollable container
    const scrollContainer = contentEl.createDiv('form-scroll-container');
    scrollContainer.addClass('form-scroll-container');
    scrollContainer.style.maxHeight = '70vh';
    scrollContainer.style.overflow = 'auto';
    scrollContainer.style.paddingRight = '20px';

    // Add form title
    const contentTypeDisplayName = this.contentType.charAt(0).toUpperCase() + this.contentType.slice(1, -1);
    scrollContainer.createEl('h2', { text: `Create ${contentTypeDisplayName}` });

    // Generate form fields based on template structure
    this.generateForm(scrollContainer, this.formData);

    // Add submit and cancel buttons
    const buttonContainer = contentEl.createDiv('button-container');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.marginTop = '20px';

    const cancelButton = new ButtonComponent(buttonContainer).setButtonText('Cancel').onClick(() => this.close());
    cancelButton.buttonEl.style.marginRight = '10px';

    new ButtonComponent(buttonContainer).setButtonText('Create').setCta().onClick(() => this.handleSubmit());
  }

  generateForm(container: HTMLElement, data: any, path: string = '') {
    Object.entries(data).forEach(([key, value]) => {
      const currentPath = path ? `${path}.${key}` : key;
      if (isObject(value)) {
        const sectionHeader = container.createEl('h3', { text: getDisplayName(key) });
        const sectionContainer = container.createDiv(`section-${key}`);
        this.containerElMapping.set(currentPath, sectionContainer);
        this.generateForm(sectionContainer, value, currentPath);
      } else {
        const fieldType: string = value;
        if (fieldType.startsWith("array")) {
          const fieldContainer = container.createDiv(`field-${key}`);
          const multiField = new MultiValueField(
            fieldContainer,
            getDisplayName(key),
            [],
            (newValues) => {
              this.updateFormData(currentPath, newValues);
            }
          );

          this.multiValueFieldsMap.set(currentPath, multiField);
        } else if (fieldType == "boolean") {
          new Setting(container)
            .setName(getDisplayName(key))
            .addToggle(toggle => toggle
              .onChange(value => { this.updateFormData(currentPath, value); }));
        } else {
          // Create a text field or text area for string values
          if (fieldType == 'textarea') {
            new Setting(container)
              .setName(getDisplayName(key))
              .addTextArea(textarea => {
                textarea
                  .setPlaceholder(`Enter ${getDisplayName(key).toLowerCase()}`)
                  .onChange(newValue => { this.updateFormData(currentPath, newValue); });

                textarea.inputEl.rows = 4;
                textarea.inputEl.style.width = '100%';
              });
          } else {
            new Setting(container)
              .setName(getDisplayName(key))
              .addText(text => text
                .setPlaceholder(`Enter ${getDisplayName(key).toLowerCase()}`)
                .onChange(newValue => {
                  this.updateFormData(currentPath, newValue);
                }));
          }
        }
      }
    });
  }

  updateFormData(path: string, value: any) {
    // Update the form data at the specified path
    const pathParts = path.split('.');
    let current = this.formData;

    // Navigate to the correct nested object
    for (let i = 0; i < pathParts.length - 1; i++) {
      current = current[pathParts[i]];
    }

    // Update the value
    current[pathParts[pathParts.length - 1]] = value;
  }

  handleSubmit() {
    // Get the content name from the form data
    let contentName = "New Content";

    if (this.formData.BasicInformation) {
      if (this.formData.BasicInformation.Name) {
        contentName = this.formData.BasicInformation.Name;
      } else if (this.formData.BasicInformation.FullName) {
        contentName = this.formData.BasicInformation.FullName;
      }
    }

    // Validate the content name
    if (!contentName || contentName.trim() === "") {
      new Notice("Please provide a name for the content");
      return;
    }

    // Create the content file
    this.plugin.createContentFile(this.contentType, this.formData, contentName);

    // Close the modal
    this.close();
  }
}