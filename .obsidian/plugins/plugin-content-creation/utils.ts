import { templates } from "template";

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
    oldName: string,
    contentType: string,
    defaultFolder: string,
    template: any
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
            const newObj: any={};
            for(const [key,val] of Object.entries(value)) {
                newObj[key]=convertValue(val);
            }
            return newObj;
        } else {
            return {
                value: null,
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
            defaultFolder: templateObj.defaultFolder||'',
            name: templateObj.name||'',
            oldName: '',
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