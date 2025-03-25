import { templates } from "template";
import { TFile, App } from 'obsidian';

export interface NodeProperties {
    children?: HTMLElement[];
    attributes?: Record<string,string>;
    text?: string;
    class?: string;
    classes?: string[];
    style?: Record<string,string>;
}

export interface FormTemplate {
    name: string,
    contentType: string,
    defaultFolder?: string, // Now optional
    id?: string, // Added ID
    template: any
}

// UUID Generation
export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Find a content file by ID
export async function findContentById(app: App, id: string): Promise<TFile | null> {
    const files = app.vault.getMarkdownFiles();
    for (const file of files) {
        const metadata = app.metadataCache.getFileCache(file);
        if (metadata?.frontmatter?.data?.id === id) {
            return file;
        }
    }
    return null;
}

export function node<K extends keyof HTMLElementTagNameMap>(tag: K,properties?: NodeProperties): HTMLElementTagNameMap[K] {
    const element=document.createElement(tag);

    if(properties?.children)
        for(const c of properties.children) element.appendChild(c);

    if(properties?.class)
        element.setAttribute('class',properties.class);

    if(properties?.classes)
        properties?.classes.forEach(c => { element.addClass(c); });

    if(properties?.attributes)
        for(const [k,v] of Object.entries(properties.attributes)) element.setAttribute(k,v);

    if(properties?.text)
        element.textContent=properties.text;

    if(properties?.style)
        for(const [k,v] of Object.entries(properties.style)) element.attributeStyleMap.set(k,v);

    return element;
}

export function formatDisplayName(name: string): string {
    const result=name.replace(/([A-Z])/g,' $1').trim();
    return result.charAt(0).toUpperCase()+result.slice(1);
}

export function isObject(value: any): boolean {
    return typeof value==='object'&&value!==null&&!Array.isArray(value);
}

export function convertTemplateFormat(template: any) {
    const convertValue=(value: any): any => {
        if(typeof value==='object'&&value!==null) {
            // For objects with type property
            if(value.type) {
                //Handle group type specifically
                if(value.type==="group") {
                    const newObj: any={
                        type: value.type,
                        label: value.label || '',
                        fields: {}
                    };
                    
                    //Convert each field in the group
                    for(const [fieldKey,field] of Object.entries(value.fields || {})) {
                        newObj.fields[fieldKey]=convertValue(field);
                    }
                    
                    return newObj;
                } else {
                    //Handle field types
                    const newObj: any={
                        type: value.type,
                        value: null
                    };
                    
                    //Set default values based on field type
                    if(value.type==="boolean") {
                        newObj.value=value.default || false;
                    } else if(value.type==="dropdown") {
                        newObj.options=value.options || [];
                        newObj.allowCustom=value.allowCustom || false;
                    } else if(value.type==="badges") {
                        newObj.options=value.options || [];
                        newObj.value=[];
                    } else if(value.type.startsWith("array")) {
                        newObj.value=[];
                    }
                    
                    //Copy any other properties
                    for(const [propKey,propVal] of Object.entries(value)) {
                        if(propKey!=="type"&&propKey!=="value") {
                            newObj[propKey]=propVal;
                        }
                    }
                    
                    return newObj;
                }
            } 
            // For objects without type property (potentially container objects like content types or groups)
            else {
                const newObj: any={};
                
                for(const [key,val] of Object.entries(value)) {
                    newObj[key]=convertValue(val);
                }
                
                return newObj;
            }
        } else {
            return {
                value: value=="boolean"? false:null,
                type: value
            };
        }
    };
    return convertValue(template);
}


export function getTemplates(): { [key: string]: FormTemplate } {
    const data: { [key: string]: FormTemplate }={};

    Object.keys(templates).forEach((key: string) => {
        const templateObj=(templates as Record<string,any>)[key];
        const newObj: FormTemplate={
            name: templateObj.name||'',
            contentType: key,
            template: convertTemplateFormat(JSON.parse(JSON.stringify(templateObj||{})))
        };
        data[key]=newObj;
    });

    return data;
}

export function hasValueAndType(obj: any): boolean {
    return obj!==null
        &&typeof obj==='object'
        &&'value' in obj
        &&'type' in obj;
}

export function isGroupType(obj: any): boolean {
    return obj!==null
        &&typeof obj==='object'
        &&obj.type==="group"
        &&'fields' in obj;
}

// Enhanced link conversion that works with IDs
export function convertLinks(text: string): string {
    if(!text||typeof text!=='string') return text;
    
    // Match both standard wiki links and wiki links with IDs
    const wikiLinkRegex=/\[\[(.*?)(?:#(.*?))?(?:\|(.*?))?\]\]/g;
    
    return text.replace(wikiLinkRegex,(match, linkPath, linkId, displayText) => {
        const display = displayText ? displayText : linkPath;
        const idAttr = linkId ? `data-id="${linkId}"` : '';
        return `<a data-href="${linkPath}" href="${linkPath}" ${idAttr} class="internal-link content-link" target="_blank" rel="noopener nofollow">${display}</a>`;
    });
}

// Process a single link with ID
export function processLinks(content: string, id?: string): HTMLElement {
    const linkElement = node('a', {
        text: content,
        attributes: {
            'data-href': content,
            'href': content,
            'class': 'internal-link content-link',
            'target': '_blank',
            'rel': 'noopener nofollow'
        }
    });
    
    // Add ID attribute if provided
    if (id) {
        linkElement.setAttribute('data-id', id);
    }
    
    return linkElement;
}