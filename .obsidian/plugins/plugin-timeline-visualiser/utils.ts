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

export function parseDateString(dateString: string, roundUp: boolean): string {
    if (!dateString) return ""

    const cleanedString = dateString.trim();

    if (cleanedString.length === 4 && !cleanedString.includes('/')) {
        //Format: yyyy
        const year = parseInt(cleanedString, 10);
        if (roundUp)
            return `31/12/${year}`;
        else
            return `01/01/${year}`;
    } else if (cleanedString.includes('/')) {
        const parts = cleanedString.split('/');

        //Format: mm/yyyy
        if (parts.length === 2) {
            const month = parseInt(parts[0], 10);
            const year = parseInt(parts[1], 10);
            if (roundUp)
                return `31/${month}/${year}`;
            else
                return `01/${month}/${year}`;
            //Format: dd/mm/yyyy
        } else if (parts.length === 3) {
            return dateString
        }
    }
    return ''
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