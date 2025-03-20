import { App } from 'obsidian';
import { node } from './utils';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import SuggestComponent from './SuggestComponent';

export class RichTextEditor {
    private app: App;
    private pages: string[];
    onChangeCb: (value: any) => void;

    constructor(app: App, pages: string[] = []) {
        this.app = app;
        this.pages = pages;
    }

    createRichTextEditor(container: HTMLElement, value: any, inputType: string) {
        const editorContainer = node('div', { class: 'editor-container' });
        const toolbar = node('div', { class: 'editor-toolbar editor-toolbar-hidden' });
        const contentArea = node('div', { class: 'editor-content' });

        let processedContent = value;

        const editor = new Editor({
            element: contentArea,
            extensions: [
                StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
                TextStyle.configure({}),
                Color,
            ],
            content: processedContent ? processedContent : Array(inputType == 'textarea' ? 5 : 1).fill('<p></p>').join(''),
            onUpdate: ({ editor }) => {
                const content = editor.getHTML();
                this.onChangeCb(content);
            }
        });

        // Create formatting buttons
        const boldButton = node('button', { class: 'editor-button', text: 'B', attributes: { 'title': 'Bold', 'type': 'button' } });
        boldButton.addEventListener('click', () => { editor.chain().focus().toggleBold().run(); });

        const italicButton = node('button', { class: 'editor-button', text: 'I', attributes: { 'title': 'Italic', 'type': 'button', 'style': 'font-style:italic' } });
        italicButton.addEventListener('click', () => { editor.chain().focus().toggleItalic().run(); });

        const strikeButton = node('button', { class: 'editor-button', text: 'S', attributes: { 'title': 'Strikethrough', 'type': 'button', 'style': 'text-decoration:line-through' } });
        strikeButton.addEventListener('click', () => { editor.chain().focus().toggleStrike().run(); });

        // Color picker with hidden input
        const colorContainer = node('div', { class: 'editor-color-container' });
        const colorButton = node('button', { class: 'editor-button', text: 'A', attributes: { 'title': 'Text Color', 'type': 'button' } });
        const colorInput = node('input', { class: 'editor-color-input', attributes: { type: 'color', title: 'Pick Text Color', value: getComputedStyle(document.body).getPropertyValue('--text-normal') } });

        colorInput.addEventListener('input', (event: any) => {
            const selectedColor = event.target.value;
            colorButton.style.color = selectedColor;
            editor.chain().focus().setColor(selectedColor).run();
        });
        colorButton.style.color = '#ffffff';
        colorButton.addEventListener('click', () => { colorInput.click(); });

        container.appendChild(editorContainer);
        editorContainer.appendChild(toolbar);
        editorContainer.appendChild(contentArea);

        colorContainer.appendChild(colorButton);
        colorContainer.appendChild(colorInput);

        toolbar.appendChild(colorContainer);
        toolbar.appendChild(boldButton);
        toolbar.appendChild(italicButton);
        toolbar.appendChild(strikeButton);

        let bulletListButton: HTMLButtonElement;
        let numberedListButton: HTMLButtonElement;

        // Add extra formatting options for textarea fields
        if (inputType == "textarea") {
            // Heading dropdown
            const headingDropdown = document.createElement('select');
            headingDropdown.className = 'editor-heading-select';
            headingDropdown.title = 'Heading Level';

            const headingLevels = [{ level: 0, name: 'Normal' }, { level: 1, name: 'Title 1' }, { level: 2, name: 'Title 2' }, { level: 3, name: 'Title 3' }];
            headingLevels.forEach(heading => {
                const option = document.createElement('option');
                option.value = heading.level.toString();
                option.textContent = heading.name;
                headingDropdown.appendChild(option);
            });
            headingDropdown.value = '0';

            headingDropdown.addEventListener('change', () => {
                const selectedLevel = parseInt(headingDropdown.value);
                if (selectedLevel === 0) {
                    editor.chain().focus().setParagraph().run();
                } else {
                    editor.chain().focus().setHeading({ level: selectedLevel as 1 | 2 | 3 }).run();
                }
            });

            // Update dropdown when editor selection changes
            editor.on('transaction', () => {
                if (editor.isActive('heading')) {
                    const currentLevel = editor.getAttributes('heading').level;
                    headingDropdown.value = currentLevel.toString();
                } else {
                    headingDropdown.value = '0';
                }
            });

            // List formatting buttons
            bulletListButton = node('button', { class: 'editor-button', text: '•', attributes: { 'title': 'Bullet List', 'type': 'button' } });
            bulletListButton.addEventListener('click', () => {
                editor.chain().focus().toggleBulletList().run();
                bulletListButton.classList.toggle('is-active', editor.isActive('bulletList'));
            });

            numberedListButton = node('button', { class: 'editor-button', text: '#', attributes: { 'title': 'Numbered List', 'type': 'button' } });
            numberedListButton.addEventListener('click', () => {
                editor.chain().focus().toggleOrderedList().run();
                numberedListButton.classList.toggle('is-active', editor.isActive('orderedList'));
            });

            toolbar.appendChild(headingDropdown);
            toolbar.appendChild(bulletListButton);
            toolbar.appendChild(numberedListButton);
        }

        // Update button states based on current formatting
        editor.on('transaction', () => {
            boldButton.classList.toggle('is-active', editor.isActive('bold'));
            italicButton.classList.toggle('is-active', editor.isActive('italic'));
            strikeButton.classList.toggle('is-active', editor.isActive('strike'));

            if (inputType == "textarea") {
                bulletListButton.classList.toggle('is-active', editor.isActive('bulletList'));
                numberedListButton.classList.toggle('is-active', editor.isActive('orderedList'));
            }

            if (editor.isActive('textStyle')) {
                const currentColor = editor.getAttributes('textStyle').color;
                if (currentColor) {
                    colorButton.style.color = currentColor;
                    colorInput.value = currentColor;
                }
            }
        });

        // Show toolbar on focus
        editor.on('focus', () => { toolbar.classList.remove('editor-toolbar-hidden'); });

        // Hide toolbar on blur (except when clicking toolbar itself)
        editor.on('blur', () => {
            setTimeout(() => {
                if (!editorContainer.contains(document.activeElement)) {
                    toolbar.classList.add('editor-toolbar-hidden');
                }
            }, 100);
        });

        new SuggestComponent(this.app, contentArea).setSuggestList(this.pages);
    }

    onChange(cb: (value: any) => void) {
        this.onChangeCb = cb;
        return this;
    }
}