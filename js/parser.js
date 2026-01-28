/**
 * Content Parser Module
 * Parses markdown, text, and docx content for display and TTS
 */

const Parser = {
    /**
     * Parse content based on file type
     * @param {string} content - Raw file content
     * @param {string} fileName - File name to determine type
     * @returns {object} Parsed content with HTML and plain text
     */
    parse(content, fileName) {
        const ext = fileName.split('.').pop().toLowerCase();

        switch (ext) {
            case 'md':
                return this.parseMarkdown(content);
            case 'txt':
                return this.parsePlainText(content);
            case 'docx':
                // DOCX is already converted to plain text by Drive API
                return this.parsePlainText(content);
            default:
                return this.parsePlainText(content);
        }
    },

    /**
     * Parse markdown content
     * @param {string} content - Markdown content
     * @returns {object} Parsed content
     */
    parseMarkdown(content) {
        let html = content;

        // Headers
        html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

        // Bold and italic
        html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/___(.*?)___/g, '<strong><em>$1</em></strong>');
        html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
        html = html.replace(/_(.*?)_/g, '<em>$1</em>');

        // Blockquotes
        html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');

        // Unordered lists
        html = html.replace(/^\s*[-*+] (.*$)/gm, '<li>$1</li>');

        // Ordered lists
        html = html.replace(/^\s*\d+\. (.*$)/gm, '<li>$1</li>');

        // Wrap consecutive list items
        html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
            return '<ul>' + match + '</ul>';
        });

        // Horizontal rules
        html = html.replace(/^---+$/gm, '<hr>');
        html = html.replace(/^\*\*\*+$/gm, '<hr>');

        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Links (basic)
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

        // Paragraphs - wrap non-tagged content
        const lines = html.split('\n');
        const processedLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (!line) {
                processedLines.push('');
                continue;
            }

            // Skip if already an HTML tag
            if (line.match(/^<(h[1-6]|ul|ol|li|blockquote|hr|p)/)) {
                processedLines.push(line);
            } else if (!line.startsWith('<')) {
                processedLines.push('<p>' + line + '</p>');
            } else {
                processedLines.push(line);
            }
        }

        html = processedLines.join('\n');

        // Clean up empty paragraphs
        html = html.replace(/<p><\/p>/g, '');

        // Get plain text for TTS
        const plainText = this.htmlToPlainText(html);

        return { html, plainText };
    },

    /**
     * Parse plain text content
     * @param {string} content - Plain text content
     * @returns {object} Parsed content
     */
    parsePlainText(content) {
        // Split into paragraphs on double newlines
        const paragraphs = content.split(/\n\n+/);

        const html = paragraphs
            .map(p => p.trim())
            .filter(p => p)
            .map(p => '<p>' + this.escapeHtml(p).replace(/\n/g, '<br>') + '</p>')
            .join('\n');

        return {
            html,
            plainText: content
        };
    },

    /**
     * Convert HTML to plain text for TTS
     * @param {string} html - HTML content
     * @returns {string} Plain text
     */
    htmlToPlainText(html) {
        // Create a temporary element to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Get text content
        let text = temp.textContent || temp.innerText || '';

        // Clean up whitespace
        text = text.replace(/\s+/g, ' ').trim();

        return text;
    },

    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    },

    /**
     * Parse content into chunks for TTS with pause information
     * @param {string} rawContent - Raw markdown/text content
     * @param {string} fileName - File name to determine type
     * @returns {Array<object>} Array of chunks with text and pauseAfter
     */
    parseIntoChunks(rawContent, fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const chunks = [];
        const pauses = CONFIG.TTS_PAUSES;

        if (ext === 'md') {
            // Parse markdown line by line
            const lines = rawContent.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmedLine = line.trim();

                if (!trimmedLine) {
                    continue; // Skip empty lines
                }

                // Detect line type and assign pause
                let type = 'paragraph';
                let pauseAfter = pauses.paragraph;
                let text = trimmedLine;

                // Check for headers
                if (trimmedLine.startsWith('#### ')) {
                    type = 'h4';
                    pauseAfter = pauses.h4;
                    text = trimmedLine.substring(5);
                } else if (trimmedLine.startsWith('### ')) {
                    type = 'h3';
                    pauseAfter = pauses.h3;
                    text = trimmedLine.substring(4);
                } else if (trimmedLine.startsWith('## ')) {
                    type = 'h2';
                    pauseAfter = pauses.h2;
                    text = trimmedLine.substring(3);
                } else if (trimmedLine.startsWith('# ')) {
                    type = 'h1';
                    pauseAfter = pauses.h1;
                    text = trimmedLine.substring(2);
                }
                // Check for list items
                else if (trimmedLine.match(/^[-*+] /)) {
                    type = 'listItem';
                    pauseAfter = pauses.listItem;
                    text = trimmedLine.substring(2);
                } else if (trimmedLine.match(/^\d+\. /)) {
                    type = 'listItem';
                    pauseAfter = pauses.listItem;
                    text = trimmedLine.replace(/^\d+\. /, '');
                }
                // Check for blockquotes
                else if (trimmedLine.startsWith('> ')) {
                    type = 'blockquote';
                    pauseAfter = pauses.paragraph;
                    text = trimmedLine.substring(2);
                }
                // Skip horizontal rules
                else if (trimmedLine.match(/^[-*]{3,}$/)) {
                    continue;
                }

                // Clean up markdown formatting from text
                text = this.stripMarkdownFormatting(text);

                if (text.trim()) {
                    chunks.push({
                        text: text.trim(),
                        type,
                        pauseAfter
                    });
                }
            }
        } else {
            // Plain text: split on double newlines for paragraphs
            const paragraphs = rawContent.split(/\n\n+/);

            for (const para of paragraphs) {
                const trimmed = para.trim();
                if (trimmed) {
                    // Check for single newlines within paragraph
                    const lines = trimmed.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (line) {
                            chunks.push({
                                text: line,
                                type: 'paragraph',
                                pauseAfter: i === lines.length - 1 ? pauses.paragraph : pauses.newline
                            });
                        }
                    }
                }
            }
        }

        return chunks;
    },

    /**
     * Strip markdown formatting from text (for TTS)
     * @param {string} text - Text with markdown
     * @returns {string} Plain text
     */
    stripMarkdownFormatting(text) {
        return text
            // Bold and italic
            .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/___(.*?)___/g, '$1')
            .replace(/__(.*?)__/g, '$1')
            .replace(/_(.*?)_/g, '$1')
            // Inline code
            .replace(/`([^`]+)`/g, '$1')
            // Links - keep the text, remove URL
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            // Clean up extra whitespace
            .replace(/\s+/g, ' ')
            .trim();
    },

    /**
     * Split text into sentences for TTS
     * @param {string} text - Plain text
     * @returns {Array<string>} Array of sentences
     */
    splitIntoSentences(text) {
        // Split on sentence-ending punctuation followed by space or end
        const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];

        return sentences
            .map(s => s.trim())
            .filter(s => s.length > 0);
    },

    /**
     * Estimate reading time
     * @param {string} text - Plain text
     * @param {number} wordsPerMinute - Reading speed (default 200)
     * @returns {number} Estimated minutes
     */
    estimateReadingTime(text, wordsPerMinute = 200) {
        const words = text.split(/\s+/).length;
        return Math.ceil(words / wordsPerMinute);
    },

    /**
     * Estimate TTS duration for chunks
     * @param {Array<object>} chunks - Parsed chunks
     * @param {number} rate - TTS rate (default 1.0)
     * @returns {number} Estimated seconds
     */
    estimateChunksDuration(chunks, rate = 1.0) {
        if (!chunks || chunks.length === 0) return 0;

        let totalMs = 0;
        const wordsPerMinute = 150 * rate;
        const msPerWord = 60000 / wordsPerMinute;

        for (const chunk of chunks) {
            // Estimate speech time
            const words = chunk.text.split(/\s+/).filter(w => w).length;
            totalMs += words * msPerWord;

            // Add pause time
            totalMs += chunk.pauseAfter;
        }

        return Math.max(1, Math.round(totalMs / 1000));
    },

    /**
     * Estimate TTS duration (legacy support)
     * @param {string} text - Plain text
     * @param {number} rate - TTS rate (default 1.0)
     * @returns {number} Estimated seconds
     */
    estimateTTSDuration(text, rate = 1.0) {
        if (!text || !text.trim()) return 0;

        // Average TTS speaks about 150 words per minute at 1.0x
        const wordsPerMinute = 150 * rate;
        const words = text.trim().split(/\s+/).filter(w => w).length;
        const duration = Math.round((words / wordsPerMinute) * 60);

        // Minimum 1 second if there's any text
        return Math.max(duration, words > 0 ? 1 : 0);
    }
};
