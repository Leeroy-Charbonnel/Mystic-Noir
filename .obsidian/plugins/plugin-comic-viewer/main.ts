import { App, Plugin, TFile, Notice, WorkspaceLeaf, setIcon, ItemView, addIcon } from 'obsidian';
import { ComicViewerView } from './ComicViewerView';
import { generateUUID } from './utils';


const VIEW_TYPE_COMIC_VIEWER = "comic-viewer-view";

export default class ComicViewerPlugin extends Plugin {

    async onload() {
        console.log("Loading comic viewer plugin");

        this.registerView(
            VIEW_TYPE_COMIC_VIEWER,
            (leaf: WorkspaceLeaf) => new ComicViewerView(leaf, this)
        );


        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                menu.addItem((item) => {
                    item
                        .setTitle('Create Comic From This Folder')
                        .setIcon('columns-2')
                        .onClick(() => {
                            const folderName = file.path.split('/').pop() || 'Comic';
                            this.createComic(folderName, file.path);
                        });
                });
            })
        );


        this.registerEvent(
            this.app.workspace.on('file-open', async (file) => {
                if (!file) return;
                if (file.extension !== 'md') return;

                const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
                const comicData = frontmatter?.comicData;


                if (comicData) this.activateView(comicData);

            })
        );


        this.app.workspace.onLayoutReady(() => {
            this.app.workspace.getLeavesOfType(VIEW_TYPE_COMIC_VIEWER).forEach(leaf => leaf.detach());
        });
    }

    async onunload() {
        console.log("Unloading comic viewer plugin");
    }

    async activateView(comicData: any) {
        const leaf = this.app.workspace.getMostRecentLeaf();
        if (!leaf) return;



        while (!(leaf.view instanceof ComicViewerView)) {
            await leaf.setViewState({ type: VIEW_TYPE_COMIC_VIEWER, active: true });
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (leaf.view instanceof ComicViewerView) {
            leaf.view.updateComic(comicData);
        }
    }

    async createComic(title: string, folderPath: string) {
        try {
            const comicMetadata = {
                id: generateUUID(),
                title: title,
                folderPath: folderPath,
                displayMode: 'vertical',
                notes: []
            };

            const fileContent = this.generateComicFileContent(comicMetadata);

            const filePath = `/${title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
            const file = await this.app.vault.create(filePath, fileContent);

            new Notice(`Comic page created: ${title}`);

            this.activateView(comicMetadata);
            return file;
        } catch (error) {
            console.error("Error creating comic page:", error);
            new Notice(`Error creating comic page: ${error.message}`);
            return null;
        }
    }

    private generateComicFileContent(comicMetadata: any): string {
        let content = "";

        content += `---\n`;
        content += `comicData: ${JSON.stringify(comicMetadata, null, 2)}\n`;
        content += `---\n\n`;

        content += `> [!info] Comic Viewer\n`;
        content += `> Comic page created from Comic view plugin\n`;

        return content;
    }

    async updateComicMetadata(filePath: string, updatedMetadata: any) {
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                const content = this.generateComicFileContent(updatedMetadata);
                await this.app.vault.modify(file, content);
                new Notice("Comic data updated");
            }
        } catch (error) {
            console.error("Error updating comic metadata:", error);
            new Notice(`Error updating comic metadata: ${error.message}`);
        }
    }
}