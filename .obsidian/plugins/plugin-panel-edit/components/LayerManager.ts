import { setIcon } from 'obsidian';
import { node } from 'utils';

export class LayerManager {
    private container: HTMLElement;
    private layers: any[];
    private activeLayer: string | null = null;
    private onChangeCallback: (layerId: string, action: string, data?: any) => void;

    constructor(
        container: HTMLElement, 
        layers: any[], 
        onChange: (layerId: string, action: string, data?: any) => void
    ) {
        this.container = container;
        this.layers = layers;
        this.onChangeCallback = onChange;
        
        this.render();
    }
    
    updateLayers(layers: any[]) {
        this.layers = layers;
        this.render();
    }
    
    setActiveLayer(layerId: string) {
        this.activeLayer = layerId;
        
        //Update active layer in UI
        const layerItems = this.container.querySelectorAll('.comic-layer-item');
        layerItems.forEach(item => {
            const itemId = item.getAttribute('data-id');
            if (itemId === layerId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
    
    render() {
        this.container.empty();
        
        //Create layers header
        const header = node('div', { class: 'comic-layers-header' });
        
        //Add title
        const title = node('h3', { class: 'comic-layers-title', text: 'Layers' });
        
        //Add add button
        const addButton = node('button', { 
            class: 'comic-layers-add-button', 
            attributes: { 'aria-label': 'Add Layer', 'title': 'Add Layer' }
        });
        setIcon(addButton, 'plus');
        
        //Add event listener to add button
        addButton.addEventListener('click', () => this.addLayer());
        
        //Add elements to header
        header.appendChild(title);
        header.appendChild(addButton);
        
        //Add header to container
        this.container.appendChild(header);
        
        //Create layers list
        const layersList = node('div', { class: 'comic-layers-list' });
        
        //Reverse layers order for display (top layer first)
        const displayLayers = [...this.layers].reverse();
        
        //Add layers
        displayLayers.forEach(layer => {
            const layerItem = this.createLayerItem(layer);
            layersList.appendChild(layerItem);
        });
        
        //Add layers list to container
        this.container.appendChild(layersList);
    }
    
    createLayerItem(layer: any): HTMLElement {
        const layerItem = node('div', { 
            class: `comic-layer-item ${this.activeLayer === layer.id ? 'active' : ''}`,
            attributes: { 'data-id': layer.id }
        });
        
        //Create layer visibility toggle
        const visibilityToggle = node('button', { 
            class: `comic-layer-visibility-toggle ${layer.visible ? 'visible' : 'hidden'}`,
            attributes: { 'aria-label': layer.visible ? 'Hide Layer' : 'Show Layer', 'title': layer.visible ? 'Hide Layer' : 'Show Layer' }
        });
        setIcon(visibilityToggle, layer.visible ? 'eye' : 'eye-off');
        
        //Create layer lock toggle
        const lockToggle = node('button', { 
            class: `comic-layer-lock-toggle ${layer.locked ? 'locked' : 'unlocked'}`,
            attributes: { 'aria-label': layer.locked ? 'Unlock Layer' : 'Lock Layer', 'title': layer.locked ? 'Unlock Layer' : 'Lock Layer' }
        });
        setIcon(lockToggle, layer.locked ? 'lock' : 'unlock');
        
        //Create layer name
        const layerName = node('div', { class: 'comic-layer-name', text: layer.name });
        
        //Create layer actions
        const layerActions = node('div', { class: 'comic-layer-actions' });
        
        //Create move up button
        const moveUpButton = node('button', { 
            class: 'comic-layer-move-button',
            attributes: { 'aria-label': 'Move Layer Up', 'title': 'Move Layer Up' }
        });
        setIcon(moveUpButton, 'arrow-up');
        
        //Create move down button
        const moveDownButton = node('button', { 
            class: 'comic-layer-move-button',
            attributes: { 'aria-label': 'Move Layer Down', 'title': 'Move Layer Down' }
        });
        setIcon(moveDownButton, 'arrow-down');
        
        //Create delete button
        const deleteButton = node('button', { 
            class: 'comic-layer-delete-button',
            attributes: { 'aria-label': 'Delete Layer', 'title': 'Delete Layer' }
        });
        setIcon(deleteButton, 'trash-2');
        
        //Add event listeners
        layerItem.addEventListener('click', (e) => {
            //Only handle clicks on the layer item itself, not on buttons
            if (e.target === layerItem || e.target === layerName) {
                this.setActiveLayer(layer.id);
                this.onChangeCallback(layer.id, 'select');
            }
        });
        
        visibilityToggle.addEventListener('click', () => {
            this.onChangeCallback(layer.id, 'toggle-visibility');
            
            //Toggle icon
            visibilityToggle.innerHTML = '';
            setIcon(visibilityToggle, !layer.visible ? 'eye' : 'eye-off');
            
            //Toggle class
            visibilityToggle.classList.toggle('visible');
            visibilityToggle.classList.toggle('hidden');
            
            //Update title
            visibilityToggle.setAttribute('title', !layer.visible ? 'Hide Layer' : 'Show Layer');
            visibilityToggle.setAttribute('aria-label', !layer.visible ? 'Hide Layer' : 'Show Layer');
        });
        
        lockToggle.addEventListener('click', () => {
            this.onChangeCallback(layer.id, 'toggle-lock');
            
            //Toggle icon
            lockToggle.innerHTML = '';
            setIcon(lockToggle, !layer.locked ? 'lock' : 'unlock');
            
            //Toggle class
            lockToggle.classList.toggle('locked');
            lockToggle.classList.toggle('unlocked');
            
            //Update title
            lockToggle.setAttribute('title', !layer.locked ? 'Unlock Layer' : 'Lock Layer');
            lockToggle.setAttribute('aria-label', !layer.locked ? 'Unlock Layer' : 'Lock Layer');
        });
        
        layerName.addEventListener('dblclick', () => {
            //Create input for editing the name
            const input = node('input', { 
                class: 'comic-layer-name-input',
                attributes: { type: 'text', value: layer.name }
            }) as HTMLInputElement;
            
            //Replace name with input
            layerName.innerHTML = '';
            layerName.appendChild(input);
            
            //Focus input
            input.focus();
            input.select();
            
            //Handle input events
            input.addEventListener('blur', () => {
                this.onChangeCallback(layer.id, 'rename', input.value);
                layerName.textContent = input.value;
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.onChangeCallback(layer.id, 'rename', input.value);
                    layerName.textContent = input.value;
                } else if (e.key === 'Escape') {
                    layerName.textContent = layer.name;
                }
            });
        });
        
        moveUpButton.addEventListener('click', () => {
            this.onChangeCallback(layer.id, 'move-up');
        });
        
        moveDownButton.addEventListener('click', () => {
            this.onChangeCallback(layer.id, 'move-down');
        });
        
        deleteButton.addEventListener('click', () => {
            this.onChangeCallback(layer.id, 'remove');
        });
        
        //Add elements to layer actions
        layerActions.appendChild(moveUpButton);
        layerActions.appendChild(moveDownButton);
        layerActions.appendChild(deleteButton);
        
        //Add elements to layer item
        layerItem.appendChild(visibilityToggle);
        layerItem.appendChild(lockToggle);
        layerItem.appendChild(layerName);
        layerItem.appendChild(layerActions);
        
        return layerItem;
    }
    
    addLayer() {
        //Show dialog for entering layer name
        const layerName = prompt('Enter layer name:', `Layer ${this.layers.length + 1}`);
        
        if (layerName) {
            this.onChangeCallback('', 'add', layerName);
        }
    }
}