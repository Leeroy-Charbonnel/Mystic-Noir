import { App,Plugin,PluginSettingTab,Setting,TFile,normalizePath,Notice,TFolder,Menu,MenuItem,FileManager,SuggestModal,WorkspaceLeaf,setIcon } from 'obsidian';
import { DynamicFormModal } from './dynamicFormModal';
import { ContentSelectorModal } from './contentSelectorModal';
import { node,formatDisplayName,convertTemplateFormat,FormTemplate,getTemplates,hasValueAndType } from './utils';
import './styles.css';



class ContentCreatorSettingTab extends PluginSettingTab {
    plugin: ContentCreatorPlugin;

    constructor(app: App,plugin: ContentCreatorPlugin) {
        super(app,plugin);
        this.plugin=plugin;
    }

    display(): void {
        const { containerEl }=this;
        containerEl.empty();

        containerEl.createEl('h2',{ text: 'Content Creator Settings' });
        containerEl.createEl('h3',{ text: 'Default Folders' });
        containerEl.createEl('p',{ text: 'Specify the default folder path for each content type (e.g., "1. Characters").' });

        const contentTypes=Object.keys(this.plugin.templates).map((key: string) => (this.plugin.templates[key as keyof typeof this.plugin.templates] as FormTemplate).contentType);
        const folders=this.getAllFolders();

        contentTypes.forEach(type => {
            const readableType=type.charAt(0).toUpperCase()+type.slice(1);

            new Setting(containerEl)
                .setName(readableType)
                .setDesc(`Default folder for ${readableType.toLowerCase()}`)
                .addDropdown(dropdown => {
                    folders.forEach(folder => { dropdown.addOption(folder,folder); });
                    dropdown.setValue(this.plugin.settings.defaultFolders[type]||'');
                    dropdown.onChange(async (value) => {
                        this.plugin.settings.defaultFolders[type]=value;
                        await this.plugin.saveSettings();
                    })
                });
        });
    }
    getAllFolders(): string[] {
        const folders: string[]=[];
        this.app.vault.getAllLoadedFiles().forEach(file => {
            if(file instanceof TFolder&&file.path!=='/') {
                folders.push(file.path);
            }
        });
        folders.sort((a,b) => a.localeCompare(b));
        return folders;
    }
}

interface ContentCreatorPluginSettings {
    defaultFolders: { [key: string]: string }
}

const DEFAULT_SETTINGS: ContentCreatorPluginSettings={
    defaultFolders: {}
}

class EditContentButtons {
    private containerEl: HTMLElement;
    private plugin: ContentCreatorPlugin;
    private leaf: any;

    constructor(app: App,plugin: ContentCreatorPlugin,leaf: any) {
        this.plugin=plugin;
        this.leaf=leaf;
        this.containerEl=this.leaf.actionsEl

        try {
            //Try delete button
            this.leaf.actionsEl.querySelector("#editContent").remove()
        } catch(error) {}

        //Check if leaf has the property data
        if(this.leaf.metadataEditor && this.leaf.metadataEditor.properties.filter((x: any) => x.key=="data").length==0) return

        const formButton=document.createElement('button');
        formButton.id="editContent"
        formButton.className='clickable-icon view-action';
        formButton.setAttribute('aria-label','Edit Content');
        formButton.addEventListener('click',() => {
            this.plugin.editExistingContent(this.leaf.file as TFile);
        });

        setIcon(formButton,'file-pen-line');
        this.containerEl.insertBefore(formButton,this.containerEl.firstChild);
    }

    public destroy() {
        if(this.containerEl&&this.containerEl.parentNode) {
            this.containerEl.remove();
        }
    }
}
export default class ContentCreatorPlugin extends Plugin {
    settings: ContentCreatorPluginSettings;
    templates: { [key: string]: FormTemplate };

    async onload() {
        console.log("loading "+this.manifest.name+" plugin: v"+this.manifest.version)

        //Settings
        await this.loadSettings();
        this.addSettingTab(new ContentCreatorSettingTab(this.app,this));

        //Templates
        this.templates=getTemplates();
        Object.keys(this.templates).forEach(type => {
            if(this.settings.defaultFolders[type]) {
                (this.templates[type as keyof typeof this.templates] as FormTemplate).defaultFolder=this.settings.defaultFolders[type];
            }
        });

        //Commands
        this.addRibbonIcon('file-plus','Create Content',(evt: MouseEvent) => { new ContentSelectorModal(this.app,this).open(); });

        //Top right menu, and right click on page
        this.registerEvent(
            this.app.workspace.on('file-menu',(menu,file) => {
                if(file instanceof TFile&&file.extension==='md') {
                    menu.addItem((item: MenuItem) => {
                        item.setTitle('Edit content')
                            .setIcon('file-pen-line')
                            .onClick(async () => {
                                await this.editExistingContent(file as TFile);
                            });
                    });
                }
            })
        );
        //Button on page itself
        this.registerEvent(
            this.app.workspace.on('layout-change',() => {
                const currentFileView=(this.app.workspace as any).getActiveFileView()
                if(currentFileView!=null) {
                    new EditContentButtons(this.app,this,currentFileView);
                }
            })
        );
    }

    async loadSettings() {
        this.settings=Object.assign({},DEFAULT_SETTINGS,await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);

        Object.keys(this.templates).forEach(type => {
            if(this.settings.defaultFolders[type]) {
                (this.templates[type as keyof typeof this.templates] as FormTemplate).defaultFolder=this.settings.defaultFolders[type];
            }
        });
    }

    openFormForContentType(contentType: string) {
        let data=JSON.parse(JSON.stringify(this.templates[contentType as keyof typeof this.templates]));
        data.name=`New (${contentType.charAt(0).toUpperCase()+contentType.slice(1)})`
        data.oldName=null;
        new DynamicFormModal(this.app,this,data).open();
    }
    fillTemplateWithData(template: any,data: any) {
        const result=JSON.parse(JSON.stringify(template));
        function fill(templateObj: any,dataObj: any) {
            if(!dataObj) return templateObj;

            for(const key in templateObj) {
                if(dataObj.hasOwnProperty(key)) {
                    if(typeof templateObj[key]==='object'&&templateObj[key]!=null) {
                        templateObj[key]=fill(templateObj[key],dataObj[key]);
                    }
                    else {
                        templateObj[key]=dataObj[key];
                    }
                }
            }
            return templateObj;
        }
        return fill(result,data);
    }

    async editExistingContent(file: TFile) {
        //try {
            const properties=this.getFileProperties(this.app,file);

            if(properties==null) {
                new Notice("Error editing content: Could not find properties");
                console.error("Error editing content: Could not find properties");
                return
            }

            //Fill template with data
            const data=properties?.data;
            const template=this.templates[data.contentType];
            const result=this.fillTemplateWithData(template,data);

            new DynamicFormModal(this.app,this,result).open();
        //} catch(error) {
        //    new Notice(`Error editing content: ${error.message}`);
        //    console.error(`Error editing content: ${error.message}`);
            
        //}
    }

    getFileProperties(app: App,file: TFile) {
        const cache=app.metadataCache.getFileCache(file);
        if(cache&&cache.frontmatter) return cache.frontmatter;
        return null;
    }

    async createContentFile(data: any) {
        try {
            const folderPath=data.defaultFolder;

            //Check if folder is specified
            if(!folderPath||folderPath.trim()=='') { new Notice(`No default folder : ${data.contentType}`); }

            //Check if folder exist, create it otherwise
            await this.ensureFolderExists(folderPath);

            // Generate content markdown
            let file
            let newContent=(data.oldName==null);
            const fileOldPath=normalizePath(`${folderPath}/${data.oldName}.md`);
            const fileNewPath=normalizePath(`${folderPath}/${data.name}.md`);

            data.oldName=data.name;
            const fileContent=this.generateFileContent(data);

            if(newContent) {
                file=await this.app.vault.create(fileNewPath,fileContent);
            } else {
                //If exist, modify content and rename to keep link
                file=this.app.vault.getAbstractFileByPath(fileOldPath) as TFile;
                await this.app.vault.modify(file,fileContent);
                await this.app.fileManager.renameFile(file,fileNewPath);
            }

            new Notice(`Saved : ${data.name}`);

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



    private generateFileContent(data: FormTemplate): string {
        const contentTypeTag=data.contentType.charAt(0).toUpperCase()+data.contentType.slice(1);


        let content=""
        content+=`---\n\n`;
        content+=`data: ${JSON.stringify(data)}\n\n`;
        content+=`---\n\n`;

        content+=`#${contentTypeTag}\n\n`;


        content+=this.formatContentData(data.template,3,"template");
        return content;
    }

    private formatContentData(data: any,depth: number,path: string=''): string {
        let content='';
        Object.entries(data).forEach(([key,field]: [string,{ value: any,type: string }]) => {
            const currentPath=path? `${path}.${key}`:key;

            if(!hasValueAndType(field)) {
                const heading='#'.repeat(depth);
                const displayName=formatDisplayName(key);
                content+=`${heading} ${displayName}\n`;
                content+=this.formatContentData(field,depth+1,currentPath)+`\n`;
                content+="---\n"
            } else {
                if(field.value==null||field.value==undefined) return ""

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

                content+=` <span style='${style_header.join("")}'>${displayName} : </span> `
                if(field.type.startsWith("array")) {
                    const fieldType=field.type.split(':')[1]
                    let values=field.value;

                    if(fieldType=="textarea") {
                        values=values.map((item: string) => {
                            let subContent=""
                            subContent+=`<span class='content-creation-textarea'>`;
                            subContent+=`${item.split("\n").map((x: string) => (x.trim()==""? "</br>":`<span>${x}</span>`)).join("\n")} \n`;
                            subContent+=`</span>\n\n`;
                            return subContent
                        }
                        )
                        content+=values.map((item: string) => `> ${item} `).join('\n')+"\n\n";

                    } else {
                        content+=`${values[0]} \n`;
                    }

                } else if(field.type.startsWith("textarea")) {
                    if(!String(field.value).trim()) return ""
                    content+=`<span class='content-creation-textarea'>`;
                    content+=`${(field.value as string).split("\n").map((x: string) => (x.trim()==""? "</br>":`<span>${x}</span>`)).join("\n")} \n`;
                    content+=`</span>\n\n`;

                } else if(field.type=="boolean") {
                    content+=` <input type="checkbox" ${field.value? "checked":""}>\n`;
                }
                else if(String(field.value).trim()) {
                    content+=`${field.value} \n`;
                }
                //content+=">\n"
            }
        })
        return content;
    }

    onunload() {
        console.log("unloading plugin");
    }
}
