import { App, Modal, Setting, TextAreaComponent, ButtonComponent, ToggleComponent, Notice } from 'obsidian';
import ContentCreatorPlugin from './main';
import * as templates from './template';
import { node, formatDisplayName, isObject } from './utils';

export class DynamicFormModal extends Modal {
  plugin: ContentCreatorPlugin;
  contentType: string;
  formData: any;
  contentName: string;
  containerElMapping: Map<string, HTMLElement> = new Map();
  multiValueFieldsMap: Map<string, MultiValueField> = new Map();

  constructor(app: App, plugin: ContentCreatorPlugin, contentType: string) {
    super(app);
    this.plugin = plugin;
    this.contentType = contentType;
    this.formData = JSON.parse(JSON.stringify(templates.templates[contentType]));
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.addClass('dynamic-form-modal');

    const scrollContainer = node('div', { class: 'form-scroll-container' });
    contentEl.appendChild(scrollContainer);

    const contentTypeDisplayName = this.contentType.charAt(0).toUpperCase() + this.contentType.slice(1, -1);

    const contentNameInput = node('input', {
      classes: ['content-name'],
      attributes: {
        'type': 'text',
        'value': `New ${contentTypeDisplayName}`,
        'placeholder': 'Enter a name'
      }
    });
    contentNameInput.addEventListener('input', (e) => this.updateContentName((e.target as HTMLInputElement).value),
    );

    scrollContainer.appendChild(contentNameInput);


    this.generateForm(scrollContainer, this.formData);

    const buttonContainer = node('div', { class: 'button-container' });
    contentEl.appendChild(buttonContainer);

    // Cancel button
    new ButtonComponent(buttonContainer)
      .setButtonText('Cancel')
      .onClick(() => this.close());

    // Create button
    new ButtonComponent(buttonContainer)
      .setButtonText('Create')
      .setCta()
      .onClick(() => this.handleSubmit());
  }

  generateForm(container: HTMLElement, data: any, path: string = '') {
    Object.entries(data).forEach(([key, value]) => {
      const currentPath = path ? `${path}.${key}` : key;

      if (isObject(value)) {
        container.appendChild(node('h3', { text: formatDisplayName(key) }));

        const sectionContainer = node('div', { class: `section-${key}` });
        container.appendChild(sectionContainer);

        this.containerElMapping.set(currentPath, sectionContainer);
        this.generateForm(sectionContainer, value, currentPath);
      } else {
        const fieldType: string = value;

        if (fieldType.startsWith("array")) {
          const fieldContainer = node('div', { class: `field-${key}` });
          const inputType = fieldType.split(':')[1]
          container.appendChild(fieldContainer);
          const multiField = new MultiValueField(fieldContainer, formatDisplayName(key), inputType,
            (newValues) => {
              this.updateFormData(currentPath, newValues);
            }
          );

          this.multiValueFieldsMap.set(currentPath, multiField);
        } else if (fieldType === "boolean") {
          new Setting(container)
            .setName(formatDisplayName(key))
            .addToggle(toggle => toggle
              .onChange(newValue => {
                this.updateFormData(currentPath, newValue);
              }));
        } else {
          if (fieldType === 'textarea') {
            new Setting(container)
              .setName(formatDisplayName(key))
              .addTextArea(textarea => {
                textarea
                  .setPlaceholder(`Enter ${formatDisplayName(key).toLowerCase()}`)
                  .onChange(newValue => {
                    this.updateFormData(currentPath, newValue);
                  });

              });
          } else {
            new Setting(container)
              .setName(formatDisplayName(key))
              .addText(text => text
                .setPlaceholder(`Enter ${formatDisplayName(key).toLowerCase()}`)
                .onChange(newValue => {
                  this.updateFormData(currentPath, newValue);
                }));
          }
        }
      }
    });
  }
  updateContentName(value: any) {
    this.contentName = value
  }

  updateFormData(path: string, value: any) {
    console.log(path)
    const pathParts = path.split('.');
    let current = this.formData;

    for (let i = 0; i < pathParts.length - 1; i++) {
      current = current[pathParts[i]];
    }

    current[pathParts[pathParts.length - 1]] = value;
  }

  handleSubmit() {
    if (!this.contentName || this.contentName.trim() === "") {
      new Notice("Please provide a name for the content");
      return;
    }

    this.plugin.createContentFile(this.contentType, this.formData, this.contentName);
    this.close();
  }
}


class MultiValueField {
  private container: HTMLElement;
  private inputType: string;
  private values: string[];
  private inputsContainer: HTMLElement;
  private onValuesChanged: (values: string[]) => void;

  constructor(
    containerEl: HTMLElement,
    labelText: string,
    inputType: string,
    onChange: (values: string[]) => void
  ) {
    this.container = containerEl;
    this.values = [];
    this.inputType = inputType;
    this.onValuesChanged = onChange;

    const labelContainer = node('div', { class: 'multi-value-label' });
    this.container.appendChild(labelContainer);
    labelContainer.appendChild(node('span', { text: labelText }));

    const addButton = node('button', {
      class: 'multi-value-add-button',
      children: [node("span", {
        text: '+',
      })]
    });
    labelContainer.appendChild(addButton);

    addButton.addEventListener('click', () => this.addValue());

    this.inputsContainer = node('div', { class: 'multi-value-inputs' });
    this.container.appendChild(this.inputsContainer);

    if (this.values.length === 0) {
      this.values.push('');
    }

    this.renderInputs();
  }

  private renderInputs() {
    this.inputsContainer.empty();

    this.values.forEach((value, index) => {
      const inputRow = node('div', { class: 'multi-value-input-row' });
      this.inputsContainer.appendChild(inputRow);

      const input = node(this.inputType == 'text' ? 'input' : 'textarea', {
        class:'input',
        attributes: {
          'type': 'text',
          'value': value,
          'placeholder': 'Enter value...'
        }
      });
      inputRow.appendChild(input);

      input.addEventListener('input', (e) => {
        this.values[index] = (e.target as HTMLInputElement).value;
        this.onValuesChanged(this.values);
      });

      if (this.values.length > 1) {
        const removeButton = node('button', {
          class: 'multi-value-remove-button',
          children: [node("span", {
            text: 'x',
          })]
        });


        inputRow.appendChild(removeButton);

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