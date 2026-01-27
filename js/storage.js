/**
 * Storage Module
 * Handles local storage for progress tracking and user preferences
 */

const Storage = {
    /**
     * Get user progress data
     * @returns {object} Progress data for all books
     */
    getProgress() {
        try {
            const data = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_PROGRESS);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Error reading progress:', e);
            return {};
        }
    },

    /**
     * Save user progress data
     * @param {object} progress - Progress data object
     */
    saveProgress(progress) {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER_PROGRESS, JSON.stringify(progress));
        } catch (e) {
            console.error('Error saving progress:', e);
        }
    },

    /**
     * Get progress for a specific book
     * @param {string} fileId - Google Drive file ID
     * @returns {object|null} Book progress or null
     */
    getBookProgress(fileId) {
        const progress = this.getProgress();
        return progress[fileId] || null;
    },

    /**
     * Update progress for a specific book
     * @param {string} fileId - Google Drive file ID
     * @param {object} bookProgress - Progress data for the book
     */
    updateBookProgress(fileId, bookProgress) {
        const progress = this.getProgress();
        progress[fileId] = {
            ...progress[fileId],
            ...bookProgress,
            lastUpdated: Date.now()
        };
        this.saveProgress(progress);
    },

    /**
     * Mark book as completed
     * @param {string} fileId - Google Drive file ID
     */
    markCompleted(fileId) {
        this.updateBookProgress(fileId, {
            status: 'completed',
            completedAt: Date.now(),
            audioPosition: 0,
            audioProgress: 100
        });
    },

    /**
     * Mark book as in progress
     * @param {string} fileId - Google Drive file ID
     * @param {number} audioPosition - Current audio position in seconds
     * @param {number} audioDuration - Total audio duration in seconds
     */
    markInProgress(fileId, audioPosition, audioDuration) {
        const audioProgress = audioDuration > 0
            ? Math.round((audioPosition / audioDuration) * 100)
            : 0;

        this.updateBookProgress(fileId, {
            status: 'in_progress',
            audioPosition,
            audioDuration,
            audioProgress
        });
    },

    /**
     * Get book status
     * @param {string} fileId - Google Drive file ID
     * @returns {string} Status: 'unread', 'in_progress', or 'completed'
     */
    getBookStatus(fileId) {
        const progress = this.getBookProgress(fileId);
        return progress?.status || 'unread';
    },

    /**
     * Get root folder ID
     * @returns {string|null} Root folder ID or null
     */
    getRootFolderId() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.ROOT_FOLDER_ID);
    },

    /**
     * Save root folder ID
     * @param {string} folderId - Google Drive folder ID
     */
    saveRootFolderId(folderId) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.ROOT_FOLDER_ID, folderId);
    },

    /**
     * Get user info
     * @returns {object|null} User info or null
     */
    getUserInfo() {
        try {
            const data = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_INFO);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    },

    /**
     * Save user info
     * @param {object} userInfo - User info object
     */
    saveUserInfo(userInfo) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.USER_INFO, JSON.stringify(userInfo));
    },

    /**
     * Get TTS rate preference
     * @returns {number} TTS rate
     */
    getTTSRate() {
        const rate = localStorage.getItem(CONFIG.STORAGE_KEYS.TTS_RATE);
        return rate ? parseFloat(rate) : CONFIG.TTS_DEFAULT_RATE;
    },

    /**
     * Save TTS rate preference
     * @param {number} rate - TTS rate
     */
    saveTTSRate(rate) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.TTS_RATE, rate.toString());
    },

    /**
     * Clear all storage (logout)
     */
    clearAll() {
        Object.values(CONFIG.STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    },

    /**
     * Get statistics from progress data
     * @returns {object} Stats: total, completed, inProgress
     */
    getStats() {
        const progress = this.getProgress();
        const books = Object.values(progress);

        return {
            completed: books.filter(b => b.status === 'completed').length,
            inProgress: books.filter(b => b.status === 'in_progress').length
        };
    },

    /**
     * Export progress data (for backup)
     * @returns {string} JSON string of all progress data
     */
    exportData() {
        return JSON.stringify({
            progress: this.getProgress(),
            rootFolderId: this.getRootFolderId(),
            ttsRate: this.getTTSRate(),
            exportedAt: new Date().toISOString()
        }, null, 2);
    },

    /**
     * Import progress data (from backup)
     * @param {string} jsonData - JSON string of progress data
     */
    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (data.progress) {
                this.saveProgress(data.progress);
            }
            if (data.rootFolderId) {
                this.saveRootFolderId(data.rootFolderId);
            }
            if (data.ttsRate) {
                this.saveTTSRate(data.ttsRate);
            }
            return true;
        } catch (e) {
            console.error('Error importing data:', e);
            return false;
        }
    }
};
