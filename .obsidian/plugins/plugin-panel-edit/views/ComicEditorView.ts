import { ItemView, WorkspaceLeaf, setIcon, Notice, Menu, TFile } from 'obsidian';
import { node, generateUUID, pointsToPath, pathToPoints, createSvgPath } from 'utils';
import ComicCreatorPlugin from '../main';
import { ImageSelectorModal } from '../modals/ImageSelectorModal';
import { LayerManager } from '../components/LayerManager';
import { ToolbarManager } from '../components/ToolbarManager';

enum EditorMode {
    SELECT = 'select',
    PAN = 'pan',
    DRAW_PANEL = 'draw_panel',
    DRAW_BORDER = 'draw_border',
    ADD_IMAGE = 'add_image',
    TEXT = 'text'
}

interface Point {
    x: number;
    y: number;
}

interface Panel {
    id: string;
    imagePath: string;
    clipPath: string;
    points: Point[];
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    layerId: string;
}

interface Border {
    id: string;
    points: Point[];
    strokeWidth: number;
    strokeColor: string;
    layerId: string;
}

interface TextElement {
    id: string;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    fontFamily: string;
    textAlign: string;
    color: string;
    layerId: string;
}

interface Layer {
    id: string;
    name: string;
    visible: boolean;
    locked: boolean;
    elements: string[]; // IDs of elements belonging to this layer
}

export class ComicEditorView extends ItemView {
    private plugin: ComicCreatorPlugin;
    private filePath: string;
    private comicData: any;
    private currentPageIndex: number = 0;

    private canvas: HTMLElement;
    private svgEditor: SVGSVGElement;
    private layerManager: LayerManager;
    private toolbarManager: ToolbarManager;
    
    //Editor state
    private mode: EditorMode = EditorMode.SELECT;
    private currentLayer: string;
    private selectedElements: string[] = [];
    private drawingPoints: Point[] = [];
    private isDrawing: boolean = false;
    private isPanning: boolean = false;
    private lastPanPoint: Point | null = null;
    private zoom: number = 1;
    private panOffset: Point = { x: 0, y: 0 };
    private snapToGrid: boolean = false;
    private gridSize: number = 20;
    private snapToAngle: boolean = false;
    private snapAngle: number = 15;
    private isDragging: boolean = false;
    private dragStartPoint: Point | null = null;
    
    //Tool settings
    private borderWidth: number = 3;
    private borderColor: string = '#000000';
    private fontSize: number = 16;
    private fontFamily: string = 'Arial';
    private textColor: string = '#000000';
    
    constructor(leaf: WorkspaceLeaf, plugin: ComicCreatorPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return 'comic-editor-view';
    }

    getDisplayText(): string {
        return 'Comic Editor';
    }

    async onOpen() {
        //Get file path from state
        this.filePath = this.getState().filePath;
        
        if (!this.filePath) {
            this.contentEl.setText('No comic file specified');
            return;
        }
        
        //Load comic data
        await this.loadComicData();
        
        //Create UI
        this.createUI();
    }
    
    //Initialize component managers
    initializeManagers() {
        const currentPage = this.comicData.pages[this.currentPageIndex];
        this.layerManager = new LayerManager(
            this.contentEl.querySelector('.comic-layers-container') as HTMLElement,
            currentPage.layers,
            this.onLayerChange.bind(this)
        );
        
        this.toolbarManager = new ToolbarManager(
            this.contentEl.querySelector('.comic-toolbar-container') as HTMLElement,
            this.onToolChange.bind(this)
        );
        
        //Set current layer to the first layer
        if (currentPage.layers.length > 0) {
            this.currentLayer = currentPage.layers[0].id;
            this.layerManager.setActiveLayer(this.currentLayer);
        }
    }
    
    async loadComicData() {
        try {
            //Check if the file exists
            const file = this.app.vault.getAbstractFileByPath(this.filePath);
            if (!file) {
                throw new Error(`Comic file not found: ${this.filePath}`);
            }
            
            //Read the file content
            const content = await this.app.vault.read(file as TFile);
            
            // Check if it's a markdown or json file
            if (this.filePath.endsWith('.md')) {
                // Extract comic data from markdown frontmatter
                const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
                if (frontmatterMatch && frontmatterMatch[1]) {
                    const frontmatter = frontmatterMatch[1];
                    const comicMatch = frontmatter.match(/comic:\s*([\s\S]*?)(?:\n[^\s]|$)/);
                    if (comicMatch && comicMatch[1]) {
                        try {
                            this.comicData = JSON.parse(comicMatch[1]);
                        } catch (e) {
                            throw new Error(`Failed to parse comic data: ${e.message}`);
                        }
                    } else {
                        throw new Error('No comic data found in frontmatter');
                    }
                } else {
                    throw new Error('No frontmatter found in markdown file');
                }
            } else {
                // Parse JSON file
                this.comicData = JSON.parse(content);
            }
            
            //Ensure comic data has expected structure
            if (!this.comicData.pages || !Array.isArray(this.comicData.pages)) {
                this.comicData.pages = [this.plugin.createEmptyPage('Page 1')];
            }
        } catch (error) {
            console.error('Failed to load comic data:', error);
            new Notice(`Failed to load comic: ${error.message}`);
            this.contentEl.setText(`Error: ${error.message}`);
            
            // Create a new comic data structure as fallback
            this.comicData = {
                id: generateUUID(),
                name: 'New Comic',
                created: Date.now(),
                modified: Date.now(),
                pages: [this.plugin.createEmptyPage('Page 1')]
            };
        }
    }
    
    createUI() {
        this.contentEl.empty();
        
        //Create main container
        const container = node('div', { class: 'comic-editor-container' });
        
        //Create toolbar
        const toolbar = node('div', { class: 'comic-toolbar-container' });
        
        //Create layers panel
        const layers = node('div', { class: 'comic-layers-container' });
        
        //Create editor canvas
        this.canvas = node('div', { class: 'comic-editor-canvas' });
        
        //Create SVG editor
        this.createSvgEditor();
        
        //Create page controls
        const pageControls = node('div', { class: 'comic-page-controls' });
        
        //Add page controls
        const pageInfo = node('div', { 
            class: 'comic-page-info',
            text: `Page ${this.currentPageIndex + 1} of ${this.comicData.pages.length}`
        });
        
        const prevPageBtn = node('button', { 
            class: 'comic-page-button', 
            attributes: { 'aria-label': 'Previous Page', 'title': 'Previous Page' }
        });
        setIcon(prevPageBtn, 'arrow-left');
        
        const nextPageBtn = node('button', { 
            class: 'comic-page-button', 
            attributes: { 'aria-label': 'Next Page', 'title': 'Next Page' }
        });
        setIcon(nextPageBtn, 'arrow-right');
        
        const addPageBtn = node('button', { 
            class: 'comic-page-button', 
            attributes: { 'aria-label': 'Add Page', 'title': 'Add Page' }
        });
        setIcon(addPageBtn, 'plus');
        
        //Add event listeners
        prevPageBtn.addEventListener('click', () => this.previousPage());
        nextPageBtn.addEventListener('click', () => this.nextPage());
        addPageBtn.addEventListener('click', () => this.addNewPage());
        
        //Add to page controls
        pageControls.appendChild(prevPageBtn);
        pageControls.appendChild(pageInfo);
        pageControls.appendChild(nextPageBtn);
        pageControls.appendChild(addPageBtn);
        
        //Add save button
        const saveBtn = node('button', { 
            class: 'comic-save-button', 
            text: 'Save Comic'
        });
        saveBtn.addEventListener('click', () => this.saveComic());
        
        //Add view mode button
        const viewBtn = node('button', { 
            class: 'comic-view-button', 
            text: 'Reader View'
        });
        viewBtn.addEventListener('click', () => this.openReaderView());
        
        //Add elements to container
        this.canvas.appendChild(this.svgEditor);
        container.appendChild(toolbar);
        container.appendChild(layers);
        container.appendChild(this.canvas);
        container.appendChild(pageControls);
        container.appendChild(saveBtn);
        container.appendChild(viewBtn);
        
        this.contentEl.appendChild(container);
        
        //Initialize managers
        this.initializeManagers();
        
        //Load current page
        this.loadCurrentPage();
        
        //Setup event listeners
        this.setupEventListeners();
    }
    
    createSvgEditor() {
        //Get current page dimensions
        const currentPage = this.comicData.pages[this.currentPageIndex];
        const width = currentPage.width || 900;
        const height = currentPage.height || 1200;
        
        //Create SVG element
        this.svgEditor = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svgEditor.setAttribute('width', width.toString());
        this.svgEditor.setAttribute('height', height.toString());
        this.svgEditor.setAttribute('viewBox', `0 0 ${width} ${height}`);
        this.svgEditor.classList.add('comic-svg-editor');
        
        //Create background grid group
        const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        gridGroup.classList.add('comic-grid');
        
        //Create layers container group
        const layersGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        layersGroup.classList.add('comic-layers');
        layersGroup.setAttribute('transform', `translate(${this.panOffset.x},${this.panOffset.y}) scale(${this.zoom})`);
        
        //Add groups to SVG
        this.svgEditor.appendChild(gridGroup);
        this.svgEditor.appendChild(layersGroup);
        
        //Draw grid
        this.drawGrid(gridGroup, width, height);
    }
    
    drawGrid(gridGroup: SVGGElement, width: number, height: number) {
        gridGroup.innerHTML = '';
        
        if (!this.snapToGrid) return;
        
        //Create pattern
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', 'grid-pattern');
        pattern.setAttribute('width', this.gridSize.toString());
        pattern.setAttribute('height', this.gridSize.toString());
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        
        //Create grid lines
        const horizontalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        horizontalLine.setAttribute('x1', '0');
        horizontalLine.setAttribute('y1', '0');
        horizontalLine.setAttribute('x2', this.gridSize.toString());
        horizontalLine.setAttribute('y2', '0');
        horizontalLine.setAttribute('stroke', '#cccccc');
        horizontalLine.setAttribute('stroke-width', '0.5');
        
        const verticalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        verticalLine.setAttribute('x1', '0');
        verticalLine.setAttribute('y1', '0');
        verticalLine.setAttribute('x2', '0');
        verticalLine.setAttribute('y2', this.gridSize.toString());
        verticalLine.setAttribute('stroke', '#cccccc');
        verticalLine.setAttribute('stroke-width', '0.5');
        
        //Add lines to pattern
        pattern.appendChild(horizontalLine);
        pattern.appendChild(verticalLine);
        
        //Add pattern definition
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.appendChild(pattern);
        gridGroup.appendChild(defs);
        
        //Create rectangle with pattern fill
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', width.toString());
        rect.setAttribute('height', height.toString());
        rect.setAttribute('fill', 'url(#grid-pattern)');
        
        gridGroup.appendChild(rect);
    }
    
    setupEventListeners() {
        //SVG editor events
        this.svgEditor.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.svgEditor.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.svgEditor.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.svgEditor.addEventListener('wheel', this.handleWheel.bind(this));
        
        //Keyboard events
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }
    
    loadCurrentPage() {
        const currentPage = this.comicData.pages[this.currentPageIndex];
        
        //Update SVG dimensions
        this.svgEditor.setAttribute('width', currentPage.width.toString());
        this.svgEditor.setAttribute('height', currentPage.height.toString());
        this.svgEditor.setAttribute('viewBox', `0 0 ${currentPage.width} ${currentPage.height}`);
        
        //Clear SVG content
        const layersGroup = this.svgEditor.querySelector('.comic-layers');
        if (layersGroup) layersGroup.innerHTML = '';
        
        //Redraw grid
        this.drawGrid(
            this.svgEditor.querySelector('.comic-grid') as SVGGElement, 
            currentPage.width, 
            currentPage.height
        );
        
        //Update layer manager
        this.layerManager.updateLayers(currentPage.layers);
        
        //If no current layer, set to first layer
        if (!this.currentLayer && currentPage.layers.length > 0) {
            this.currentLayer = currentPage.layers[0].id;
            this.layerManager.setActiveLayer(this.currentLayer);
        }
        
        //Render panels
        this.renderPanels();
        
        //Render borders
        this.renderBorders();
        
        //Render text elements
        this.renderTextElements();
        
        //Update page info
        const pageInfo = this.contentEl.querySelector('.comic-page-info');
        if (pageInfo) {
            pageInfo.textContent = `Page ${this.currentPageIndex + 1} of ${this.comicData.pages.length}`;
        }
    }
    
    renderPanels() {
        const currentPage = this.comicData.pages[this.currentPageIndex];
        const layersGroup = this.svgEditor.querySelector('.comic-layers') as SVGGElement;
        
        if (!currentPage.panels) return;
        
        currentPage.panels.forEach((panel: Panel) => {
            //Check if panel's layer is visible
            const layer = currentPage.layers.find((l: Layer) => l.id === panel.layerId);
            if (!layer || !layer.visible) return;
            
            //Create panel group
            const panelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            panelGroup.classList.add('comic-panel');
            panelGroup.setAttribute('data-id', panel.id);
            panelGroup.setAttribute('data-layer', panel.layerId);
            
            //Create clip path
            const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
            clipPath.setAttribute('id', `clip-${panel.id}`);
            
            //Create path for the clip
            const clipPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            clipPathElement.setAttribute('d', panel.clipPath);
            clipPath.appendChild(clipPathElement);
            
            //Add clip path to defs
            let defs = this.svgEditor.querySelector('defs');
            if (!defs) {
                defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                this.svgEditor.appendChild(defs);
            }
            defs.appendChild(clipPath);
            
            //Create image
            if (panel.imagePath) {
                const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
                image.setAttribute('href', this.app.vault.getResourcePath(
                    this.app.vault.getAbstractFileByPath(panel.imagePath) as TFile
                ));
                image.setAttribute('x', panel.x.toString());
                image.setAttribute('y', panel.y.toString());
                image.setAttribute('width', panel.width.toString());
                image.setAttribute('height', panel.height.toString());
                image.setAttribute('clip-path', `url(#clip-${panel.id})`);
                
                if (panel.rotation) {
                    const centerX = panel.x + panel.width/2;
                    const centerY = panel.y + panel.height/2;
                    image.setAttribute('transform', 
                        `rotate(${panel.rotation} ${centerX} ${centerY})`
                    );
                }
                
                panelGroup.appendChild(image);
            }
            
            //Create panel outline
            const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            outline.setAttribute('d', panel.clipPath);
            outline.setAttribute('fill', 'none');
            outline.setAttribute('stroke', this.selectedElements.includes(panel.id) ? '#4285f4' : '#999999');
            outline.setAttribute('stroke-width', '1');
            outline.setAttribute('stroke-dasharray', '5,5');
            outline.classList.add('panel-outline');
            
            panelGroup.appendChild(outline);
            
            //Add control points if selected
            if (this.selectedElements.includes(panel.id)) {
                this.addControlPoints(panelGroup, panel.points);
            }
            
            layersGroup.appendChild(panelGroup);
        });
    }
    
    renderBorders() {
        const currentPage = this.comicData.pages[this.currentPageIndex];
        const layersGroup = this.svgEditor.querySelector('.comic-layers') as SVGGElement;
        
        if (!currentPage.borders) return;
        
        currentPage.borders.forEach((border: Border) => {
            //Check if border's layer is visible
            const layer = currentPage.layers.find((l: Layer) => l.id === border.layerId);
            if (!layer || !layer.visible) return;
            
            //Create border path
            const borderPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            borderPath.classList.add('comic-border');
            borderPath.setAttribute('data-id', border.id);
            borderPath.setAttribute('data-layer', border.layerId);
            borderPath.setAttribute('d', pointsToPath(border.points));
            borderPath.setAttribute('fill', 'none');
            borderPath.setAttribute('stroke', border.strokeColor);
            borderPath.setAttribute('stroke-width', border.strokeWidth.toString());
            borderPath.setAttribute('stroke-linecap', 'round');
            borderPath.setAttribute('stroke-linejoin', 'round');
            
            //Add selected styling
            if (this.selectedElements.includes(border.id)) {
                borderPath.setAttribute('stroke-dasharray', '5,5');
                this.addControlPoints(layersGroup, border.points, border.id);
            }
            
            layersGroup.appendChild(borderPath);
        });
    }
    
    renderTextElements() {
        const currentPage = this.comicData.pages[this.currentPageIndex];
        const layersGroup = this.svgEditor.querySelector('.comic-layers') as SVGGElement;
        
        if (!currentPage.textElements) return;
        
        currentPage.textElements.forEach((textElement: TextElement) => {
            //Check if text element's layer is visible
            const layer = currentPage.layers.find((l: Layer) => l.id === textElement.layerId);
            if (!layer || !layer.visible) return;
            
            //Create text group
            const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            textGroup.classList.add('comic-text');
            textGroup.setAttribute('data-id', textElement.id);
            textGroup.setAttribute('data-layer', textElement.layerId);
            
            //Create foreign object for HTML text
            const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
            foreignObject.setAttribute('x', textElement.x.toString());
            foreignObject.setAttribute('y', textElement.y.toString());
            foreignObject.setAttribute('width', textElement.width.toString());
            foreignObject.setAttribute('height', textElement.height.toString());
            
            //Create div for text content
            const textDiv = document.createElement('div');
            textDiv.style.width = '100%';
            textDiv.style.height = '100%';
            textDiv.style.fontFamily = textElement.fontFamily;
            textDiv.style.fontSize = `${textElement.fontSize}px`;
            textDiv.style.color = textElement.color;
            textDiv.style.textAlign = textElement.textAlign;
            textDiv.style.overflow = 'hidden';
            textDiv.innerHTML = textElement.text;
            
            foreignObject.appendChild(textDiv);
            textGroup.appendChild(foreignObject);
            
            //Add container rectangle if selected
            if (this.selectedElements.includes(textElement.id)) {
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', textElement.x.toString());
                rect.setAttribute('y', textElement.y.toString());
                rect.setAttribute('width', textElement.width.toString());
                rect.setAttribute('height', textElement.height.toString());
                rect.setAttribute('fill', 'none');
                rect.setAttribute('stroke', '#4285f4');
                rect.setAttribute('stroke-width', '1');
                rect.setAttribute('stroke-dasharray', '5,5');
                
                textGroup.appendChild(rect);
                
                //Add control points
                this.addControlPoints(textGroup, [
                    { x: textElement.x, y: textElement.y },
                    { x: textElement.x + textElement.width, y: textElement.y },
                    { x: textElement.x + textElement.width, y: textElement.y + textElement.height },
                    { x: textElement.x, y: textElement.y + textElement.height }
                ]);
            }
            
            layersGroup.appendChild(textGroup);
        });
    }
    
    addControlPoints(container: SVGElement, points: Point[], id?: string) {
        points.forEach((point, index) => {
            const controlPoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            controlPoint.setAttribute('cx', point.x.toString());
            controlPoint.setAttribute('cy', point.y.toString());
            controlPoint.setAttribute('r', '5');
            controlPoint.setAttribute('fill', '#4285f4');
            controlPoint.setAttribute('stroke', '#ffffff');
            controlPoint.setAttribute('stroke-width', '2');
            controlPoint.classList.add('control-point');
            controlPoint.setAttribute('data-index', index.toString());
            if (id) controlPoint.setAttribute('data-id', id);
            
            container.appendChild(controlPoint);
        });
    }
    
    getTransformedPoint(e: MouseEvent): Point {
        //Get SVG bounding rectangle
        const svgRect = this.svgEditor.getBoundingClientRect();
        
        //Calculate point
        const x = (e.clientX - svgRect.left) / this.zoom - this.panOffset.x;
        const y = (e.clientY - svgRect.top) / this.zoom - this.panOffset.y;
        
        return { x, y };
    }
    
    handleMouseDown(e: MouseEvent) {
        //Get transformed point
        const point = this.getTransformedPoint(e);
        
        //Store starting point for pan/drag operations
        this.dragStartPoint = { ...point };
        
        //Handle based on current mode
        switch (this.mode) {
            case EditorMode.PAN:
                this.isPanning = true;
                this.lastPanPoint = { ...point };
                this.svgEditor.style.cursor = 'grabbing';
                break;
                
            case EditorMode.SELECT:
                //Check if clicked on a control point
                const controlPoint = e.target as SVGElement;
                if (controlPoint.classList.contains('control-point')) {
                    //Start dragging control point
                    this.isDragging = true;
                    return;
                }
                
                //Check if clicked on an element
                const element = this.findElementAtPoint(point);
                
                if (element) {
                    //Update selection
                    if (!e.shiftKey) {
                        this.selectedElements = [element.id];
                    } else if (!this.selectedElements.includes(element.id)) {
                        this.selectedElements.push(element.id);
                    }
                    
                    //Start dragging element
                    this.isDragging = true;
                } else if (!e.shiftKey) {
                    //Clear selection if not adding to selection
                    this.selectedElements = [];
                }
                
                //Redraw to update selection visuals
                this.loadCurrentPage();
                break;
                
            case EditorMode.DRAW_PANEL:
            case EditorMode.DRAW_BORDER:
                //Start drawing
                this.isDrawing = true;
                this.drawingPoints = [{ ...point }];
                break;
                
            case EditorMode.ADD_IMAGE:
                //Open image selector modal
                this.openImageSelector(point);
                break;
                
            case EditorMode.TEXT:
                //Create new text element
                this.createTextElement(point);
                break;
        }
    }
    
    handleMouseMove(e: MouseEvent) {
        //Get transformed point
        const point = this.getTransformedPoint(e);
        
        //Apply snap if needed
        let snappedPoint = { ...point };
        if (this.snapToGrid) {
            snappedPoint.x = Math.round(point.x / this.gridSize) * this.gridSize;
            snappedPoint.y = Math.round(point.y / this.gridSize) * this.gridSize;
        }
        
        //Handle based on current mode
        if (this.isPanning) {
            //Pan the view
            this.panOffset.x += (point.x - this.lastPanPoint.x);
            this.panOffset.y += (point.y - this.lastPanPoint.y);
            
            //Update transform
            const layersGroup = this.svgEditor.querySelector('.comic-layers') as SVGGElement;
            layersGroup.setAttribute('transform', 
                `translate(${this.panOffset.x},${this.panOffset.y}) scale(${this.zoom})`
            );
            
            //Update last pan point
            this.lastPanPoint = { ...point };
            
        } else if (this.isDrawing) {
            //If holding Ctrl key, create straight lines
            if (e.ctrlKey) {
                //Get last point
                const lastPoint = this.drawingPoints[this.drawingPoints.length - 1];
                
                //Calculate angle
                const angle = Math.atan2(snappedPoint.y - lastPoint.y, snappedPoint.x - lastPoint.x);
                let snappedAngle = angle;
                
                //Snap angle if needed
                if (this.snapToAngle) {
                    //Convert to degrees and snap
                    const degrees = angle * (180 / Math.PI);
                    const snappedDegrees = Math.round(degrees / this.snapAngle) * this.snapAngle;
                    
                    //Convert back to radians
                    snappedAngle = snappedDegrees * (Math.PI / 180);
                }
                
                //Calculate distance
                const distance = Math.sqrt(
                    Math.pow(snappedPoint.x - lastPoint.x, 2) + 
                    Math.pow(snappedPoint.y - lastPoint.y, 2)
                );
                
                //Calculate new point based on snapped angle
                snappedPoint = {
                    x: lastPoint.x + Math.cos(snappedAngle) * distance,
                    y: lastPoint.y + Math.sin(snappedAngle) * distance
                };
                
                //Snap to grid if needed
                if (this.snapToGrid) {
                    snappedPoint.x = Math.round(snappedPoint.x / this.gridSize) * this.gridSize;
                    snappedPoint.y = Math.round(snappedPoint.y / this.gridSize) * this.gridSize;
                }
            }
            
            //Update drawing preview
            this.updateDrawingPreview(snappedPoint);
            
        } else if (this.isDragging) {
            //Check if dragging a control point
            const controlPoint = e.target as SVGElement;
            if (controlPoint.classList.contains('control-point')) {
                const index = parseInt(controlPoint.getAttribute('data-index') || '0');
                const id = controlPoint.getAttribute('data-id');
                
                //Update the control point position
                this.updateControlPoint(id || this.selectedElements[0], index, snappedPoint);
                return;
            }
            
            //Move selected elements
            if (this.selectedElements.length > 0 && this.dragStartPoint) {
                const deltaX = snappedPoint.x - this.dragStartPoint.x;
                const deltaY = snappedPoint.y - this.dragStartPoint.y;
                
                //Move all selected elements
                this.moveSelectedElements(deltaX, deltaY);
                
                //Update drag start point
                this.dragStartPoint = { ...snappedPoint };
            }
        }
    }
    
    handleMouseUp(e: MouseEvent) {
        //Get transformed point
        const point = this.getTransformedPoint(e);
        
        //Apply snap if needed
        let snappedPoint = { ...point };
        if (this.snapToGrid) {
            snappedPoint.x = Math.round(point.x / this.gridSize) * this.gridSize;
            snappedPoint.y = Math.round(point.y / this.gridSize) * this.gridSize;
        }
        
        //Handle based on current state
        if (this.isPanning) {
            this.isPanning = false;
            this.lastPanPoint = null;
            this.svgEditor.style.cursor = 'default';
        } else if (this.isDrawing) {
            //If drawing a path and it has enough points, finish it
            if (this.drawingPoints.length > 1) {
                //Finish drawing
                if (this.mode === EditorMode.DRAW_PANEL) {
                    this.finishPanelDrawing();
                } else if (this.mode === EditorMode.DRAW_BORDER) {
                    this.finishBorderDrawing();
                }
            }
            
            //Reset drawing state
            this.isDrawing = false;
            this.drawingPoints = [];
            
            //Remove drawing preview
            const preview = this.svgEditor.querySelector('.drawing-preview');
            if (preview) preview.remove();
        } else if (this.isDragging) {
            this.isDragging = false;
            this.dragStartPoint = null;
        }
    }
    
    handleWheel(e: WheelEvent) {
        e.preventDefault();
        
        //Zoom in/out
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom *= delta;
        
        //Clamp zoom level
        this.zoom = Math.max(0.1, Math.min(5, this.zoom));
        
        //Update transform
        const layersGroup = this.svgEditor.querySelector('.comic-layers') as SVGGElement;
        layersGroup.setAttribute('transform', 
            `translate(${this.panOffset.x},${this.panOffset.y}) scale(${this.zoom})`
        );
    }
    
    handleKeyDown(e: KeyboardEvent) {
        //Handle key commands
        switch (e.key) {
            case 'Delete':
            case 'Backspace':
                //Delete selected elements
                this.deleteSelectedElements();
                break;
                
            case 'Escape':
                //Clear selection
                this.selectedElements = [];
                this.loadCurrentPage();
                break;
                
            case 's':
                if (e.ctrlKey) {
                    //Save comic
                    e.preventDefault();
                    this.saveComic();
                }
                break;
                
            case 'g':
                //Toggle grid
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.snapToGrid = !this.snapToGrid;
                    this.drawGrid(
                        this.svgEditor.querySelector('.comic-grid') as SVGGElement, 
                        this.comicData.pages[this.currentPageIndex].width, 
                        this.comicData.pages[this.currentPageIndex].height
                    );
                }
                break;
        }
    }
    
    handleKeyUp(e: KeyboardEvent) {
        //Nothing specific to handle yet
    }
    
    updateDrawingPreview(point: Point) {
        //Remove existing preview
        let preview = this.svgEditor.querySelector('.drawing-preview');
        if (!preview) {
            //Create preview element
            preview = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            preview.classList.add('drawing-preview');
            preview.setAttribute('fill', 'none');
            preview.setAttribute('stroke', this.mode === EditorMode.DRAW_PANEL ? '#999999' : this.borderColor);
            preview.setAttribute('stroke-width', this.mode === EditorMode.DRAW_PANEL ? '1' : this.borderWidth.toString());
            preview.setAttribute('stroke-dasharray', '5,5');
            
            const layersGroup = this.svgEditor.querySelector('.comic-layers') as SVGGElement;
            layersGroup.appendChild(preview);
        }
        
        //Create path from drawing points
        const points = [...this.drawingPoints, point];
        preview.setAttribute('d', pointsToPath(points));
    }
    
    finishPanelDrawing() {
        //Create a panel from the drawn points
        const panel: Panel = {
            id: generateUUID(),
            imagePath: '',
            clipPath: pointsToPath(this.drawingPoints),
            points: [...this.drawingPoints],
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            rotation: 0,
            layerId: this.currentLayer
        };
        
        //Calculate bounding box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        this.drawingPoints.forEach(point => {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        });
        
        panel.x = minX;
        panel.y = minY;
        panel.width = maxX - minX;
        panel.height = maxY - minY;
        
        //Add panel to the current page
        const currentPage = this.comicData.pages[this.currentPageIndex];
        if (!currentPage.panels) currentPage.panels = [];
        currentPage.panels.push(panel);
        
        //Add panel ID to current layer
        const layer = currentPage.layers.find(l => l.id === this.currentLayer);
        if (layer) {
            layer.elements.push(panel.id);
        }
        
        //Redraw the page
        this.loadCurrentPage();
        
        //Open image selector to add image to panel
        this.openImageSelector(null, panel.id);
    }
    
    finishBorderDrawing() {
        //Create a border from the drawn points
        const border: Border = {
            id: generateUUID(),
            points: [...this.drawingPoints],
            strokeWidth: this.borderWidth,
            strokeColor: this.borderColor,
            layerId: this.currentLayer
        };
        
        //Add border to the current page
        const currentPage = this.comicData.pages[this.currentPageIndex];
        if (!currentPage.borders) currentPage.borders = [];
        currentPage.borders.push(border);
        
        //Add border ID to current layer
        const layer = currentPage.layers.find(l => l.id === this.currentLayer);
        if (layer) {
            layer.elements.push(border.id);
        }
        
        //Redraw the page
        this.loadCurrentPage();
    }
    
    createTextElement(point: Point) {
        //Create new text element
        const textElement: TextElement = {
            id: generateUUID(),
            text: 'Double-click to edit text',
            x: point.x,
            y: point.y,
            width: 200,
            height: 100,
            fontSize: this.fontSize,
            fontFamily: this.fontFamily,
            textAlign: 'left',
            color: this.textColor,
            layerId: this.currentLayer
        };
        
        //Add text element to the current page
        const currentPage = this.comicData.pages[this.currentPageIndex];
        if (!currentPage.textElements) currentPage.textElements = [];
        currentPage.textElements.push(textElement);
        
        //Add text element ID to current layer
        const layer = currentPage.layers.find(l => l.id === this.currentLayer);
        if (layer) {
            layer.elements.push(textElement.id);
        }
        
        //Redraw the page
        this.loadCurrentPage();
    }
    
    async openImageSelector(point: Point | null, panelId?: string) {
        //Open image selector modal
        const modal = new ImageSelectorModal(this.app);
        const imagePath = await modal.selectImage();
        
        if (!imagePath) return;
        
        //If panel ID is provided, update the panel with the image
        if (panelId) {
            const currentPage = this.comicData.pages[this.currentPageIndex];
            const panel = currentPage.panels.find((p: Panel) => p.id === panelId);
            
            if (panel) {
                panel.imagePath = imagePath;
                this.loadCurrentPage();
            }
        } else if (point) {
            //Create a new panel at the point
            const panel: Panel = {
                id: generateUUID(),
                imagePath: imagePath,
                clipPath: '',
                points: [],
                x: point.x,
                y: point.y,
                width: 300,
                height: 300,
                rotation: 0,
                layerId: this.currentLayer
            };
            
            //Create rectangular clip path
            panel.points = [
                { x: point.x, y: point.y },
                { x: point.x + 300, y: point.y },
                { x: point.x + 300, y: point.y + 300 },
                { x: point.x, y: point.y + 300 }
            ];
            
            panel.clipPath = pointsToPath(panel.points);
            
            //Add panel to the current page
            const currentPage = this.comicData.pages[this.currentPageIndex];
            if (!currentPage.panels) currentPage.panels = [];
            currentPage.panels.push(panel);
            
            //Add panel ID to current layer
            const layer = currentPage.layers.find(l => l.id === this.currentLayer);
            if (layer) {
                layer.elements.push(panel.id);
            }
            
            //Redraw the page
            this.loadCurrentPage();
        }
    }
    
    findElementAtPoint(point: Point): { id: string, type: string } | null {
        const currentPage = this.comicData.pages[this.currentPageIndex];
        
        //Check panels
        if (currentPage.panels) {
            for (const panel of currentPage.panels) {
                //Check if panel is in a visible layer
                const layer = currentPage.layers.find(l => l.id === panel.layerId);
                if (!layer || !layer.visible) continue;
                
                //Check if point is inside panel
                if (this.pointInPath(point, panel.clipPath)) {
                    return { id: panel.id, type: 'panel' };
                }
            }
        }
        
        //Check borders
        if (currentPage.borders) {
            for (const border of currentPage.borders) {
                //Check if border is in a visible layer
                const layer = currentPage.layers.find(l => l.id === border.layerId);
                if (!layer || !layer.visible) continue;
                
                //Check if point is near the border path
                if (this.pointNearPath(point, border.points, 10)) {
                    return { id: border.id, type: 'border' };
                }
            }
        }
        
        //Check text elements
        if (currentPage.textElements) {
            for (const text of currentPage.textElements) {
                //Check if text is in a visible layer
                const layer = currentPage.layers.find(l => l.id === text.layerId);
                if (!layer || !layer.visible) continue;
                
                //Check if point is inside text element
                if (point.x >= text.x && point.x <= text.x + text.width &&
                    point.y >= text.y && point.y <= text.y + text.height) {
                    return { id: text.id, type: 'text' };
                }
            }
        }
        
        return null;
    }
    
    pointInPath(point: Point, pathString: string): boolean {
        //Convert path to points
        const points = pathToPoints(pathString);
        
        //Check if point is inside polygon
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i].x, yi = points[i].y;
            const xj = points[j].x, yj = points[j].y;
            
            const intersect = ((yi > point.y) != (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        
        return inside;
    }
    
    pointNearPath(point: Point, pathPoints: Point[], threshold: number): boolean {
        //Check distance from point to each line segment
        for (let i = 0; i < pathPoints.length; i++) {
            const j = (i + 1) % pathPoints.length;
            const p1 = pathPoints[i];
            const p2 = pathPoints[j];
            
            //Calculate distance from point to line segment
            const distance = this.distanceToLineSegment(point, p1, p2);
            
            if (distance <= threshold) {
                return true;
            }
        }
        
        return false;
    }
    
    distanceToLineSegment(point: Point, lineStart: Point, lineEnd: Point): number {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        
        let xx, yy;
        
        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;
            yy = lineStart.y + param * D;
        }
        
        const dx = point.x - xx;
        const dy = point.y - yy;
        
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    updateControlPoint(elementId: string, pointIndex: number, newPosition: Point) {
        const currentPage = this.comicData.pages[this.currentPageIndex];
        
        //Find the element
        let element;
        let elementType = '';
        
        if (currentPage.panels) {
            element = currentPage.panels.find(p => p.id === elementId);
            if (element) elementType = 'panel';
        }
        
        if (!element && currentPage.borders) {
            element = currentPage.borders.find(b => b.id === elementId);
            if (element) elementType = 'border';
        }
        
        if (!element && currentPage.textElements) {
            element = currentPage.textElements.find(t => t.id === elementId);
            if (element) elementType = 'text';
        }
        
        if (!element) return;
        
        //Update the point
        if (elementType === 'panel' || elementType === 'border') {
            if (pointIndex < element.points.length) {
                element.points[pointIndex] = newPosition;
                
                //Update clip path for panels
                if (elementType === 'panel') {
                    element.clipPath = pointsToPath(element.points);
                    
                    //Recalculate bounding box
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    
                    element.points.forEach(point => {
                        minX = Math.min(minX, point.x);
                        minY = Math.min(minY, point.y);
                        maxX = Math.max(maxX, point.x);
                        maxY = Math.max(maxY, point.y);
                    });
                    
                    element.x = minX;
                    element.y = minY;
                    element.width = maxX - minX;
                    element.height = maxY - minY;
                }
            }
        } else if (elementType === 'text') {
            //Update text element based on control point index
            switch(pointIndex) {
                case 0: //Top-left
                    const width = element.x + element.width - newPosition.x;
                    const height = element.y + element.height - newPosition.y;
                    element.x = newPosition.x;
                    element.y = newPosition.y;
                    element.width = width;
                    element.height = height;
                    break;
                case 1: //Top-right
                    element.width = newPosition.x - element.x;
                    element.y = newPosition.y;
                    element.height = element.y + element.height - newPosition.y;
                    break;
                case 2: //Bottom-right
                    element.width = newPosition.x - element.x;
                    element.height = newPosition.y - element.y;
                    break;
                case 3: //Bottom-left
                    element.width = element.x + element.width - newPosition.x;
                    element.x = newPosition.x;
                    element.height = newPosition.y - element.y;
                    break;
            }
        }
        
        //Redraw
        this.loadCurrentPage();
    }
    
    moveSelectedElements(deltaX: number, deltaY: number) {
        const currentPage = this.comicData.pages[this.currentPageIndex];
        
        this.selectedElements.forEach(elementId => {
            //Find the element
            let element;
            let elementType = '';
            
            if (currentPage.panels) {
                element = currentPage.panels.find(p => p.id === elementId);
                if (element) elementType = 'panel';
            }
            
            if (!element && currentPage.borders) {
                element = currentPage.borders.find(b => b.id === elementId);
                if (element) elementType = 'border';
            }
            
            if (!element && currentPage.textElements) {
                element = currentPage.textElements.find(t => t.id === elementId);
                if (element) elementType = 'text';
            }
            
            if (!element) return;
            
            //Move the element
            if (elementType === 'panel') {
                //Move panel position
                element.x += deltaX;
                element.y += deltaY;
                
                //Move all points
                element.points.forEach(point => {
                    point.x += deltaX;
                    point.y += deltaY;
                });
                
                //Update clip path
                element.clipPath = pointsToPath(element.points);
                
            } else if (elementType === 'border') {
                //Move border points
                element.points.forEach(point => {
                    point.x += deltaX;
                    point.y += deltaY;
                });
                
            } else if (elementType === 'text') {
                //Move text position
                element.x += deltaX;
                element.y += deltaY;
            }
        });
        
        //Redraw
        this.loadCurrentPage();
    }
    
    deleteSelectedElements() {
        if (this.selectedElements.length === 0) return;
        
        const currentPage = this.comicData.pages[this.currentPageIndex];
        
        this.selectedElements.forEach(elementId => {
            //Remove from panels
            if (currentPage.panels) {
                currentPage.panels = currentPage.panels.filter(p => p.id !== elementId);
            }
            
            //Remove from borders
            if (currentPage.borders) {
                currentPage.borders = currentPage.borders.filter(b => b.id !== elementId);
            }
            
            //Remove from text elements
            if (currentPage.textElements) {
                currentPage.textElements = currentPage.textElements.filter(t => t.id !== elementId);
            }
            
            //Remove from layers
            currentPage.layers.forEach(layer => {
                layer.elements = layer.elements.filter(id => id !== elementId);
            });
        });
        
        //Clear selection
        this.selectedElements = [];
        
        //Redraw
        this.loadCurrentPage();
    }
    
    nextPage() {
        if (this.currentPageIndex < this.comicData.pages.length - 1) {
            this.currentPageIndex++;
            this.loadCurrentPage();
        }
    }
    
    previousPage() {
        if (this.currentPageIndex > 0) {
            this.currentPageIndex--;
            this.loadCurrentPage();
        }
    }
    
    addNewPage() {
        //Create new page
        const newPageIndex = this.comicData.pages.length;
        const newPage = this.plugin.createEmptyPage(`Page ${newPageIndex + 1}`);
        
        //Add page to comic
        this.comicData.pages.push(newPage);
        
        //Go to new page
        this.currentPageIndex = newPageIndex;
        this.loadCurrentPage();
        
        //Update
        new Notice(`Added new page ${newPageIndex + 1}`);
    }
    
    async saveComic() {
        //Update modified timestamp
        this.comicData.modified = Date.now();
        
        //Save to file
        const success = await this.plugin.saveComic(this.filePath, this.comicData);
        
        if (success) {
            new Notice(`Comic saved: ${this.comicData.name}`);
        }
    }
    
    openReaderView() {
        //Save changes first
        this.saveComic().then(() => {
            //Open in reader view
            this.plugin.activateReaderView(this.filePath);
        });
    }
    
    onToolChange(tool: string) {
        //Update mode based on selected tool
        switch(tool) {
            case 'select':
                this.mode = EditorMode.SELECT;
                break;
            case 'pan':
                this.mode = EditorMode.PAN;
                break;
            case 'draw-panel':
                this.mode = EditorMode.DRAW_PANEL;
                break;
            case 'draw-border':
                this.mode = EditorMode.DRAW_BORDER;
                break;
            case 'add-image':
                this.mode = EditorMode.ADD_IMAGE;
                break;
            case 'text':
                this.mode = EditorMode.TEXT;
                break;
            case 'grid-toggle':
                this.snapToGrid = !this.snapToGrid;
                this.drawGrid(
                    this.svgEditor.querySelector('.comic-grid') as SVGGElement, 
                    this.comicData.pages[this.currentPageIndex].width, 
                    this.comicData.pages[this.currentPageIndex].height
                );
                break;
        }
    }
    
    onLayerChange(layerId: string, action: string, data?: any) {
        const currentPage = this.comicData.pages[this.currentPageIndex];
        
        switch(action) {
            case 'select':
                this.currentLayer = layerId;
                break;
                
            case 'toggle-visibility':
                const layer = currentPage.layers.find(l => l.id === layerId);
                if (layer) {
                    layer.visible = !layer.visible;
                    this.loadCurrentPage();
                }
                break;
                
            case 'toggle-lock':
                const lockLayer = currentPage.layers.find(l => l.id === layerId);
                if (lockLayer) {
                    lockLayer.locked = !lockLayer.locked;
                }
                break;
                
            case 'rename':
                const renameLayer = currentPage.layers.find(l => l.id === layerId);
                if (renameLayer && data) {
                    renameLayer.name = data;
                }
                break;
                
            case 'add':
                //Create new layer
                const newLayer: Layer = {
                    id: generateUUID(),
                    name: data || `Layer ${currentPage.layers.length + 1}`,
                    visible: true,
                    locked: false,
                    elements: []
                };
                
                currentPage.layers.push(newLayer);
                this.currentLayer = newLayer.id;
                this.layerManager.updateLayers(currentPage.layers);
                this.layerManager.setActiveLayer(newLayer.id);
                break;
                
            case 'remove':
                //Check if layer has elements
                const layerToRemove = currentPage.layers.find(l => l.id === layerId);
                if (layerToRemove && layerToRemove.elements.length > 0) {
                    new Notice(`Cannot remove layer with elements. Move or delete elements first.`);
                    return;
                }
                
                //Remove layer
                currentPage.layers = currentPage.layers.filter(l => l.id !== layerId);
                
                //Set current layer to first available layer
                if (currentPage.layers.length > 0) {
                    this.currentLayer = currentPage.layers[0].id;
                    this.layerManager.setActiveLayer(this.currentLayer);
                }
                
                this.layerManager.updateLayers(currentPage.layers);
                break;
                
            case 'move-up':
                //Move layer up in the stack
                const layerIndex = currentPage.layers.findIndex(l => l.id === layerId);
                if (layerIndex > 0) {
                    //Swap with the layer above
                    const temp = currentPage.layers[layerIndex];
                    currentPage.layers[layerIndex] = currentPage.layers[layerIndex - 1];
                    currentPage.layers[layerIndex - 1] = temp;
                    
                    this.layerManager.updateLayers(currentPage.layers);
                    this.loadCurrentPage();
                }
                break;
                
            case 'move-down':
                //Move layer down in the stack
                const index = currentPage.layers.findIndex(l => l.id === layerId);
                if (index < currentPage.layers.length - 1) {
                    //Swap with the layer below
                    const temp = currentPage.layers[index];
                    currentPage.layers[index] = currentPage.layers[index + 1];
                    currentPage.layers[index + 1] = temp;
                    
                    this.layerManager.updateLayers(currentPage.layers);
                    this.loadCurrentPage();
                }
                break;
        }
    }
}