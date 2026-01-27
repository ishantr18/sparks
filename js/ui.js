/**
 * UI Module
 * Handles all DOM manipulation and screen transitions
 */

const UI = {
    screens: {
        login: document.getElementById('screen-login'),
        folderSelect: document.getElementById('screen-folder-select'),
        categories: document.getElementById('screen-categories'),
        books: document.getElementById('screen-books'),
        reader: document.getElementById('screen-reader')
    },

    elements: {
        // Loading
        loadingOverlay: document.getElementById('loading-overlay'),
        loadingText: document.getElementById('loading-text'),

        // Toast
        toast: document.getElementById('toast'),
        toastMessage: document.getElementById('toast-message'),

        // User info
        userPill: document.getElementById('user-pill'),
        userAvatar: document.getElementById('user-avatar'),
        userName: document.getElementById('user-name'),

        // Stats
        statTotal: document.getElementById('stat-total'),
        statCompleted: document.getElementById('stat-completed'),
        statProgress: document.getElementById('stat-progress'),

        // Categories
        categoriesList: document.getElementById('categories-list'),

        // Books
        categoryTitle: document.getElementById('category-title'),
        categoryCount: document.getElementById('category-count'),
        booksList: document.getElementById('books-list'),

        // Reader
        readerBookTitle: document.getElementById('reader-book-title'),
        readerTitle: document.getElementById('reader-title'),
        readerAuthor: document.getElementById('reader-author'),
        readerText: document.getElementById('reader-text'),
        readerContent: document.getElementById('reader-content'),

        // Audio player
        playerCurrent: document.getElementById('player-current'),
        playerDuration: document.getElementById('player-duration'),
        playerBar: document.getElementById('player-bar'),
        playerBarFill: document.getElementById('player-bar-fill'),
        btnPlayPause: document.getElementById('btn-play-pause'),
        btnSpeed: document.getElementById('btn-speed')
    },

    currentScreen: 'login',
    toastTimeout: null,

    /**
     * Show a specific screen
     * @param {string} screenName - Screen name
     */
    showScreen(screenName) {
        // Hide all screens
        Object.values(this.screens).forEach(screen => {
            screen.classList.add('hidden');
        });

        // Show target screen
        if (this.screens[screenName]) {
            this.screens[screenName].classList.remove('hidden');
            this.currentScreen = screenName;
        }
    },

    /**
     * Show loading overlay
     * @param {string} message - Loading message
     */
    showLoading(message = 'Loading...') {
        this.elements.loadingText.textContent = message;
        this.elements.loadingOverlay.classList.remove('hidden');
    },

    /**
     * Hide loading overlay
     */
    hideLoading() {
        this.elements.loadingOverlay.classList.add('hidden');
    },

    /**
     * Show toast message
     * @param {string} message - Toast message
     * @param {number} duration - Duration in ms
     */
    showToast(message, duration = 3000) {
        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
        }

        this.elements.toastMessage.textContent = message;
        this.elements.toast.classList.remove('hidden');

        this.toastTimeout = setTimeout(() => {
            this.elements.toast.classList.add('hidden');
        }, duration);
    },

    /**
     * Update user info display
     * @param {object} user - User info
     */
    updateUserInfo(user) {
        const initial = user.displayName ? user.displayName.charAt(0).toUpperCase() : '?';
        this.elements.userAvatar.textContent = initial;
        this.elements.userName.textContent = `${user.displayName}'s Library`;
    },

    /**
     * Update stats display
     * @param {number} total - Total books
     * @param {number} completed - Completed books
     * @param {number} inProgress - In progress books
     */
    updateStats(total, completed, inProgress) {
        this.elements.statTotal.textContent = total;
        this.elements.statCompleted.textContent = completed;
        this.elements.statProgress.textContent = inProgress;
    },

    /**
     * Render categories list
     * @param {Array} categories - Categories array
     * @param {Function} onCategoryClick - Click handler
     */
    renderCategories(categories, onCategoryClick) {
        if (categories.length === 0) {
            this.elements.categoriesList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📁</div>
                    <div class="empty-title">No categories found</div>
                    <div class="empty-message">Create folders in your BookSummaries folder to organize your books</div>
                </div>
            `;
            return;
        }

        this.elements.categoriesList.innerHTML = categories.map(cat => `
            <div class="category-card" data-id="${cat.id}">
                <div class="category-icon" style="background: ${cat.bgColor}">${cat.icon}</div>
                <div class="category-info">
                    <div class="category-name">${this.escapeHtml(cat.name)}</div>
                    <div class="category-count">${cat.bookCount} book${cat.bookCount !== 1 ? 's' : ''}</div>
                </div>
                <div class="category-arrow">›</div>
            </div>
        `).join('');

        // Add click handlers
        this.elements.categoriesList.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', () => {
                const categoryId = card.dataset.id;
                const category = categories.find(c => c.id === categoryId);
                onCategoryClick(category);
            });
        });
    },

    /**
     * Update books screen header
     * @param {object} category - Category info
     */
    updateBooksHeader(category) {
        this.elements.categoryTitle.textContent = `${category.icon} ${category.name}`;
        this.elements.categoryCount.textContent = `${category.bookCount} book${category.bookCount !== 1 ? 's' : ''}`;
    },

    /**
     * Render books list grouped by status
     * @param {Array} books - Books array
     * @param {Function} onBookClick - Click handler
     */
    renderBooks(books, onBookClick) {
        if (books.length === 0) {
            this.elements.booksList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📖</div>
                    <div class="empty-title">No books found</div>
                    <div class="empty-message">Add .md, .txt, or .docx files to this folder</div>
                </div>
            `;
            return;
        }

        // Group books by status
        const inProgress = books.filter(b => b.status === 'in_progress');
        const unread = books.filter(b => b.status === 'unread');
        const completed = books.filter(b => b.status === 'completed');

        let html = '';

        if (inProgress.length > 0) {
            html += `<div class="books-section">
                <div class="books-section-title">In Progress</div>
                ${inProgress.map(book => this.renderBookCard(book)).join('')}
            </div>`;
        }

        if (unread.length > 0) {
            html += `<div class="books-section">
                <div class="books-section-title">Unread</div>
                ${unread.map(book => this.renderBookCard(book)).join('')}
            </div>`;
        }

        if (completed.length > 0) {
            html += `<div class="books-section">
                <div class="books-section-title">Completed</div>
                ${completed.map(book => this.renderBookCard(book)).join('')}
            </div>`;
        }

        this.elements.booksList.innerHTML = html;

        // Add click handlers
        this.elements.booksList.querySelectorAll('.book-card').forEach(card => {
            card.addEventListener('click', () => {
                const bookId = card.dataset.id;
                const book = books.find(b => b.id === bookId);
                onBookClick(book);
            });
        });
    },

    /**
     * Render a single book card
     * @param {object} book - Book info
     * @returns {string} HTML string
     */
    renderBookCard(book) {
        let statusHtml = '';
        let progressHtml = '';

        switch (book.status) {
            case 'unread':
                statusHtml = '<div class="book-status status-unread">○ Unread</div>';
                break;
            case 'in_progress':
                statusHtml = `<div class="book-status status-progress">▶ ${book.audioProgress}% complete</div>`;
                progressHtml = `<div class="progress-bar"><div class="progress-fill" style="width: ${book.audioProgress}%"></div></div>`;
                break;
            case 'completed':
                statusHtml = '<div class="book-status status-completed">✓ Completed</div>';
                break;
        }

        return `
            <div class="book-card" data-id="${book.id}">
                <div class="book-cover" style="background: ${book.coverGradient}">📖</div>
                <div class="book-info">
                    <div class="book-title">${this.escapeHtml(book.title)}</div>
                    <div class="book-author">${this.escapeHtml(book.fileName)}</div>
                    ${statusHtml}
                    ${progressHtml}
                </div>
            </div>
        `;
    },

    /**
     * Update reader content
     * @param {object} book - Book info
     * @param {string} htmlContent - Parsed HTML content
     */
    updateReaderContent(book, htmlContent) {
        this.elements.readerBookTitle.textContent = book.title;
        this.elements.readerTitle.textContent = book.title;
        this.elements.readerAuthor.textContent = book.fileName;
        this.elements.readerText.innerHTML = htmlContent;

        // Scroll to top
        this.elements.readerContent.scrollTop = 0;
    },

    /**
     * Update audio player display
     * @param {object} state - Player state
     */
    updatePlayerDisplay(state) {
        this.elements.playerCurrent.textContent = TTS.formatTime(state.currentPosition);
        this.elements.playerDuration.textContent = TTS.formatTime(state.totalDuration);
        this.elements.playerBarFill.style.width = `${state.percent}%`;
        this.elements.btnPlayPause.textContent = state.isPlaying ? '⏸' : '▶';
        this.elements.btnSpeed.textContent = `${state.rate}x`;
    },

    /**
     * Reset player display
     */
    resetPlayerDisplay() {
        this.elements.playerCurrent.textContent = '0:00';
        this.elements.playerDuration.textContent = '0:00';
        this.elements.playerBarFill.style.width = '0%';
        this.elements.btnPlayPause.textContent = '▶';
        this.elements.btnSpeed.textContent = `${Storage.getTTSRate() || 1}x`;
    },

    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
