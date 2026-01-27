/**
 * Configuration for Sparks App
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a new project or select existing
 * 3. Enable Google Drive API
 * 4. Create OAuth 2.0 credentials (Web application)
 * 5. Add your GitHub Pages URL to Authorized JavaScript origins
 * 6. Copy the Client ID and paste below
 */

const CONFIG = {
    // ===========================================
    // PASTE YOUR GOOGLE CLIENT ID HERE
    // ===========================================
    GOOGLE_CLIENT_ID: '627209789527-n3tu4t54itfpfn2d0vtg7l9kmiua08lh.apps.googleusercontent.com',

    // Google API settings (don't change these)
    GOOGLE_API_KEY: '', // Not needed for OAuth flow
    SCOPES: 'https://www.googleapis.com/auth/drive.readonly',

    // App settings
    APP_NAME: 'Sparks',

    // Progress save interval (in milliseconds)
    PROGRESS_SAVE_INTERVAL: 60000, // Save every 60 seconds

    // TTS settings
    TTS_DEFAULT_RATE: 1.0,
    TTS_RATES: [0.75, 1.0, 1.25, 1.5, 1.75, 2.0],

    // Rewind/Forward skip duration (in seconds)
    SKIP_DURATION: 15,

    // Supported file extensions
    SUPPORTED_EXTENSIONS: ['.md', '.txt', '.docx'],

    // Storage keys
    STORAGE_KEYS: {
        ROOT_FOLDER_ID: 'booksummary_root_folder_id',
        USER_PROGRESS: 'booksummary_progress',
        USER_INFO: 'booksummary_user_info',
        TTS_RATE: 'booksummary_tts_rate'
    }
};

// Validation
if (CONFIG.GOOGLE_CLIENT_ID === 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com') {
    console.warn('⚠️ Please configure your Google Client ID in js/config.js');
}
