export function cleanHtml(text: string): string {
    if (!text) return "";
    return text.replace(/<\/?[^>]+(>|$)/g, "").trim();
}

export function cleanLink(text: string): string {
    if (!text) return "";
    const wikiLinkRegex = /\[\[(.*?)(?:\|(.*?))?\]\]/g;
    return text.replace(wikiLinkRegex, (match, link, displayText) => {
        return displayText || link;
    });
}
export function extractLinks(text: string): string[] {
    if (!text) return [];

    const wikiLinkRegex = /\[\[(.*?)(?:\|.*?)?\]\]/g;
    const links: string[] = [];
    let match;

    while ((match = wikiLinkRegex.exec(text)) !== null) {
        //Extract the link part (before the pipe if it exists)
        const linkText = match[1].split('|')[0].trim();
        links.push(linkText);
    }

    return links;
}

export interface NodeProperties {
    children?: HTMLElement[];
    attributes?: Record<string, string>;
    text?: string;
    class?: string;
    classes?: string[];
    style?: Record<string, string>;
}


export function node<K extends keyof HTMLElementTagNameMap>(tag: K, properties?: NodeProperties): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);

    if (properties?.children)
        for (const c of properties.children) element.appendChild(c);

    if (properties?.class)
        element.setAttribute('class', properties.class);

    if (properties?.classes)
        properties?.classes.forEach(c => { element.addClass(c); });

    if (properties?.attributes)
        for (const [k, v] of Object.entries(properties.attributes)) element.setAttribute(k, v);

    if (properties?.text)
        element.textContent = properties.text;

    if (properties?.style)
        for (const [k, v] of Object.entries(properties.style)) element.attributeStyleMap.set(k, v);

    return element;
}


export function sortAndRemoveDuplicateDates(dateArray: Date[]): Date[] {
    const sortedDates = dateArray.sort((a: Date, b: Date) => a.getTime() - b.getTime());

    const uniqueDatesMap = new Map();
    sortedDates.forEach(date => {
        const timeValue = date.getTime();
        uniqueDatesMap.set(timeValue, date);
    });

    return Array.from(uniqueDatesMap.values());
}


export function hexToHSL(hex: string): { h: number; s: number; l: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

    if (!result) {
        throw new Error("Invalid hex color format");
    }

    let r = parseInt(result[1], 16);
    let g = parseInt(result[2], 16);
    let b = parseInt(result[3], 16);

    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }

        h /= 6;
    }
    return { h, s, l };
}

export function hslToString(hsl: { h: number; s: number; l: number }): string {
    const hDegrees = Math.round(hsl.h * 360);

    //Convert s and l from 0-1 range to percentage with 2 decimal places
    const sPercent = (hsl.s * 100).toFixed(2);
    const lPercent = (hsl.l * 100).toFixed(2);

    return `hsl(${hDegrees}deg ${sPercent}% ${lPercent}%)`;
}