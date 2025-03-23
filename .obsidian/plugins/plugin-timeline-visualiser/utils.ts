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

export function parseDateString(dateString: string, roundUp: boolean): Date | null {
    if (!dateString) return null;
    const cleanedString = dateString.trim();

    if (cleanedString.length === 4 && !cleanedString.includes('/')) {
        //Format: yyyy
        const year = parseInt(cleanedString, 10);
        if (roundUp) return new Date(year, 11, 31); //December 31st (months are 0-indexed)
        else return new Date(year, 0, 1);  //January 1st

    } else if (cleanedString.includes('/')) {
        const parts = cleanedString.split('/');

        //Format: mm/yyyy
        if (parts.length === 2) {
            const month = parseInt(parts[0], 10);
            const year = parseInt(parts[1], 10);

            //Get last day of month
            let lastDay = 31;
            if ([4, 6, 9, 11].includes(month)) lastDay = 30;
            else if (month === 2) lastDay = ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 29 : 28;


            if (roundUp) return new Date(year, month - 1, lastDay); //(months are 0-indexed)
            else return new Date(year, month - 1, 1);

            //Format: dd/mm/yyyy
        } else if (parts.length === 3) {
            //Parse parts
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
            
            return new Date(year, month - 1, day); //(months are 0-indexed)
        }
    }
    return null;
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