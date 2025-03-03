import { App,Plugin,PluginSettingTab,Setting,TFile,normalizePath,Notice,TFolder,Menu,MenuItem } from 'obsidian';
import { DynamicFormModal } from './dynamicFormModal';
import { ContentSelectorModal } from './contentSelectorModal';
import * as templates from './template';
import { node,formatDisplayName } from './utils';
import './styles.css';

export default class ContentCreatorPlugin extends Plugin {
    async onload() {
        console.log("loading "+this.manifest.name+" plugin: v"+this.manifest.version)
        const ribbonIconEl=this.addRibbonIcon('file-plus','Create Content',(evt: MouseEvent) => {
            new ContentSelectorModal(this.app,this).open();
        });
        ribbonIconEl.addClass('creator-plugin-ribbon-class');

        //Create new content
        this.addCommand({
            id: 'open-content-creator',
            name: 'Create new content',
            callback: () => {
                new ContentSelectorModal(this.app,this).open();
            }
        });

        //Top right menu, and right click on page
        this.registerEvent(
            this.app.workspace.on('file-menu',(menu,file) => {
                if(file instanceof TFile&&file.extension==='md') {
                    menu.addItem((item: MenuItem) => {
                        item.setTitle('Edit content')
                            .setIcon('pencil')
                            .onClick(async () => {
                                await this.editExistingContent(file as TFile);
                            });
                    });
                }
            })
        );

        //Right click on page itself
        this.registerEvent(
            this.app.workspace.on("editor-menu",(menu,editor,view) => {
                if(view.file instanceof TFile&&view.file.extension==='md') {
                    menu.addItem((item: MenuItem) => {
                        item.setTitle('Edit content')
                            .setIcon('pencil')
                            .onClick(async () => {
                                await this.editExistingContent(view.file as TFile);
                            });
                    });
                }
            })
        );
    }

    openFormForContentType(contentType: string) {
        const formTemplate=JSON.parse(JSON.stringify(templates.templates[contentType as keyof typeof templates.templates]));
        if(!formTemplate) {
            new Notice(`Unknown content type: ${contentType}`);
            return;
        }
        new DynamicFormModal(this.app,this,contentType,formTemplate).open();
    }

    async editExistingContent(file: TFile) {
        try {
            const properties=this.getFileProperties(this.app,file);

            if(properties==null) {
                console.error("Error editing content:","Could not find properties");
                new Notice("Error editing content: Could not find properties");
            }
            new DynamicFormModal(this.app,this,properties?.contentType,properties?.template,properties?.data).open();
        } catch(error) {
            console.error("Error editing content:",error);
            new Notice(`Error editing content: ${error.message}`);
        }
    }

    getFileProperties(app: App,file: TFile) {
        const cache=app.metadataCache.getFileCache(file);
        if(cache&&cache.frontmatter) {
            return cache.frontmatter;
        }
        return null;
    }

    async createContentFile(contentType: string,formData: any,formTemplate: any,overwrite: boolean=false) {
        try {
            const folderPath=formTemplate.defaultFolder;

            //Check if folder is specified
            if(!folderPath||folderPath.trim()=='') {
                new Notice(`No default folder : ${contentType}`);
            }
            //Check if folder exist, create it otherwise
            await this.ensureFolderExists(folderPath);

            // Remove spec

            const fileContent=this.generateFileContent(contentType,formData,formTemplate);
            let fileName;
            let filePath;
            
            if(overwrite) {
                fileName=formData.oldName;
                filePath=normalizePath(`${folderPath}/${fileName}.md`);
                const file=this.app.vault.getAbstractFileByPath(filePath) as TFile;
                
                app                          
                
            } else {
                fileName=formData.name;
                filePath=normalizePath(`${folderPath}/${fileName}.md`);
                const file=await this.app.vault.create(filePath,fileContent);
            }


            new Notice(`Saved ${contentType.slice(0,-1)}: ${fileName}`);

            this.app.workspace.getLeaf(false).openFile(file);
            return file;

        } catch(error) {
            console.error("Error creating content:",error);
            new Notice(`Error creating content: ${error.message}`);
            return null;
        }
    }


    private async ensureFolderExists(folderPath: string) {
        const folders=folderPath.split('/').filter(p => p.trim());
        let currentPath='';

        for(const folder of folders) {
            currentPath=currentPath? `${currentPath}/${folder}`:folder;
            if(!(await this.app.vault.adapter.exists(currentPath))) {
                await this.app.vault.createFolder(currentPath);
            }
        }
    }



    private generateFileContent(contentType: string,formData: any,formTemplate: any): string {
        const contentTypeTag=contentType.charAt(0).toUpperCase()+contentType.slice(1,-1);


        let content=""

        content+=`---\n\n`;
        content+=`contentType: ${contentType}\n\n`;
        content+=`data: ${JSON.stringify(formData)}\n\n`;
        content+=`template: ${JSON.stringify(formTemplate)}\n\n`;
        content+=`---\n\n`;

        content+=`#${contentTypeTag}\n\n`;


        content+=this.formatContentData(formData.template);
        console.log(content)
        return content;
    }

    private formatContentData(data: any,depth: number=2): string {
        let content='';
        console.log(data)

        for(const [key,value] of Object.entries(data)) {
            if(key!="defaultFolder") {
                if(typeof value==='object'&&value!==null&&!Array.isArray(value)) {
                    const heading='#'.repeat(depth);
                    const displayName=formatDisplayName(key);
                    content+=`${heading} ${displayName}\n`;
                    content+=this.formatContentData(value,depth+1)+`\n`;
                } else if(Array.isArray(value)) {
                    if(value.length>0&&value.some(item => item.trim?.().length>0)) {
                        const displayName=formatDisplayName(key);
                        content+=`**${displayName}:** \n`;
                        content+=value.filter(item => item.trim?.().length>0).map(item => "- "+item.trim()).join('\n');
                        content+=`\n\n`;
                    }
                } else if(value!==null&&value!==undefined&&String(value).trim()) {
                    const displayName=formatDisplayName(key);
                    content+=`**${displayName}:** ${value} \n`;
                }
            }
        }
        return content;
    }

    onunload() {
        console.log("unloading plugin");
    }
}
