export function cleanHtml(text: string): string {
    if (!text) return "";
    return text.replace(/<\/?[^>]+(>|$)/g, "").trim();
}