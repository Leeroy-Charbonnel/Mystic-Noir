import { App, Modal, Setting, TextAreaComponent, ButtonComponent, ToggleComponent, Notice } from 'obsidian';
import ContentCreatorPlugin from './main';
import { TEMPLATES, getDisplayName, isArray, isObject, isBoolean } from './template';

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
    
    // Clone the template to avoid modifying the original
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

    const cancelButton = new ButtonComponent(buttonContainer)
      .setButtonText('Cancel')
      .onClick(() => this.close());
    
    cancelButton.buttonEl.style.marginRight = '10px';
    
    new ButtonComponent(buttonContainer)
      .setButtonText('Create')
      .setCta()
      .onClick(() => this.handleSubmit());
  }

  generateForm(container: HTMLElement, data: any, path: string = '') {
    Object.entries(data).forEach(([key, value]) => {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (isObject(value)) {
        // Create a section for this object
        const sectionHeader = container.createEl('h3', { text: getDisplayName(key) });
        const sectionContainer = container.createDiv(`section-${key}`);
        this.containerElMapping.set(currentPath, sectionContainer);
        
        // Recursively generate fields for this section
        this.generateForm(sectionContainer, value, currentPath);
      } else if (isArray(value)) {
        // Create a multi-value field for arrays
        const fieldContainer = container.createDiv(`field-${key}`);
        
        const multiField = new MultiValueField(
          fieldContainer, 
          getDisplayName(key), 
          value as string[], 
          (newValues) => {
            this.updateFormData(currentPath, newValues);
          }
        );
        
        this.multiValueFieldsMap.set(currentPath, multiField);
      } else if (isBoolean(value)) {
        // Create a toggle/checkbox for boolean values
        new Setting(container)
          .setName(getDisplayName(key))
          .addToggle(toggle => toggle
            .setValue(value as boolean)
            .onChange(value => {
              this.updateFormData(currentPath, value);
            }));
      } else {
        // Create a text field or text area for string values
        if (key === 'AdditionalNotes' || key === 'Background' || key === 'Description') {
          // Use text area for longer text inputs
          new Setting(container)
            .setName(getDisplayName(key))
            .addTextArea(textarea => {
              textarea
                .setPlaceholder(`Enter ${getDisplayName(key).toLowerCase()}`)
                .setValue(value as string)
                .onChange(newValue => {
                  this.updateFormData(currentPath, newValue);
                });
              
              textarea.inputEl.rows = 4;
              textarea.inputEl.style.width = '100%';
            });
        } else {
          // Use text input for regular fields
          new Setting(container)
            .setName(