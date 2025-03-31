import { TFile, App } from 'obsidian';

export interface NodeProperties {
    children?: HTMLElement[];
    attributes?: Record<string, string>;
    text?: string;
    class?: string;
    classes?: string[];
    style?: Record<string, string>;
}

// UUID Generation
export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function node(tag: keyof HTMLElementTagNameMap, properties?: NodeProperties): HTMLElement {
    const element = document.createElement(tag);
    
    if (properties?.children) {
        for (const c of properties.children) element.appendChild(c);
    }
    
    if (properties?.class) {
        element.setAttribute('class', properties.class);
    }
    
    if (properties?.classes) {
        properties?.classes.forEach(c => { element.addClass(c); });
    }
    
    if (properties?.attributes) {
        for (const [k, v] of Object.entries(properties.attributes)) element.setAttribute(k, v);
    }
    
    if (properties?.text) {
        element.textContent = properties.text;
    }
    
    if (properties?.style) {
        for (const [k, v] of Object.entries(properties.style)) element.style[k as any] = v;
    }
    
    return element;
}



export function isImageFile(file: TFile): boolean {
    const supportedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    return supportedExtensions.includes(file.extension.toLowerCase());
}


export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}