import { App,TFile,normalizePath,Notice,Modal,FuzzySuggestModal } from 'obsidian';
import { node } from 'utils';

const allowedExtensions=['jpg','jpeg','png','webp','gif'];
const IMAGES_FOLDER="_Images";

class ConfirmationModal extends Modal {
    private result: boolean=false;
    private resolvePromise: (value: boolean) => void;

    constructor(app: App,private message: string) {
        super(app);
    }

    onOpen() {
        const { contentEl }=this;

        const text=node('p',{ text: this.message });
        const buttonContainer=node('div',{ class: 'modal-button-container' });

        const cancelBtn=node('button',{ text: 'Cancel',class: 'mod-warning' })
        cancelBtn.addEventListener('click',() => {
            this.result=false;
            this.close();
        });

        const submitBtn=node('button',{ text: 'Overwrite',class: 'mod-cta' })
        submitBtn.addEventListener('click',() => {
            this.result=true;
            this.close();
        });


        buttonContainer.appendChild(submitBtn);
        buttonContainer.appendChild(cancelBtn);

        contentEl.appendChild(text);
        contentEl.appendChild(buttonContainer);
    }

    onClose() {
        const { contentEl }=this;
        contentEl.empty();
        this.resolvePromise(this.result);
    }

    async openAndAwait(): Promise<boolean> {
        return new Promise((resolve) => {
            this.resolvePromise=resolve;
            this.open();
        });
    }
}


class ImageSelectorModal extends FuzzySuggestModal<TFile> {
    private resolvePromise: (value: string) => void;
    private images: TFile[]=[];

    constructor(app: App,private imagesFolder: string) {
        super(app);
        this.setPlaceholder("Select an image from vault");
        this.loadImages();
    }

    private async loadImages() {
        await ensureImagesFolder();

        const files=this.app.vault.getFiles().filter(file => {
            return file.path.startsWith(this.imagesFolder)&&allowedExtensions.includes(file.extension.toLowerCase());
        });

        this.images=files;
    }

    getItems(): TFile[] {
        return this.images;
    }

    getItemText(item: TFile): string {
        return item.name;
    }

    onChooseItem(item: TFile): void {
        this.resolvePromise(item.path);
        this.close();
    }

    async openAndAwait(): Promise<string> {
        return new Promise((resolve) => {
            this.resolvePromise=resolve;
            this.open();
        });
    }
}

export class ImageComponent {
    private app: App;
    private container: HTMLElement;
    private value: string;
    private onChangeCb: (value: string) => void;

    constructor(app: App,containerEl: HTMLElement) {
        this.app=app;
        this.container=containerEl;
        this.value='';
    }

    setValue(value: string) {
        this.value=value;
        return this;
    }

    onChange(cb: (value: string) => void) {
        this.onChangeCb=cb;
        return this;
    }

    render() {
        this.container.empty();

        //BUTTONS CONTAINER
        const buttonsContainer=node('div',{ class: 'image-buttons-container' });

        //FILE INPUT (UPLOAD)
        const fileLabel=node('label',{ class: 'file-input-label',text: 'Choose Image' });
        const fileInput=node('input',{ attributes: { type: 'file',accept: allowedExtensions.map(x => `.${x}`).join(','),class: 'file-input' } }) as HTMLInputElement;
        fileLabel.appendChild(fileInput);
        buttonsContainer.appendChild(fileLabel);

        //FROM VAULT BUTTON
        const fromVaultBtn=node('button',{ text: 'From Vault',class: 'from-vault-button' });
        buttonsContainer.appendChild(fromVaultBtn);

        //PREVIEW
        const previewContainer=node('div',{ class: 'image-preview-container' });
        this.updatePreview(previewContainer,this.value);

        //EVENT HANDLERS
        fileInput.addEventListener('change',async (event) => {
            if(fileInput.files&&fileInput.files.length>0) {
                const file=fileInput.files[0];
                await ensureImagesFolder();
                const newPath=await this.saveFileToImagesFolder(file);

                if(newPath) {
                    this.value=newPath;
                    this.updatePreview(previewContainer,this.value);
                    this.onChangeCb(this.value);
                }
            }
        });

        fromVaultBtn.addEventListener('click',async () => {
            await ensureImagesFolder();
            const imageSelectorModal=new ImageSelectorModal(this.app,IMAGES_FOLDER);
            const selectedPath=await imageSelectorModal.openAndAwait();

            if(selectedPath) {
                this.value=selectedPath;
                this.updatePreview(previewContainer,this.value);
                this.onChangeCb(this.value);
            }
        });

        this.container.appendChild(buttonsContainer);
        this.container.appendChild(previewContainer);
        return this;
    }



    private async saveFileToImagesFolder(file: File): Promise<string> {
        try {
            const destPath=`${IMAGES_FOLDER}/${file.name}`;
            const exists=await this.app.vault.adapter.exists(destPath);

            if(exists) {
                const modal=new ConfirmationModal(this.app,`An image with this name already exists. Would you like to overwrite it?`);
                const overwrite=await modal.openAndAwait();
                if(!overwrite) return ""
                else await this.app.vault.adapter.remove(destPath);
            }

            //Create file
            const arrayBuffer=await file.arrayBuffer();
            const buffer=new Uint8Array(arrayBuffer);
            await this.app.vault.createBinary(normalizePath(destPath),buffer);
            return destPath;
        } catch(error) {
            new Notice("Failed to save image: "+error.message);
            return "";
        }
    }

    private updatePreview(container: HTMLElement,imagePath: string) {
        container.empty();

        if(!imagePath) {
            container.appendChild(node('div',{ class: 'image-placeholder',text: 'No image selected' }));
            return;
        }

        const previewDiv=node('div',{ class: 'image-preview' });

        let imgSrc='';
        const file=this.app.vault.getAbstractFileByPath(imagePath);
        if(file instanceof TFile) imgSrc=this.app.vault.getResourcePath(file);

        const img=node('img',{ class: 'preview-image',attributes: { src: imgSrc,alt: 'Image preview' } });

        img.addEventListener('error',() => {
            console.error("Failed to load image:",imgSrc);
            previewDiv.empty();
            previewDiv.appendChild(node('div',{
                class: 'image-error',
                text: `Error loading image: ${imagePath}`
            }));
        });

        previewDiv.appendChild(img);
        container.appendChild(previewDiv);
    }
}


async function ensureImagesFolder(): Promise<void> {
    try {
        const exists=await this.app.vault.adapter.exists(IMAGES_FOLDER);
        if(!exists) await this.app.vault.createFolder(IMAGES_FOLDER);
    } catch(error) {
        new Notice("Failed to create images folder: "+error.message);
    }
}