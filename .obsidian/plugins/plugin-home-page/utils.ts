export const statsKeys: string[] = ["characters", "stories", "locations", "items", "events"];

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


export function convertLinks(text: string): string {
    if (!text || typeof text !== 'string') return text;
    const wikiLinkRegex = /\[\[(.*?)(?:\|(.*?))?\]\]/g;
    return text.replace(wikiLinkRegex, (match, linkPath, displayText) => {
        const display = displayText ? displayText : linkPath;
        return `<a data-href="${linkPath}" href="${linkPath}" class="internal-link" target="_blank" rel="noopener nofollow">${display}</a>`;
    });
}


export function cleanHtml(text: string): string {
    if (!text) return "";
    return text.replace(/<\/?[^>]+(>|$)/g, "").trim();
}