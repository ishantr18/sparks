/**
 * Google Drive Module
 * Handles authentication and file operations with Google Drive
 */

const Drive = {
    tokenClient: null,
    accessToken: null,
    isInitialized: false,

    /**
     * Initialize Google API client
     * @returns {Promise<void>}
     */
    async init() {
        return new Promise((resolve, reject) => {
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        apiKey: CONFIG.GOOGLE_API_KEY,
                        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
                    });

                    // Initialize token client
                    this.tokenClient = google.accounts.oauth2.initTokenClient({
                        client_id: CONFIG.GOOGLE_CLIENT_ID,
                        scope: CONFIG.SCOPES,
                        callback: (response) => {
                            if (response.error) {
                                reject(response);
                                return;
                            }
                            this.accessToken = response.access_token;
                            resolve();
                        }
                    });

                    this.isInitialized = true;
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });
    },

    /**
     * Request access token (sign in)
     * @returns {Promise<void>}
     */
    async signIn() {
        return new Promise((resolve, reject) => {
            if (!this.tokenClient) {
                reject(new Error('Token client not initialized'));
                return;
            }

            this.tokenClient.callback = (response) => {
                if (response.error) {
                    reject(response);
                    return;
                }
                this.accessToken = response.access_token;
                resolve();
            };

            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        });
    },

    /**
     * Sign out and revoke access
     */
    signOut() {
        if (this.accessToken) {
            google.accounts.oauth2.revoke(this.accessToken);
            this.accessToken = null;
        }
        Storage.clearAll();
    },

    /**
     * Check if user is signed in
     * @returns {boolean}
     */
    isSignedIn() {
        return !!this.accessToken;
    },

    /**
     * Get current user info
     * @returns {Promise<object>}
     */
    async getUserInfo() {
        const response = await gapi.client.drive.about.get({
            fields: 'user(displayName, emailAddress, photoLink)'
        });
        return response.result.user;
    },

    /**
     * List folders in a parent folder
     * @param {string} parentId - Parent folder ID ('root' for root)
     * @returns {Promise<Array>}
     */
    async listFolders(parentId = 'root') {
        const response = await gapi.client.drive.files.list({
            q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            orderBy: 'name'
        });
        return response.result.files || [];
    },

    /**
     * List files in a folder with supported extensions
     * @param {string} folderId - Folder ID
     * @returns {Promise<Array>}
     */
    async listFiles(folderId) {
        // Build query for supported file types
        const mimeTypes = [
            "mimeType='text/plain'",
            "mimeType='text/markdown'",
            "mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'"
        ];

        const response = await gapi.client.drive.files.list({
            q: `'${folderId}' in parents and (${mimeTypes.join(' or ')}) and trashed=false`,
            fields: 'files(id, name, mimeType, modifiedTime)',
            orderBy: 'name'
        });

        // Filter by extension as well (for .md files that might have text/plain mime type)
        const files = response.result.files || [];
        return files.filter(file => {
            const ext = '.' + file.name.split('.').pop().toLowerCase();
            return CONFIG.SUPPORTED_EXTENSIONS.includes(ext);
        });
    },

    /**
     * Get all categories (subfolders) with their book counts
     * @param {string} rootFolderId - Root folder ID
     * @returns {Promise<Array>}
     */
    async getCategories(rootFolderId) {
        const folders = await this.listFolders(rootFolderId);
        const categories = [];

        for (const folder of folders) {
            // Skip 'progress' folder
            if (folder.name.toLowerCase() === 'progress') continue;

            const files = await this.listFiles(folder.id);
            const iconData = getCategoryIcon(folder.name);

            categories.push({
                id: folder.id,
                name: iconData.displayName,
                icon: iconData.icon,
                bgColor: iconData.bg,
                bookCount: files.length
            });
        }

        return categories;
    },

    /**
     * Get books in a category with their progress status
     * @param {string} categoryId - Category folder ID
     * @returns {Promise<Array>}
     */
    async getBooks(categoryId) {
        const files = await this.listFiles(categoryId);
        const books = [];

        for (const file of files) {
            const progress = Storage.getBookProgress(file.id);
            const status = progress?.status || 'unread';

            // Extract book title (remove extension)
            const title = file.name.replace(/\.(md|txt|docx)$/i, '');

            books.push({
                id: file.id,
                title: title,
                fileName: file.name,
                mimeType: file.mimeType,
                modifiedTime: file.modifiedTime,
                status: status,
                audioProgress: progress?.audioProgress || 0,
                audioPosition: progress?.audioPosition || 0,
                lastUpdated: progress?.lastUpdated || 0,
                coverGradient: getBookCoverGradient(title)
            });
        }

        // Sort: in_progress first (by lastUpdated), then unread (alphabetically), then completed
        return books.sort((a, b) => {
            const statusOrder = { 'in_progress': 0, 'unread': 1, 'completed': 2 };

            if (statusOrder[a.status] !== statusOrder[b.status]) {
                return statusOrder[a.status] - statusOrder[b.status];
            }

            // Within same status
            if (a.status === 'in_progress') {
                // Most recently accessed first
                return b.lastUpdated - a.lastUpdated;
            } else if (a.status === 'completed') {
                // Most recently completed first
                return b.lastUpdated - a.lastUpdated;
            } else {
                // Alphabetically for unread
                return a.title.localeCompare(b.title);
            }
        });
    },

    /**
     * Get file content
     * @param {string} fileId - File ID
     * @param {string} mimeType - File MIME type
     * @returns {Promise<string>}
     */
    async getFileContent(fileId, mimeType) {
        if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            // For DOCX, export as plain text
            const response = await gapi.client.drive.files.export({
                fileId: fileId,
                mimeType: 'text/plain'
            });
            return response.body;
        } else {
            // For text/markdown files
            const response = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });
            return response.body;
        }
    },

    /**
     * Open folder picker
     * @returns {Promise<object|null>} Selected folder or null
     */
    async pickFolder() {
        return new Promise((resolve) => {
            const picker = new google.picker.PickerBuilder()
                .addView(new google.picker.DocsView()
                    .setIncludeFolders(true)
                    .setSelectFolderEnabled(true)
                    .setMimeTypes('application/vnd.google-apps.folder'))
                .setOAuthToken(this.accessToken)
                .setCallback((data) => {
                    if (data.action === google.picker.Action.PICKED) {
                        resolve(data.docs[0]);
                    } else if (data.action === google.picker.Action.CANCEL) {
                        resolve(null);
                    }
                })
                .build();

            picker.setVisible(true);
        });
    },

    /**
     * Get total book count across all categories
     * @param {string} rootFolderId - Root folder ID
     * @returns {Promise<number>}
     */
    async getTotalBookCount(rootFolderId) {
        const categories = await this.getCategories(rootFolderId);
        return categories.reduce((sum, cat) => sum + cat.bookCount, 0);
    }
};

// Load Google Picker API when needed
function loadPickerApi() {
    return new Promise((resolve) => {
        gapi.load('picker', resolve);
    });
}
