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

interface ParsedDate {
    sortableDate: string; // YYYY-MM-DD format for sorting
    displayDate: string; // Original format for display
    year: number;
    month: number | null;
    day: number | null;
}

export function parseDateString(dateString: string): ParsedDate {
    if (!dateString) {
        return { 
            sortableDate: '', 
            displayDate: '', 
            year: 0, 
            month: null, 
            day: null 
        };
    }

    // Remove any HTML tags first
    dateString = cleanHtml(dateString);

    // Try to parse the date string
    let year = 0;
    let month: number | null = null;
    let day: number | null = null;
    let sortableDate = '';

    // Check for YYYY format (just year)
    const yearRegex = /^\s*(\d{4})\s*$/;
    const yearMatch = dateString.match(yearRegex);
    if (yearMatch) {
        year = parseInt(yearMatch[1]);
        sortableDate = `${year}`;
        return {
            sortableDate,
            displayDate: dateString,
            year,
            month,
            day
        };
    }

    // Check for MM/YYYY or MM-YYYY format
    const monthYearRegex = /^\s*(\d{1,2})[\/\-\.](\d{4})\s*$/;
    const monthYearMatch = dateString.match(monthYearRegex);
    if (monthYearMatch) {
        month = parseInt(monthYearMatch[1]);
        year = parseInt(monthYearMatch[2]);
        sortableDate = `${year}-${month.toString().padStart(2, '0')}`;
        return {
            sortableDate,
            displayDate: dateString,
            year,
            month,
            day
        };
    }

    // Check for DD/MM/YYYY or similar formats
    const fullDateRegex = /^\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\s*$/;
    const fullDateMatch = dateString.match(fullDateRegex);
    if (fullDateMatch) {
        day = parseInt(fullDateMatch[1]);
        month = parseInt(fullDateMatch[2]);
        year = parseInt(fullDateMatch[3]);
        sortableDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        return {
            sortableDate,
            displayDate: dateString,
            year,
            month,
            day
        };
    }

    // If we get here, try to use a generic Date parser as fallback
    try {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            year = date.getFullYear();
            month = date.getMonth() + 1; // JavaScript months are 0-indexed
            day = date.getDate();
            sortableDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            return {
                sortableDate,
                displayDate: dateString,
                year,
                month,
                day
            };
        }
    } catch (e) {
        console.log("Failed to parse date: ", dateString);
    }

    // If all else fails, just return the original string
    return {
        sortableDate: dateString,
        displayDate: dateString,
        year: 0,
        month: null,
        day: null
    };
}