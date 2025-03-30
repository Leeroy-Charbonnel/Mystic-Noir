import { setIcon, ButtonComponent, Menu, ColorComponent, Setting } from 'obsidian';
import { node } from 'utils';

export class ToolbarManager {
    private container: HTMLElement;
    private activeTool: string = 'select';
    private onChangeCallback: (tool: string, options?: any) => void;
    
    //Tool settings
    private borderWidth: number = 3;
    private borderColor: string = '#000000';
    private fontSize: number = 16;
    private fontFamily: string = 'Arial';
    private textColor: string = '#000000';
    private snapToGrid: boolean = false;
    private snapToAngle: boolean = false;
    
    constructor(
        container: HTMLElement, 
        onChange: (tool: string, options?: any) => void
    ) {
        this.container = container;
        this.onChangeCallback = onChange;
        
        this.render();
    }
    
    setActiveTool(toolId: string) {
        this.activeTool = toolId;
        
        //Update active tool in UI
        const toolButtons = this.container.querySelectorAll('.comic-tool-button');
        toolButtons.forEach(button => {
            const buttonId = button.getAttribute('data-tool');
            if (buttonId === toolId) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        
        //Show/hide appropriate settings panels
        this.updateSettingsPanels();
    }
    
    render() {
        this.container.empty();
        
        //Create toolbar header
        const header = node('div', { class: 'comic-toolbar-header' });
        const title = node('h3', { class: 'comic-toolbar-title', text: 'Tools' });
        header.appendChild(title);
        this.container.appendChild(header);
        
        //Create tool buttons container
        const toolsContainer = node('div', { class: 'comic-tools-container' });
        
        //Create tool buttons
        const tools = [
            { id: 'select', icon: 'mouse-pointer', label: 'Select' },
            { id: 'pan', icon: 'move', label: 'Pan' },
            { id: 'draw-panel', icon: 'square', label: 'Draw Panel' },
            { id: 'draw-border', icon: 'vector', label: 'Draw Border' },
            { id: 'add-image', icon: 'image', label: 'Add Image' },
            { id: 'text', icon: 'type', label: 'Add Text' }
        ];
        
        tools.forEach(tool => {
            const button = node('button', { 
                class: `comic-tool-button ${this.activeTool === tool.id ? 'active' : ''}`,
                attributes: { 
                    'data-tool': tool.id,
                    'aria-label': tool.label,
                    'title': tool.label
                }
            });
            
            setIcon(button, tool.icon);
            
            button.addEventListener('click', () => {
                this.setActiveTool(tool.id);
                this.onChangeCallback(tool.id);
            });
            
            toolsContainer.appendChild(button);
        });
        
        //Add grid toggle button
        const gridToggleButton = node('button', { 
            class: `comic-tool-button ${this.snapToGrid ? 'active' : ''}`,
            attributes: { 
                'data-tool': 'grid-toggle',
                'aria-label': 'Toggle Grid',
                'title': 'Toggle Grid'
            }
        });
        
        setIcon(gridToggleButton, 'grid');
        
        gridToggleButton.addEventListener('click', () => {
            this.snapToGrid = !this.snapToGrid;
            gridToggleButton.classList.toggle('active');
            this.onChangeCallback('grid-toggle', { snapToGrid: this.snapToGrid });
        });
        
        toolsContainer.appendChild(gridToggleButton);
        
        //Add tools container to toolbar
        this.container.appendChild(toolsContainer);
        
        //Create settings panels
        this.createSettingsPanels();
        
        //Show/hide appropriate settings panels based on active tool
        this.updateSettingsPanels();
    }
    
    createSettingsPanels() {
        //Border settings panel
        const borderSettingsPanel = node('div', { 
            class: 'comic-settings-panel', 
            attributes: { 'data-for': 'draw-border' }
        });
        
        //Border width setting
        const borderWidthContainer = node('div', { class: 'comic-setting-container' });
        const borderWidthLabel = node('div', { class: 'comic-setting-label', text: 'Width:' });
        
        const borderWidthInput = node('input', { 
            class: 'comic-setting-input',
            attributes: { 
                type: 'range',
                min: '1',
                max: '10',
                step: '1',
                value: this.borderWidth.toString()
            }
        }) as HTMLInputElement;
        
        const borderWidthValue = node('div', { 
            class: 'comic-setting-value', 
            text: this.borderWidth.toString() 
        });
        
        borderWidthInput.addEventListener('input', () => {
            this.borderWidth = parseInt(borderWidthInput.value);
            borderWidthValue.textContent = borderWidthInput.value;
            this.onChangeCallback('setting-change', { borderWidth: this.borderWidth });
        });
        
        borderWidthContainer.appendChild(borderWidthLabel);
        borderWidthContainer.appendChild(borderWidthInput);
        borderWidthContainer.appendChild(borderWidthValue);
        
        //Border color setting
        const borderColorContainer = node('div', { class: 'comic-setting-container' });
        const borderColorLabel = node('div', { class: 'comic-setting-label', text: 'Color:' });
        
        const borderColorInput = node('input', { 
            class: 'comic-setting-color-input',
            attributes: { 
                type: 'color',
                value: this.borderColor
            }
        }) as HTMLInputElement;
        
        borderColorInput.addEventListener('input', () => {
            this.borderColor = borderColorInput.value;
            this.onChangeCallback('setting-change', { borderColor: this.borderColor });
        });
        
        borderColorContainer.appendChild(borderColorLabel);
        borderColorContainer.appendChild(borderColorInput);
        
        //Add settings to panel
        borderSettingsPanel.appendChild(borderWidthContainer);
        borderSettingsPanel.appendChild(borderColorContainer);
        
        //Text settings panel
        const textSettingsPanel = node('div', { 
            class: 'comic-settings-panel', 
            attributes: { 'data-for': 'text' }
        });
        
        //Font size setting
        const fontSizeContainer = node('div', { class: 'comic-setting-container' });
        const fontSizeLabel = node('div', { class: 'comic-setting-label', text: 'Size:' });
        
        const fontSizeInput = node('input', { 
            class: 'comic-setting-input',
            attributes: { 
                type: 'range',
                min: '8',
                max: '36',
                step: '1',
                value: this.fontSize.toString()
            }
        }) as HTMLInputElement;
        
        const fontSizeValue = node('div', { 
            class: 'comic-setting-value', 
            text: this.fontSize.toString() 
        });
        
        fontSizeInput.addEventListener('input', () => {
            this.fontSize = parseInt(fontSizeInput.value);
            fontSizeValue.textContent = fontSizeInput.value;
            this.onChangeCallback('setting-change', { fontSize: this.fontSize });
        });
        
        fontSizeContainer.appendChild(fontSizeLabel);
        fontSizeContainer.appendChild(fontSizeInput);
        fontSizeContainer.appendChild(fontSizeValue);
        
        //Font family setting
        const fontFamilyContainer = node('div', { class: 'comic-setting-container' });
        const fontFamilyLabel = node('div', { class: 'comic-setting-label', text: 'Font:' });
        
        const fontFamilySelect = node('select', { 
            class: 'comic-setting-select'
        }) as HTMLSelectElement;
        
        const fontFamilies = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia', 'Comic Sans MS'];
        
        fontFamilies.forEach(font => {
            const option = node('option', { 
                text: font,
                attributes: { value: font }
            });
            
            if (font === this.fontFamily) {
                option.setAttribute('selected', 'selected');
            }
            
            fontFamilySelect.appendChild(option);
        });
        
        fontFamilySelect.addEventListener('change', () => {
            this.fontFamily = fontFamilySelect.value;
            this.onChangeCallback('setting-change', { fontFamily: this.fontFamily });
        });
        
        fontFamilyContainer.appendChild(fontFamilyLabel);
        fontFamilyContainer.appendChild(fontFamilySelect);
        
        //Text color setting
        const textColorContainer = node('div', { class: 'comic-setting-container' });
        const textColorLabel = node('div', { class: 'comic-setting-label', text: 'Color:' });
        
        const textColorInput = node('input', { 
            class: 'comic-setting-color-input',
            attributes: { 
                type: 'color',
                value: this.textColor
            }
        }) as HTMLInputElement;
        
        textColorInput.addEventListener('input', () => {
            this.textColor = textColorInput.value;
            this.onChangeCallback('setting-change', { textColor: this.textColor });
        });
        
        textColorContainer.appendChild(textColorLabel);
        textColorContainer.appendChild(textColorInput);
        
        //Add settings to panel
        textSettingsPanel.appendChild(fontSizeContainer);
        textSettingsPanel.appendChild(fontFamilyContainer);
        textSettingsPanel.appendChild(textColorContainer);
        
        //Add panels to container
        this.container.appendChild(borderSettingsPanel);
        this.container.appendChild(textSettingsPanel);
    }
    
    updateSettingsPanels() {
        const panels = this.container.querySelectorAll('.comic-settings-panel');
        
        panels.forEach(panel => {
            const forTool = panel.getAttribute('data-for');
            
            if (forTool === this.activeTool) {
                panel.classList.add('visible');
            } else {
                panel.classList.remove('visible');
            }
        });
    }
}