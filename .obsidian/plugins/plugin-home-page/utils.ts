export const statsKeys: string[] = ["characters", "stories", "locations", "items", "events"];


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
