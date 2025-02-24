import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, MarkdownView, Notice } from 'obsidian';

interface CreatorPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: CreatorPluginSettings = {
	mySetting: 'default'
}

export default class CreatorPlugin extends Plugin {
	settings: CreatorPluginSettings;
	
	async onload() {
		await this.loadSettings();

		// Add a ribbon icon for the plugin
		const ribbonIconEl = this.addRibbonIcon('dice', 'Creator Plugin', (evt: MouseEvent) => {
			// Open the creator view when the ribbon icon is clicked
			this.activateCreatorView();
		});
		
		ribbonIconEl.addClass('creator-plugin-ribbon-class');

		// Add a command to open the creator view
		this.addCommand({
			id: 'open-creator-view',
			name: 'Open Creator Panel',
			callback: () => {
				this.activateCreatorView();
			}
		});

		// Add settings tab
		this.addSettingTab(new CreatorSettingTab(this.app, this));
	}

	// Function to open the graph view with custom tags filter
	async openGraphView() {
		try {
			// First, open the graph view
			await this.app.commands.executeCommandById('graph:open');
			
			// Wait a moment for the graph view to initialize
			setTimeout(() => {
				this.injectCustomTagsFilterToGraphView();
			}, 500);
		} catch (error) {
			console.error('Failed to open graph view:', error);
			new Notice('Failed to open graph view. Please check console for details.');
		}
	}
	
	// This function injects our custom tags filter UI into the graph view
	injectCustomTagsFilterToGraphView() {
		// Get the graph view container
		const graphViewContainer = document.querySelector('.graph-view-container');
		if (!graphViewContainer) {
			console.error('Could not find graph view container');
			return;
		}
		
		// Check if our custom filter already exists to avoid duplicates
		if (graphViewContainer.querySelector('.custom-tags-filter')) {
			return;
		}
		
		// Create the custom filter container
		const customFilterContainer = document.createElement('div');
		customFilterContainer.addClass('custom-tags-filter');
		
		// Add a title
		const filterTitle = document.createElement('h3');
		filterTitle.setText('Filter by Tags');
		customFilterContainer.appendChild(filterTitle);
		
		// Add a description
		const filterDescription = document.createElement('p');
		filterDescription.addClass('filter-description');
		filterDescription.setText('Select tags to include in the graph view:');
		customFilterContainer.appendChild(filterDescription);
		
		// Create a scrollable container for tags
		const tagsContainer = document.createElement('div');
		tagsContainer.addClass('tags-container');
		customFilterContainer.appendChild(tagsContainer);
		
		// Add loading indicator while we fetch tags
		const loadingIndicator = document.createElement('div');
		loadingIndicator.addClass('tags-loading');
		loadingIndicator.setText('Loading tags...');
		tagsContainer.appendChild(loadingIndicator);
		
		// Get all tags in the vault
		this.getAllTags().then(tags => {
			// Remove loading indicator
			tagsContainer.removeChild(loadingIndicator);
			
			if (tags.length === 0) {
				const noTagsMessage = document.createElement('p');
				noTagsMessage.setText('No tags found in your vault.');
				tagsContainer.appendChild(noTagsMessage);
				return;
			}
			
			// Add checkboxes for each tag
			tags.forEach(tag => {
				const tagItem = document.createElement('div');
				tagItem.addClass('tag-item');
				
				const checkbox = document.createElement('input');
				checkbox.setAttribute('type', 'checkbox');
				checkbox.setAttribute('id', `tag-${tag}`);
				checkbox.setAttribute('data-tag', tag);
				checkbox.checked = true; // All tags visible by default
				checkbox.addEventListener('change', () => {
					this.updateGraphFilter();
				});
				
				const label = document.createElement('label');
				label.setAttribute('for', `tag-${tag}`);
				label.setText(tag);
				
				tagItem.appendChild(checkbox);
				tagItem.appendChild(label);
				tagsContainer.appendChild(tagItem);
			});
			
			// Add buttons for Select All/None
			const buttonsContainer = document.createElement('div');
			buttonsContainer.addClass('filter-buttons');
			
			const selectAllButton = document.createElement('button');
			selectAllButton.setText('Select All');
			selectAllButton.addEventListener('click', () => {
				this.setAllTagsSelection(true);
			});
			
			const selectNoneButton = document.createElement('button');
			selectNoneButton.setText('Select None');
			selectNoneButton.addEventListener('click', () => {
				this.setAllTagsSelection(false);
			});
			
			buttonsContainer.appendChild(selectAllButton);
			buttonsContainer.appendChild(selectNoneButton);
			customFilterContainer.appendChild(buttonsContainer);
		}).catch(error => {
			console.error('Error fetching tags:', error);
			tagsContainer.removeChild(loadingIndicator);
			
			const errorMessage = document.createElement('p');
			errorMessage.addClass('error-message');
			errorMessage.setText('Error loading tags. Please try again.');
			tagsContainer.appendChild(errorMessage);
		});
		
		// Add the custom filter container to the graph view
		// Find the controls container in the graph view to insert our filter
		const graphControls = graphViewContainer.querySelector('.graph-controls');
		if (graphControls) {
			graphControls.appendChild(customFilterContainer);
		} else {
			// If we can't find the existing controls, append to the main container
			graphViewContainer.appendChild(customFilterContainer);
		}
	}
	
	// Function to get all tags from the vault
	async getAllTags() {
		const allTags = new Set();
		
		// Iterate through all markdown files in the vault
		const files = this.app.vault.getMarkdownFiles();
		
		for (const file of files) {
			try {
				// Get the cache metadata for the file
				const cache = this.app.metadataCache.getFileCache(file);
				
				// Extract tags from the file
				if (cache && cache.tags) {
					cache.tags.forEach(tagObj => {
						if (tagObj.tag) {
							// Remove the '#' from the tag
							const tagName = tagObj.tag.startsWith('#') 
								? tagObj.tag.substring(1) 
								: tagObj.tag;
							
							allTags.add(tagName);
						}
					});
				}
				
				// Also get frontmatter tags if any
				if (cache && cache.frontmatter && cache.frontmatter.tags) {
					const fmTags = cache.frontmatter.tags;
					if (Array.isArray(fmTags)) {
						fmTags.forEach(tag => allTags.add(tag));
					} else if (typeof fmTags === 'string') {
						// Handle comma-separated tags
						fmTags.split(',')
							.map(t => t.trim())
							.filter(t => t)
							.forEach(tag => allTags.add(tag));
					}
				}
			} catch (error) {
				console.error(`Error processing tags for file ${file.path}:`, error);
			}
		}
		
		// Convert Set to sorted Array for display
		return Array.from(allTags).sort();
	}
	
	// Function to update the graph filter based on selected tags
	updateGraphFilter() {
		// Get all checked tag checkboxes
		const checkedTags = Array.from(
			document.querySelectorAll('.custom-tags-filter input[type="checkbox"]:checked')
		).map(checkbox => (checkbox as HTMLInputElement).getAttribute('data-tag'));
		
		// Create a search query for the graph filter
		if (checkedTags.length === 0) {
			// If no tags are selected, show an empty graph (or alternatively show everything)
			this.setGraphSearch('-tag:*'); // This will show no results with tags
		} else {
			// Create a query that includes all selected tags
			const tagQuery = checkedTags.map(tag => `tag:${tag}`).join(' OR ');
			this.setGraphSearch(tagQuery);
		}
	}
	
	// Function to set all tag checkboxes to a specific state
	setAllTagsSelection(checked: boolean) {
		document.querySelectorAll('.custom-tags-filter input[type="checkbox"]')
			.forEach((checkbox: HTMLInputElement) => {
				checkbox.checked = checked;
			});
		
		this.updateGraphFilter();
	}
	
	// Function to set the graph search query
	setGraphSearch(query: string) {
		// Find the search input in the graph view
		const searchInput = document.querySelector('.graph-view-container .search-input-container input') as HTMLInputElement;
		if (!searchInput) {
			console.error('Could not find graph search input');
			return;
		}
		
		// Set the value and dispatch appropriate events to trigger the search
		searchInput.value = query;
		
		// Dispatch events to trigger the search
		searchInput.dispatchEvent(new Event('input', { bubbles: true }));
		searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
	}
	
	// Function to activate the creator view
	async activateCreatorView() {
		const workspace = this.app.workspace;
		
		// Create the creator view HTML
		const creatorContainer = document.createElement('div');
		creatorContainer.addClass('creator-container');
		
		// Add title
		const title = document.createElement('h1');
		title.setText('Creator Panel');
		creatorContainer.appendChild(title);
		
		// Add description
		const description = document.createElement('p');
		description.setText('Select what you want to create:');
		creatorContainer.appendChild(description);
		
		// Create buttons container
		const buttonsContainer = document.createElement('div');
		buttonsContainer.addClass('creator-buttons');
		
		// Add Character Creation button
		const characterBtn = document.createElement('button');
		characterBtn.setText('Character Creation');
		characterBtn.addClass('creator-button');
		characterBtn.addEventListener('click', () => {
			this.createNewNote('Character Template', 'characters');
		});
		buttonsContainer.appendChild(characterBtn);
		
		// Add Item Creation button
		const itemBtn = document.createElement('button');
		itemBtn.setText('Item Creation');
		itemBtn.addClass('creator-button');
		itemBtn.addEventListener('click', () => {
			this.createNewNote('Item Template', 'items');
		});
		buttonsContainer.appendChild(itemBtn);
		
		// Add Location Creation button
		const locationBtn = document.createElement('button');
		locationBtn.setText('Location Creation');
		locationBtn.addClass('creator-button');
		locationBtn.addEventListener('click', () => {
			this.createNewNote('Location Template', 'locations');
		});
		buttonsContainer.appendChild(locationBtn);
		
		// Add Graph View button
		const graphBtn = document.createElement('button');
		graphBtn.setText('Show Graph View');
		graphBtn.addClass('creator-button');
		graphBtn.addClass('creator-graph-button');
		graphBtn.addEventListener('click', () => {
			this.openGraphView();
		});
		buttonsContainer.appendChild(graphBtn);
		
		creatorContainer.appendChild(buttonsContainer);
		
		// Get active leaf or create new one
		let leaf: WorkspaceLeaf;
		const existingLeaves = this.app.workspace.getLeavesOfType('markdown');
		
		if (existingLeaves.length > 0) {
			leaf = existingLeaves[0];
		} else {
			leaf = this.app.workspace.getLeaf(true);
		}
		
		await leaf.setViewState({
			type: 'markdown',
			state: {
				mode: 'source',
				source: ''
			}
		});
		
		// Replace the content of the leaf with our custom view
		if (leaf.view instanceof MarkdownView) {
			const contentEl = leaf.view.contentEl;
			contentEl.empty();
			contentEl.appendChild(creatorContainer);
		}
	}
	
	// Function to create a new note with a specific template
	async createNewNote(templateType: string, folder: string) {
		let template = '';
		
		// Define templates for each type
		if (templateType === 'Character Template') {
			template = `# New Character
## Basic Information
- **Name**: 
- **Age**: 
- **Occupation**: 
- **Physical Description**: 

## Background
- **Origin**: 
- **History**: 

## Personality
- **Traits**: 
- **Goals**: 
- **Motivations**: 

## Relationships
- **Allies**: 
- **Enemies**: 
- **Family**: 

## Notes
`;
		} else if (templateType === 'Item Template') {
			template = `# New Item
## Basic Information
- **Name**: 
- **Type**: 
- **Value**: 
- **Physical Description**: 

## Properties
- **Special Abilities**: 
- **History**: 
- **Current Location**: 

## Notes
`;
		} else if (templateType === 'Location Template') {
			template = `# New Location
## Basic Information
- **Name**: 
- **Type**: 
- **Size**: 
- **Description**: 

## Notable Features
- **Landmarks**: 
- **Climate**: 
- **Culture**: 

## Inhabitants
- **Population**: 
- **Notable People**: 

## History
- **Founding**: 
- **Major Events**: 

## Notes
`;
		}
		
		// Generate a unique filename
		const timestamp = Date.now();
		const fileName = `New ${templateType.split(' ')[0]}-${timestamp}.md`;
		
		// Create the new file
		try {
			await this.app.vault.create(`${folder}/${fileName}`, template);
			
			// Open the newly created file
			const file = this.app.vault.getAbstractFileByPath(`${folder}/${fileName}`);
			if (file) {
				const leaf = this.app.workspace.getLeaf(true);
				await leaf.openFile(file);
			}
		} catch (error) {
			console.error('Failed to create new note:', error);
			
			// If folder doesn't exist, try creating without folder
			try {
				await this.app.vault.create(fileName, template);
				const file = this.app.vault.getAbstractFileByPath(fileName);
				if (file) {
					const leaf = this.app.workspace.getLeaf(true);
					await leaf.openFile(file);
				}
			} catch (secondError) {
				console.error('Failed to create new note without folder:', secondError);
			}
		}
	}

	onunload() {
		// Clean up any custom elements when the plugin is disabled
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class CreatorSettingTab extends PluginSettingTab {
	plugin: CreatorPlugin;

	constructor(app: App, plugin: CreatorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Creator Plugin Settings'});

		new Setting(containerEl)
			.setName('Default folder for Characters')
			.setDesc('Folder path where character notes will be stored')
			.addText(text => text
				.setPlaceholder('characters')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}