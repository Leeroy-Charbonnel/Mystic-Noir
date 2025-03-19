import { App, PopoverSuggest } from 'obsidian';

export default class SuggestComponent {
    popover: any;
    parent: HTMLElement;
    suggetsList: string[];
    searchCriteria: string;
    bracketsIndices: number[];
    focusNode: Node;

    constructor(app: App, parent: HTMLElement) {
        this.parent = parent;
        this.popover = new (PopoverSuggest as any)(app);
        this.popover.selectSuggestion = this.selectSuggestion.bind(this);
        this.popover.renderSuggestion = this.renderSuggestion.bind(this);
        this.parent.addEventListener("input", (e: Event) => this.onInputChange(e));
        this.parent.addEventListener("blur", () => this.popover.close());
        this.popover.suggestEl.on("mousedown", ".suggestion-item", (e: MouseEvent) => e.preventDefault());
        this.addScrollListeners();
    }

    private addScrollListeners() {
        let element = this.parent;
        while (element) {
            if (element.scrollHeight > element.clientHeight) {
                element.addEventListener('scroll', () => {
                    if (this.popover.isOpen) this.updatePopoverPosition();
                });
            }
            (element as any) = element.parentElement;
        }

        // Add global scroll listener to reposition popover
        window.addEventListener('scroll', () => {
            if (this.popover.isOpen) this.updatePopoverPosition();
        }, true);
    }

    private updatePopoverPosition() {
        if (!this.focusNode) return;
        const pos = this.getPos();
        this.popover.reposition(pos);
    }

    onInputChange(e: any) {
        if (e == undefined) return;

        let selection = window.getSelection();
        if (!selection || !selection.rangeCount || !selection.focusNode) return;

        // Focus node = selected sub node in editor (p element, strong element, etc.)
        this.focusNode = selection.focusNode;
        let pos = selection.getRangeAt(0).startOffset;
        let value = this.getValue();

        // Auto-complete brackets, parentheses, etc.
        if (e.inputType === "insertText" && e.data) {
            const closeChars = new Map([
                ['{', '}'],
                ['[', ']'],
                ['(', ')']
            ]);
            const closeChar = closeChars.get(e.data);
            if (closeChar) {
                this.setValue([value.slice(0, pos), closeChar, value.slice(pos)].join(''));
                this.setCursorPosition(pos);
            }
        }

        // Get value again after auto-complete
        value = this.getValue();
        this.bracketsIndices = this.isBetweenBrackets(value, pos);

        if (this.bracketsIndices.length > 0) {
            this.searchCriteria = value.slice(this.bracketsIndices[0], this.bracketsIndices[1]).toLowerCase().trim();
            const suggests = this.searchCriteria === ""
                ? this.suggetsList
                : this.suggetsList.filter(e => e.toLowerCase().trim().includes(this.searchCriteria));

            if (suggests.length > 0) {
                this.popover.suggestions.setSuggestions(suggests);
                this.popover.open();
                this.popover.setAutoDestroy(this.parent);
                this.updatePopoverPosition();
            } else {
                this.popover.close();
            }
        } else {
            this.popover.close();
        }

        return;
    }

    isBetweenBrackets(value: string, pos: number) {
        // Find the last [[ before cursor
        const lastOpenBracket = value.lastIndexOf("[[", pos - 1);
        // Find the next ]] after cursor
        const nextCloseBracket = value.indexOf("]]", pos);

        // Special case: cursor is exactly between empty brackets [[]]
        if (pos >= 2 && pos <= value.length - 2 &&
            value.substring(pos - 2, pos) === "[[" &&
            value.substring(pos, pos + 2) === "]]") {
            return [pos, pos];
        }

        // If either bracket not found, return empty
        if (lastOpenBracket === -1 || nextCloseBracket === -1) {
            return [];
        }

        // Check for closing bracket between opening and cursor
        const closeBracketBetween = value.indexOf("]]", lastOpenBracket);
        if (closeBracketBetween !== -1 && closeBracketBetween < pos) {
            return [];
        }

        // Check for opening bracket between cursor and closing
        const openBracketBetween = value.indexOf("[[", pos);
        if (openBracketBetween !== -1 && openBracketBetween < nextCloseBracket) {
            return [];
        }

        return [lastOpenBracket + 2, nextCloseBracket];
    }

    selectSuggestion(value: string) {
        const oldValue = this.getValue();
        const newValue = oldValue.slice(0, this.bracketsIndices[0]) +
            value +
            oldValue.slice(this.bracketsIndices[1]);

        this.setValue(newValue);
        // +2 to place cursor after "]]"
        this.setCursorPosition(this.bracketsIndices[0] + value.length + 2);
        this.popover.close();
    }

    setCursorPosition(position: number) {
        const selection = window.getSelection();
        if (!selection) return;

        const range = document.createRange();
        const actualPos = Math.min(position, this.focusNode.textContent?.length || 0);
        range.setStart(this.focusNode, actualPos);
        range.collapse(true);

        selection.removeAllRanges();
        selection.addRange(range);
    }

    renderSuggestion(value: string, elmt: HTMLElement) {
        const strong = this.searchCriteria;
        const pos = value.toLowerCase().indexOf(strong.toLowerCase());

        elmt.createDiv(void 0, (div) => {
            div.createSpan({ text: value.substring(0, pos) });
            div.createEl("strong", { text: value.substring(pos, pos + strong.length) }).style.color = "var(--text-accent)";
            div.createSpan({ text: value.substring(pos + strong.length) });
        });
    }

    setSuggestList(values: string[]) {
        this.suggetsList = values;
        return this;
    }

    getValue(): string {
        //Get value of selected sub node only, not the whole html value of the editor
        return this.focusNode ? this.focusNode.textContent! : '';
    }

    setValue(value: string) {
        //Get value of selected sub node only, not the whole html value of the editor
        this.focusNode.textContent = value;
    }

    getPos(): {
        left: number;
        right: number;
        top: number;
        bottom: number;
        width: number;
        height: number;
    } {
        let pos = {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            width: 0,
            height: 0
        };

        if (!this.focusNode) return pos;
        const element = this.focusNode instanceof HTMLElement
            ? this.focusNode
            : this.focusNode.parentElement;
        if (!element) return pos;
        pos = element.getBoundingClientRect();
        return pos;
    }
}