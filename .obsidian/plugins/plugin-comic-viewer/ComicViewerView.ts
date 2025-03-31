import { ItemView, WorkspaceLeaf, TFile, setIcon, Notice, Menu } from 'obsidian';
import ComicViewerPlugin from './main';
import { node } from './utils';

// Define interface for the new notes structure
interface PanelNote {
    index: number;
    text: string;
}

export class ComicViewerView extends ItemView {
    private plugin: ComicViewerPlugin;
    private comicData: any = null;
    private panelIndex: number = 0;
    private panelFiles: TFile[] = [];
    private displayMode: 'vertical' | 'horizontal';
    private filePath: string;

    private titleEl: HTMLElement;
    private subtitleEl: HTMLElement;
    private comicContainer: HTMLElement;
    private controlsContainer: HTMLElement;
    private panelsContainer: HTMLElement;

    private previousPanelButton: HTMLButtonElement;
    private nextPanelButton: HTMLButtonElement;
    private panelIndexLabel: HTMLElement;

    constructor(leaf: WorkspaceLeaf, plugin: ComicViewerPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return "comic-viewer-view";
    }

    getDisplayText(): string {
        return this.comicData?.title || "Comic Viewer";
    }

    getIcon(): string {
        return "comic-icon";
    }

    async updateComic(comicData: any, filePath: string) {
        console.log(comicData);

        this.comicData = comicData;
        this.filePath = filePath;
        this.displayMode = comicData.displayMode;

        this.panelIndex = 0;
        await this.loadPanelFiles();
        this.render();
        this.setupKeyboardNavigation();
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('comic-viewer-container');

        this.comicContainer = node('div', { class: 'comic-container' });

        this.titleEl = node('div', { class: 'comic-title', text: 'Loading...' });
        this.subtitleEl = node('div', { class: 'comic-subtitle', text: '...' });

        this.controlsContainer = node('div', { class: 'comic-controls' });
        this.panelsContainer = node('div', { class: 'comic-panels-container' });

        const titleContainer = node('div', { class: 'comic-title-container', children: [this.titleEl, this.subtitleEl] });

        this.comicContainer.appendChild(titleContainer);
        this.comicContainer.appendChild(this.controlsContainer);
        this.comicContainer.appendChild(this.panelsContainer);

        container.appendChild(this.comicContainer);
    }

    setupKeyboardNavigation() {
        this.containerEl.removeEventListener('keydown', this.handleKeyDown);
        this.containerEl.addEventListener('keydown', this.handleKeyDown);

        this.containerEl.setAttribute('tabindex', '0');
        this.containerEl.focus();
    }

    handleKeyDown = (e: KeyboardEvent) => {
        if (this.displayMode === 'vertical') {
            if (e.key === 'ArrowDown') {
                this.navigateToPanel(1)
                e.preventDefault();
            }
            else if (e.key === 'ArrowUp') {
                this.navigateToPanel(-1)
                e.preventDefault();
            }
        } else {
            if (e.key === 'ArrowRight') {
                this.navigateHorizontalPages(2);
                e.preventDefault();
            }
            else if (e.key === 'ArrowLeft') {
                this.navigateHorizontalPages(-2);
                e.preventDefault();
            }
        }
    }

    navigateToPanel(delta: number) {
        this.panelIndex += delta;
        this.panelIndex = Math.max(this.panelIndex, 0);
        this.panelIndex = Math.min(this.panelIndex, this.panelFiles.length - 1);
        const nextPanel = document.querySelector(`.panel-wrapper[data-index="${this.panelIndex}"]`);
        if (nextPanel) nextPanel.scrollIntoView({ behavior: 'smooth' });
        this.updateControls();
    }

    navigateHorizontalPages(delta: number) {
        this.panelIndex += delta;
        this.panelIndex = Math.max(this.panelIndex, 0);
        this.panelIndex = Math.min(this.panelIndex, this.panelFiles.length - 2);
        this.renderPanels();
        this.updateControls();
    }

    async loadPanelFiles() {
        this.panelFiles = [];

        if (!this.comicData || !this.comicData.folderPath) {
            return;
        }

        const folderPath = this.comicData.folderPath;
        const supportedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

        try {
            //Get images
            const allFiles = this.app.vault.getFiles();
            let imageFiles = allFiles.filter(file => { return file.path.startsWith(folderPath) && supportedExtensions.includes(file.extension.toLowerCase()); });
            imageFiles.sort((a, b) => a.name.localeCompare(b.name));
            this.panelFiles = imageFiles;
        } catch (error) {
            console.error("Error loading panel files:", error);
            new Notice(`Error loading comic panels: ${error.message}`);
        }
    }

    render() {
        this.titleEl.textContent = this.comicData.title;

        if (this.panelFiles.length === 0) {
            this.subtitleEl.textContent = 'No panels found in the selected folder';
            this.subtitleEl.classList.add('empty-warning');
        } else {
            this.subtitleEl.textContent = `${this.panelFiles.length} panels`;
            this.subtitleEl.classList.remove('empty-warning');
        }

        this.renderControls();
        this.renderPanels();
    }

    renderControls() {
        this.controlsContainer.empty();

        //View mode toggle
        const viewModeContainer = node('div', { class: 'control-group' });

        //Vertical button
        const verticalButton = node('button', { class: `view-mode-button ${this.displayMode === 'vertical' ? 'active' : ''}`, attributes: { 'title': 'Vertical Mode' } });
        verticalButton.addEventListener('click', () => this.setDisplayMode('vertical'));
        setIcon(verticalButton, 'rows-2');

        //Horizontal button
        const horizontalButton = node('button', { class: `view-mode-button ${this.displayMode === 'horizontal' ? 'active' : ''}`, attributes: { 'title': 'Horizontal Mode' } });
        horizontalButton.addEventListener('click', () => this.setDisplayMode('horizontal'));
        setIcon(horizontalButton, 'columns-2');

        viewModeContainer.appendChild(verticalButton);
        viewModeContainer.appendChild(horizontalButton);
        this.controlsContainer.appendChild(viewModeContainer);

        if (this.displayMode === 'horizontal') {
            const navContainer = node('div', { class: 'control-group' });

            //Previous
            this.previousPanelButton = node('button', { class: 'nav-button', attributes: { 'title': 'Previous Pages' } }) as HTMLButtonElement;
            this.previousPanelButton.addEventListener('click', () => this.navigateHorizontalPages(-2));
            setIcon(this.previousPanelButton, 'arrow-left');

            //Next
            this.nextPanelButton = node('button', { class: 'nav-button', attributes: { 'title': 'Next Pages' } }) as HTMLButtonElement;
            this.nextPanelButton.addEventListener('click', () => this.navigateHorizontalPages(2));
            setIcon(this.nextPanelButton, 'arrow-right');

            //Page indicator
            this.panelIndexLabel = node('span', { class: 'panel-indicator', text: `Pages .-. of .` });

            navContainer.appendChild(this.previousPanelButton);
            navContainer.appendChild(this.panelIndexLabel);
            navContainer.appendChild(this.nextPanelButton);
            this.controlsContainer.appendChild(navContainer);
        }
    }

    updateControls() {
        this.previousPanelButton.disabled = this.panelIndex <= 0;

        if (this.displayMode === 'horizontal') {
            this.nextPanelButton.disabled = this.panelIndex >= this.panelFiles.length - 2;

            (this.panelIndex + 1 == this.panelFiles.length - 1) ? [this.panelFiles.length - 1] : [this.panelIndex, this.panelIndex + 1];

            if (this.panelIndex + 1 == this.panelFiles.length - 1)
                this.panelIndexLabel.textContent = `Page ${this.panelIndex + 2} of ${this.panelFiles.length}`
            else
                this.panelIndexLabel.textContent = `Pages ${this.panelIndex + 1}-${this.panelIndex + 2} of ${this.panelFiles.length}`

        } else {
            this.nextPanelButton.disabled = this.panelIndex >= this.panelFiles.length - 1;
        }
    }

    renderPanels() {
        this.panelsContainer.empty();
        this.panelsContainer.classList.toggle('horizontal-mode', this.displayMode === 'horizontal');
        this.panelsContainer.classList.toggle('vertical-mode', this.displayMode === 'vertical');

        if (this.panelFiles.length === 0) {
            const emptyMessage = node('div', { class: 'empty-message', text: 'No comic panels found in the selected folder.' });
            this.panelsContainer.appendChild(emptyMessage);
            return;
        }

        if (this.displayMode === 'vertical') {
            this.renderVerticalLayout();
        }
        else {
            this.renderHorizontalLayout();
        }

        this.updateControls();
    }

    renderVerticalLayout() {
        this.previousPanelButton = node('button', { class: 'side-arrow prev-arrow' }) as HTMLButtonElement;
        this.nextPanelButton = node('button', { class: 'side-arrow next-arrow' }) as HTMLButtonElement;

        setIcon(this.previousPanelButton, 'arrow-up');
        setIcon(this.nextPanelButton, 'arrow-down');

        this.previousPanelButton.addEventListener('click', () => this.navigateToPanel(-1));
        this.nextPanelButton.addEventListener('click', () => this.navigateToPanel(1));

        this.panelsContainer.appendChild(this.previousPanelButton);
        this.panelsContainer.appendChild(this.nextPanelButton);

        const contentContainer = node('div', { class: 'vertical-content-container' });
        this.panelsContainer.appendChild(contentContainer);

        for (let i = 0; i < this.panelFiles.length; i++) {
            const panelWrapper = node('div', { class: 'panel-wrapper', attributes: { 'data-index': i.toString() } });

            const panelContainer = this.createPanelElement(i);
            const noteContainer = this.createNoteElement(i);

            panelWrapper.appendChild(panelContainer);
            panelWrapper.appendChild(noteContainer);

            contentContainer.appendChild(panelWrapper);
        }
    }

    renderHorizontalLayout() {
        const indices = (this.panelIndex + 2 == this.panelFiles.length) ? [this.panelFiles.length - 1] : [this.panelIndex, this.panelIndex + 1];

        const pagesContainer = node('div', { class: 'pages-container' });
        this.panelsContainer.appendChild(pagesContainer);

        console.log(this.panelIndex, this.panelFiles.length);
        indices.forEach(i => {
            const pageContainer = node('div', { class: 'page-container' });

            const panelContainer = this.createPanelElement(i);
            const noteContainer = this.createNoteElement(i);

            pageContainer.appendChild(panelContainer);
            pageContainer.appendChild(noteContainer);

            pagesContainer.appendChild(pageContainer);
        })
    }

    createPanelElement(index: number): HTMLElement {
        const file = this.panelFiles[index];

        const panelContainer = node('div', {
            class: 'panel-container',
            attributes: { 'data-index': index.toString() }
        });

        const imgPath = this.app.vault.getResourcePath(file);
        const img = node('img', {
            class: 'panel-image',
            attributes: {
                'src': imgPath,
                'alt': `Panel ${index + 1}`,
                'title': file.name
            }
        });

        //Option to view the original image
        panelContainer.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            const menu = new Menu();
            menu.addItem((item) => {
                item.setTitle("View Original Image")
                    .setIcon("file-image")
                    .onClick(() => { this.app.workspace.openLinkText(file.path, "", true); });
            });
            menu.showAtMouseEvent(event);
        });

        panelContainer.appendChild(img);

        if (this.displayMode === 'vertical') {
            const panelNumber = node('div', { class: 'panel-number', text: `${index + 1}` }); panelContainer.appendChild(panelNumber);
        }

        return panelContainer;
    }

    createNoteElement(index: number): HTMLElement {
        const noteContainer = node('div', { class: 'note-container', attributes: { 'data-index': index.toString() } });
        const noteHeader = node('div', { class: 'note-header', text: `Panel ${index + 1} Notes` });

        noteContainer.appendChild(noteHeader);

        const textarea = node('textarea', { class: 'note-textarea', attributes: { 'placeholder': 'Add notes for this panel...', 'rows': '1' } }) as HTMLTextAreaElement;

        //Find note for this panel index
        const existingNote = this.comicData.notes.find((note: PanelNote) => note.index === index);
        if (existingNote) textarea.value = existingNote.text;

        textarea.addEventListener('input', () => {
            let note = this.comicData.notes.find((note: PanelNote) => note.index === index);

            if (textarea.value.trim().length > 0) {
                if (note) {
                    note.text = textarea.value;
                } else {
                    this.comicData.notes.push({ index: index, text: textarea.value });
                }
            } else if (note) {
                const noteIndex = this.comicData.notes.indexOf(note);
                this.comicData.notes.splice(noteIndex, 1);
            }
            this.saveComicData();
        });

        noteContainer.appendChild(textarea);
        return noteContainer;
    }

    setDisplayMode(mode: 'vertical' | 'horizontal') {
        if (this.displayMode !== mode) {
            this.displayMode = mode;
            this.comicData.displayMode = mode;

            this.panelIndex = 0;

            this.saveComicData();
            this.render();
        }
    }

    async saveComicData() {
        if (this.comicData && this.filePath) {
            await this.plugin.updateComicMetadata(this.filePath, this.comicData);
        }
    }
}