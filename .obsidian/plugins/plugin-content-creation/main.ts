import { App,Plugin,PluginSettingTab,Setting,TFile,normalizePath,Notice,TFolder,Menu,MenuItem,FileManager } from 'obsidian';
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
            let file
            if(overwrite) {
                let fileOldPath=normalizePath(`${folderPath}/${formData.oldName}.md`);
                let fileNewPath=normalizePath(`${folderPath}/${formData.name}.md`);
                file=this.app.vault.getAbstractFileByPath(fileOldPath) as TFile;
                await this.app.vault.modify(file,fileContent);
                await this.app.fileManager.renameFile(file,fileNewPath);
            } else {
                let filePath=normalizePath(`${folderPath}/${formData.name}.md`);
                file=await this.app.vault.create(filePath,fileContent);
            }

            new Notice(`Saved ${contentType.slice(0,-1)}: ${formData.name}`);

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


        content+=this.formatContentData(formTemplate,formData.template,3,"template");
        return content;
    }

    private formatContentData(template: any,data: any,depth: number,path: string=''): string {
        let content='';

        for(const [key,value] of Object.entries(data)) {
            const currentPath=path? `${path}.${key}`:key;
            const field=this.getValueObjectFromPath(template,currentPath)


            if(typeof value==='object'&&value!==null&&!Array.isArray(value)) {
                const heading='#'.repeat(depth);
                const displayName=formatDisplayName(key);
                content+=`${heading} ${displayName}\n`;
                content+=this.formatContentData(template,value,depth+1,currentPath)+`\n`;
                content+="---\n"
            } else {
                const displayName=formatDisplayName(key);
                let prefix=">";
                content+=prefix;


                let style_header=[
                    "display: inline-flex;",
                    "font-weight: bold;",
                    "white-space: nowrap;",
                    "overflow: hidden;",
                    "margin: 3px 0px;"
                ]
                let style_header_array=[
                    "display: inline-flex;",
                    "font-weight: bold;",
                    "white-space: nowrap;",
                    "overflow: hidden;",
                    "margin: 3px 0px;"
                ]

                content+=` <span style='${style_header.join("")}'>${displayName} : </span> `



                if(field.startsWith("array")) {
                    let values=(value as string[]).filter((item: string) => item.trim?.().length>0)
                    if(values.length>0) {
                        if(values.length==1) {
                            content+=`${values[0]} \n`;
                        }
                        else {
                            content+=`\n`;
                            content+=values.map(item => `>+ ${item.trim()} `).join('\n')+"\n\n";
                        }
                    }
                } else if(field==='textarea') {
                    content+=`\n> \n`;
                    content+=`${(value as string).split("\n").map((x: string) => ">     "+(x.trim()==""? "":`${x}`)).join("\n")} \n`;

                }
                else if(value!==null&&value!==undefined&&String(value).trim()) {
                    content+=`${value} \n`;
                }
                //content+=">\n"
            }
        }
        return content;
    }

    getValueObjectFromPath(obj: any,path: string) {
        const pathParts=path.split('.');
        let current=obj;

        for(let i=0;i<pathParts.length-1;i++) {
            current=current[pathParts[i]];
        }
        return current[pathParts[pathParts.length-1]]
    }

    onunload() {
        console.log("unloading plugin");
    }
}
