import { ItemView, WorkspaceLeaf, setIcon, Notice, TFile } from 'obsidian';
import { node } from 'utils';
import ComicCreatorPlugin from '../main';

export class ComicReaderView extends ItemView {
    private plugin: ComicCreatorPlugin;
    private filePath: string;
    private comicData: any;
    private currentPageIndex: number = 0;
    private containerEl: HTMLElement;
    private pageContainer: HTMLElement;
    private fullscreenMode: boolean = false;
    private touchStartX: number = 0;
    private touchStartTime: number = 0;

    constructor(leaf: WorkspaceLeaf, plugin: ComicCreatorPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return 'comic-reader-view';
    }

    getDisplayText(): string {
        return 'Comic Reader';
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
                throw new Error(`Invalid comic format: Missing pages array`);
            }
        } catch (error) {
            console.error('Failed to load comic data:', error);
            new Notice(`Failed to load comic: ${error.message}`);
            this.contentEl.setText(`Error: ${error.message}`);
        }
    }
    
    createUI() {
        this.contentEl.empty();
        
        //Create main container
        this.containerEl = node('div', { class: 'comic-reader-container' });
        
        //Create toolbar
        const toolbar = node('div', { class: 'comic-reader-toolbar' });
        
        //Create page container
        this.pageContainer = node('div', { class: 'comic-reader-page-container' });
        
        //Create navigation controls
        const navControls = node('div', { class: 'comic-reader-nav-controls' });
        
        //Create info bar
        const infoBar = node('div', { 
            class: 'comic-reader-info-bar',
            text: `${this.comicData.name} - Page ${this.currentPageIndex + 1} of ${this.comicData.pages.length}`
        });
        
        //Create toolbar buttons
        const editButton = node('button', { 
            class: 'comic-reader-button', 
            attributes: { 'aria-label': 'Edit Comic', 'title': 'Edit Comic' }
        });
        setIcon(editButton, 'pencil');
        
        const fullscreenButton = node('button', { 
            class: 'comic-reader-button', 
            attributes: { 'aria-label': 'Fullscreen Mode', 'title': 'Fullscreen Mode' }
        });
        setIcon(fullscreenButton, 'maximize-2');
        
        //Create navigation buttons
        const prevButton = node('button', { 
            class: 'comic-reader-nav-button', 
            attributes: { 'aria-label': 'Previous Page', 'title': 'Previous Page' }
        });
        setIcon(prevButton, 'chevron-left');
        
        const nextButton = node('button', { 
            class: 'comic-reader-nav-button', 
            attributes: { 'aria-label': 'Next Page', 'title': 'Next Page' }
        });
        setIcon(nextButton, 'chevron-right');
        
        //Add event listeners
        editButton.addEventListener('click', () => this.openInEditor());
        fullscreenButton.addEventListener('click', () => this.toggleFullscreen());
        prevButton.addEventListener('click', () => this.previousPage());
        nextButton.addEventListener('click', () => this.nextPage());
        
        //Add elements to containers
        toolbar.appendChild(editButton);
        toolbar.appendChild(fullscreenButton);
        toolbar.appendChild(infoBar);
        
        navControls.appendChild(prevButton);
        navControls.appendChild(nextButton);
        
        this.containerEl.appendChild(toolbar);
        this.containerEl.appendChild(this.pageContainer);
        this.containerEl.appendChild(navControls);
        
        this.contentEl.appendChild(this.containerEl);
        
        //Load the current page
        this.renderCurrentPage();
        
        //Setup touch events for mobile navigation
        this.setupTouchEvents();
        
        //Setup keyboard shortcuts
        this.setupKeyboardEvents();
    }
    
    renderCurrentPage() {
        this.pageContainer.empty();
        
        if (this.currentPageIndex < 0 || this.currentPageIndex >= this.comicData.pages.length) {
            this.pageContainer.setText('Invalid page index');
            return;
        }
        
        const currentPage = this.comicData.pages[this.currentPageIndex];
        
        //Update info bar
        const infoBar = this.containerEl.querySelector('.comic-reader-info-bar');
        if (infoBar) {
            infoBar.textContent = `${this.comicData.name} - Page ${this.currentPageIndex + 1} of ${this.comicData.pages.length}`;
        }
        
        //Create SVG container
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', currentPage.width.toString());
        svg.setAttribute('height', currentPage.height.toString());
        svg.setAttribute('viewBox', `0 0 ${currentPage.width} ${currentPage.height}`);
        svg.classList.add('comic-reader-svg');
        
        //Create page background
        const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        background.setAttribute('width', currentPage.width.toString());
        background.setAttribute('height', currentPage.height.toString());
        background.setAttribute('fill', '#ffffff');
        svg.appendChild(background);
        
        //Render panels
        if (currentPage.panels) {
            //Sort panels by layer order
            const layeredPanels = [...currentPage.panels].sort((a, b) => {
                const layerA = currentPage.layers.findIndex((l:any) => l.id === a.layerId);
                const layerB = currentPage.layers.findIndex((l:any) => l.id === b.layerId);
                return layerA - layerB;
            });
            
            layeredPanels.forEach(panel => {
                //Check if layer is visible
                const layer = currentPage.layers.find((l:any) => l.id === panel.layerId);
                if (!layer || !layer.visible) return;
                
                //Create panel group
                const panelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                panelGroup.classList.add('comic-reader-panel');
                
                //Create clip path for image
                const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
                clipPath.setAttribute('id', `clip-${panel.id}`);
                
                const clipPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                clipPathElement.setAttribute('d', panel.clipPath);
                clipPath.appendChild(clipPathElement);
                
                //Add clip path to defs
                let defs = svg.querySelector('defs');
                if (!defs) {
                    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                    svg.appendChild(defs);
                }
                defs.appendChild(clipPath);
                
                //Create image if it exists
                if (panel.imagePath) {
                    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
                    
                    //Try to get the image resource
                    try {
                        const file = this.app.vault.getAbstractFileByPath(panel.imagePath);
                        if (file instanceof TFile) {
                            image.setAttribute('href', this.app.vault.getResourcePath(file));
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
                    } catch (error) {
                        console.error(`Failed to load image: ${panel.imagePath}`, error);
                    }
                }
                
                svg.appendChild(panelGroup);
            });
        }
        
        //Render borders
        if (currentPage.borders) {
            //Sort borders by layer order
            const layeredBorders = [...currentPage.borders].sort((a, b) => {
                const layerA = currentPage.layers.findIndex((l:any) => l.id === a.layerId);
                const layerB = currentPage.layers.findIndex((l:any) => l.id === b.layerId);
                return layerA - layerB;
            });
            
            layeredBorders.forEach(border => {
                //Check if layer is visible
                const layer = currentPage.layers.find((l:any) => l.id === border.layerId);
                if (!layer || !layer.visible) return;
                
                //Create border path
                const borderPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                borderPath.classList.add('comic-reader-border');
                
                //Convert points to SVG path
                let pathData = "";
                if (border.points.length > 0) {
                    pathData = `M ${border.points[0].x} ${border.points[0].y}`;
                    for (let i = 1; i < border.points.length; i++) {
                        pathData += ` L ${border.points[i].x} ${border.points[i].y}`;
                    }
                    //Close the path if there are at least 3 points
                    if (border.points.length >= 3) {
                        pathData += " Z";
                    }
                }
                
                borderPath.setAttribute('d', pathData);
                borderPath.setAttribute('fill', 'none');
                borderPath.setAttribute('stroke', border.strokeColor);
                borderPath.setAttribute('stroke-width', border.strokeWidth.toString());
                
                svg.appendChild(borderPath);
            });
        }
        
        //Render text elements
        if (currentPage.textElements) {
            //Sort text elements by layer order
            const layeredTexts = [...currentPage.textElements].sort((a, b) => {
                const layerA = currentPage.layers.findIndex((l:any) => l.id === a.layerId);
                const layerB = currentPage.layers.findIndex((l:any) => l.id === b.layerId);
                return layerA - layerB;
            });
            
            layeredTexts.forEach(textElement => {
                //Check if layer is visible
                const layer = currentPage.layers.find((l:any) => l.id === textElement.layerId);
                if (!layer || !layer.visible) return;
                
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
                svg.appendChild(foreignObject);
            });
        }
        
        this.pageContainer.appendChild(svg);
        
        //Add page number indicators
        const pageIndicators = node('div', { class: 'comic-reader-page-indicators' });
        
        for (let i = 0; i < this.comicData.pages.length; i++) {
            const indicator = node('div', { 
                class: `comic-reader-page-indicator ${i === this.currentPageIndex ? 'active' : ''}`,
                attributes: { 'data-page': i.toString() }
            });
            
            indicator.addEventListener('click', () => {
                this.currentPageIndex = i;
                this.renderCurrentPage();
            });
            
            pageIndicators.appendChild(indicator);
        }
        
        this.pageContainer.appendChild(pageIndicators);
    }
    
    setupTouchEvents() {
        this.pageContainer.addEventListener('touchstart', (e) => {
            this.touchStartX = e.touches[0].clientX;
            this.touchStartTime = Date.now();
        });
        
        this.pageContainer.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndTime = Date.now();
            
            const touchDuration = touchEndTime - this.touchStartTime;
            const touchDeltaX = touchEndX - this.touchStartX;
            
            //Check if it was a swipe gesture (fast and long enough)
            if (touchDuration < 300 && Math.abs(touchDeltaX) > 50) {
                if (touchDeltaX > 0) {
                    //Swipe right - go to previous page
                    this.previousPage();
                } else {
                    //Swipe left - go to next page
                    this.nextPage();
                }
            }
        });
    }
    
    setupKeyboardEvents() {
        //Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            //Only handle events when this view is active
            if (!this.containerEl.classList.contains('is-active')) return;
            
            switch (e.key) {
                case 'ArrowLeft':
                    this.previousPage();
                    break;
                case 'ArrowRight':
                    this.nextPage();
                    break;
                case 'Escape':
                    if (this.fullscreenMode) {
                        this.toggleFullscreen();
                    }
                    break;
                case 'f':
                    this.toggleFullscreen();
                    break;
                case 'e':
                    this.openInEditor();
                    break;
            }
        });
    }
    
    previousPage() {
        if (this.currentPageIndex > 0) {
            this.currentPageIndex--;
            this.renderCurrentPage();
        }
    }
    
    nextPage() {
        if (this.currentPageIndex < this.comicData.pages.length - 1) {
            this.currentPageIndex++;
            this.renderCurrentPage();
        }
    }
    
    toggleFullscreen() {
        this.fullscreenMode = !this.fullscreenMode;
        
        if (this.fullscreenMode) {
            //Enter fullscreen mode
            this.containerEl.classList.add('fullscreen');
            document.body.classList.add('comic-reader-fullscreen');
            
            //Update button icon
            const fullscreenButton = this.containerEl.querySelector('.comic-reader-button[title="Fullscreen Mode"]');
            if (fullscreenButton) {
                fullscreenButton.innerHTML = '';
                setIcon(fullscreenButton as HTMLElement, 'minimize-2');
                fullscreenButton.setAttribute('title', 'Exit Fullscreen');
                fullscreenButton.setAttribute('aria-label', 'Exit Fullscreen');
            }
        } else {
            //Exit fullscreen mode
            this.containerEl.classList.remove('fullscreen');
            document.body.classList.remove('comic-reader-fullscreen');
            
            //Update button icon
            const fullscreenButton = this.containerEl.querySelector('.comic-reader-button[title="Exit Fullscreen"]');
            if (fullscreenButton) {
                fullscreenButton.innerHTML = '';
                setIcon(fullscreenButton as HTMLElement, 'maximize-2');
                fullscreenButton.setAttribute('title', 'Fullscreen Mode');
                fullscreenButton.setAttribute('aria-label', 'Fullscreen Mode');
            }
        }
        
        //Force redraw the current page for better sizing
        this.renderCurrentPage();
    }
    
    openInEditor() {
        this.plugin.activateEditorView(this.filePath);
    }
}