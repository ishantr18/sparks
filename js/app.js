/**
 * Main Application Controller
 * Coordinates all modules and handles user interactions
 */

const App = {
    currentCategory: null,
    currentBook: null,
    currentRawContent: null,  // Store raw content for TTS
    rootFolderId: null,
    categories: [],
    books: [],

    /**
     * Initialize the application
     */
    async init() {
        // Check configuration
        if (CONFIG.GOOGLE_CLIENT_ID === 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com') {
            UI.showToast('Please configure your Google Client ID in config.js');
            return;
        }

        UI.showLoading('Initializing...');

        try {
            // Initialize Google Drive API
            await Drive.init();

            // Set up event listeners
            this.setupEventListeners();

            // Check if we have a saved session
            this.rootFolderId = Storage.getRootFolderId();

            // Try to restore session by checking if we can make API calls
            // Note: Token may still be valid from previous session
            UI.hideLoading();
            UI.showScreen('login');

        } catch (error) {
            console.error('Initialization error:', error);
            UI.hideLoading();
            UI.showToast('Failed to initialize. Please refresh.');
        }
    },

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Login button
        document.getElementById('btn-login').addEventListener('click', () => this.handleLogin());

        // Logout button
        document.getElementById('btn-logout').addEventListener('click', () => this.handleLogout());

        // Folder select button
        document.getElementById('btn-select-folder').addEventListener('click', () => this.handleFolderSelect());

        // Back buttons
        document.getElementById('btn-back-categories').addEventListener('click', () => this.showCategories());
        document.getElementById('btn-back-books').addEventListener('click', () => this.showBooks());

        // Audio player controls
        document.getElementById('btn-play-pause').addEventListener('click', () => this.handlePlayPause());
        document.getElementById('btn-rewind').addEventListener('click', () => this.handleRewind());
        document.getElementById('btn-forward').addEventListener('click', () => this.handleForward());
        document.getElementById('btn-stop').addEventListener('click', () => this.handleStop());
        document.getElementById('btn-speed').addEventListener('click', () => this.handleSpeedChange());

        // Voice selector
        const btnVoice = document.getElementById('btn-voice');
        if (btnVoice) {
            btnVoice.addEventListener('click', () => this.handleVoiceButtonClick());
        }

        // Voice selector overlay click to close
        const voiceSelector = document.getElementById('voice-selector');
        if (voiceSelector) {
            voiceSelector.addEventListener('click', (e) => {
                if (e.target === voiceSelector) {
                    UI.hideVoiceSelector();
                }
            });
        }

        // Progress bar click
        document.getElementById('player-bar').addEventListener('click', (e) => this.handleProgressBarClick(e));
    },

    /**
     * Handle login button click
     */
    async handleLogin() {
        UI.showLoading('Signing in...');

        try {
            await Drive.signIn();

            // Get user info
            const user = await Drive.getUserInfo();
            Storage.saveUserInfo(user);
            UI.updateUserInfo(user);

            // Check if we have a root folder saved
            if (this.rootFolderId) {
                await this.loadCategoriesAndShow();
            } else {
                // Load picker API and show folder selection
                await loadPickerApi();
                UI.hideLoading();
                UI.showScreen('folderSelect');
            }

        } catch (error) {
            console.error('Login error:', error);
            UI.hideLoading();
            UI.showToast('Sign in failed. Please try again.');
        }
    },

    /**
     * Handle logout button click
     */
    handleLogout() {
        TTS.stop();
        Drive.signOut();
        this.rootFolderId = null;
        this.currentCategory = null;
        this.currentBook = null;
        this.currentRawContent = null;
        UI.showScreen('login');
        UI.showToast('Signed out');
    },

    /**
     * Handle folder selection
     */
    async handleFolderSelect() {
        try {
            const folder = await Drive.pickFolder();

            if (folder) {
                this.rootFolderId = folder.id;
                Storage.saveRootFolderId(folder.id);
                await this.loadCategoriesAndShow();
            }

        } catch (error) {
            console.error('Folder select error:', error);
            UI.showToast('Failed to select folder');
        }
    },

    /**
     * Load categories and show categories screen
     */
    async loadCategoriesAndShow() {
        UI.showLoading('Loading library...');

        try {
            // Get categories
            this.categories = await Drive.getCategories(this.rootFolderId);

            // Calculate stats
            const totalBooks = this.categories.reduce((sum, cat) => sum + cat.bookCount, 0);
            const progressStats = Storage.getStats();

            // Update UI
            const user = Storage.getUserInfo();
            if (user) {
                UI.updateUserInfo(user);
            }

            UI.updateStats(totalBooks, progressStats.completed, progressStats.inProgress);
            UI.renderCategories(this.categories, (category) => this.handleCategoryClick(category));

            UI.hideLoading();
            UI.showScreen('categories');

        } catch (error) {
            console.error('Load categories error:', error);
            UI.hideLoading();
            UI.showToast('Failed to load library');
        }
    },

    /**
     * Show categories screen
     */
    async showCategories() {
        TTS.stop();
        await this.loadCategoriesAndShow();
    },

    /**
     * Handle category click
     * @param {object} category - Category info
     */
    async handleCategoryClick(category) {
        this.currentCategory = category;
        UI.showLoading('Loading books...');

        try {
            this.books = await Drive.getBooks(category.id);
            UI.updateBooksHeader(category);
            UI.renderBooks(this.books, (book) => this.handleBookClick(book));

            UI.hideLoading();
            UI.showScreen('books');

        } catch (error) {
            console.error('Load books error:', error);
            UI.hideLoading();
            UI.showToast('Failed to load books');
        }
    },

    /**
     * Show books screen (for back navigation)
     */
    showBooks() {
        TTS.stop();
        UI.renderBooks(this.books, (book) => this.handleBookClick(book));
        UI.showScreen('books');
    },

    /**
     * Handle book click
     * @param {object} book - Book info
     */
    async handleBookClick(book) {
        this.currentBook = book;
        UI.showLoading('Loading book...');

        try {
            // Get file content
            const content = await Drive.getFileContent(book.id, book.mimeType);
            this.currentRawContent = content;

            // Parse content for display
            const parsed = Parser.parse(content, book.fileName);

            // Update UI
            UI.updateReaderContent(book, parsed.html);
            UI.resetPlayerDisplay();

            // Initialize TTS with raw content and filename
            TTS.init(content, book.fileName, {
                onProgress: (state) => this.handleTTSProgress(state),
                onEnd: () => this.handleTTSEnd(),
                onSaveProgress: (position, duration) => this.saveTTSProgress(position, duration),
                onVoicesChanged: (voices, currentVoice) => this.handleVoicesChanged(voices, currentVoice)
            });

            // Restore previous position if any
            const savedProgress = Storage.getBookProgress(book.id);
            if (savedProgress && savedProgress.audioPosition > 0) {
                TTS.restorePosition(savedProgress.audioPosition);
            }

            // Update player display with initial state
            UI.updatePlayerDisplay(TTS.getState());

            UI.hideLoading();
            UI.showScreen('reader');

        } catch (error) {
            console.error('Load book error:', error);
            UI.hideLoading();
            UI.showToast('Failed to load book');
        }
    },

    /**
     * Handle voices changed (async load)
     * @param {Array} voices - Available voices
     * @param {SpeechSynthesisVoice} currentVoice - Currently selected voice
     */
    handleVoicesChanged(voices, currentVoice) {
        UI.updateVoiceSelector(voices, currentVoice, (voiceName) => {
            TTS.setVoice(voiceName);
            UI.updatePlayerDisplay(TTS.getState());
        });

        // Update button text
        if (currentVoice) {
            const btnVoice = document.getElementById('btn-voice');
            if (btnVoice) {
                btnVoice.textContent = UI.shortenVoiceName(currentVoice.name);
            }
        }
    },

    /**
     * Handle voice button click
     */
    handleVoiceButtonClick() {
        // Update voice list with current selection
        const voices = TTS.getVoices();
        const currentVoice = TTS.getVoice();

        if (voices.length === 0) {
            UI.showToast('No voices available');
            return;
        }

        UI.updateVoiceSelector(voices, currentVoice, (voiceName) => {
            TTS.setVoice(voiceName);
            UI.updatePlayerDisplay(TTS.getState());
        });

        UI.toggleVoiceSelector();
    },

    /**
     * Handle play/pause button
     */
    handlePlayPause() {
        if (TTS.isPlaying) {
            TTS.pause();
        } else {
            TTS.play();
        }
        UI.updatePlayerDisplay(TTS.getState());
    },

    /**
     * Handle rewind button
     */
    handleRewind() {
        TTS.skipBackward();
        UI.updatePlayerDisplay(TTS.getState());
    },

    /**
     * Handle forward button
     */
    handleForward() {
        TTS.skipForward();
        UI.updatePlayerDisplay(TTS.getState());
    },

    /**
     * Handle stop button
     */
    handleStop() {
        TTS.stop();
        TTS.seekToPosition(0);
        UI.updatePlayerDisplay(TTS.getState());
    },

    /**
     * Handle speed change button
     */
    handleSpeedChange() {
        const newRate = TTS.cycleRate();
        UI.updatePlayerDisplay(TTS.getState());
        UI.showToast(`Speed: ${newRate}x`);
    },

    /**
     * Handle progress bar click
     * @param {Event} e - Click event
     */
    handleProgressBarClick(e) {
        const bar = document.getElementById('player-bar');
        const rect = bar.getBoundingClientRect();
        const percent = ((e.clientX - rect.left) / rect.width) * 100;

        TTS.seekToPercent(Math.max(0, Math.min(100, percent)));

        if (!TTS.isPlaying && !TTS.isPaused) {
            // If not playing, just update display
            UI.updatePlayerDisplay(TTS.getState());
        }
    },

    /**
     * Handle TTS progress update
     * @param {object} state - TTS state
     */
    handleTTSProgress(state) {
        UI.updatePlayerDisplay(state);
    },

    /**
     * Handle TTS playback end
     */
    handleTTSEnd() {
        if (this.currentBook) {
            Storage.markCompleted(this.currentBook.id);
            UI.showToast('Book completed!');
        }
        UI.updatePlayerDisplay(TTS.getState());
    },

    /**
     * Save TTS progress
     * @param {number} position - Current position in seconds
     * @param {number} duration - Total duration in seconds
     */
    saveTTSProgress(position, duration) {
        if (this.currentBook && position > 0) {
            Storage.markInProgress(this.currentBook.id, position, duration);
        }
    }
};

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Handle visibility change - DON'T pause when screen dims (for driving use case)
// We want the audio to continue playing
// Only pause if user explicitly leaves the app
document.addEventListener('visibilitychange', () => {
    // Don't auto-pause anymore - let wake lock handle screen dimming
    // User can manually pause if needed
});

// Save progress before page unload
window.addEventListener('beforeunload', () => {
    if (TTS.isPlaying || TTS.isPaused) {
        TTS.saveProgress();
    }
});

// Re-request wake lock when page becomes visible (in case it was released)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && TTS.isPlaying) {
        TTS.requestWakeLock();
    }
});
