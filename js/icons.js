/**
 * Category Icon Mapping
 * Automatically assigns icons based on category folder names
 */

const CATEGORY_ICONS = {
    // Productivity & Work
    productivity: { icon: '🎯', bg: '#E8F5E9' },
    habits: { icon: '🎯', bg: '#E8F5E9' },
    time: { icon: '⏰', bg: '#FFF3E0' },
    focus: { icon: '🎯', bg: '#E8F5E9' },
    efficiency: { icon: '⚡', bg: '#FFF8E1' },
    work: { icon: '💼', bg: '#F3E5F5' },

    // Finance & Money
    finance: { icon: '💰', bg: '#E3F2FD' },
    money: { icon: '💰', bg: '#E3F2FD' },
    invest: { icon: '📈', bg: '#E8F5E9' },
    wealth: { icon: '💎', bg: '#E3F2FD' },
    trading: { icon: '📊', bg: '#E3F2FD' },
    crypto: { icon: '🪙', bg: '#FFF8E1' },
    economics: { icon: '💹', bg: '#E3F2FD' },

    // Psychology & Mind
    psychology: { icon: '🧠', bg: '#FFF3E0' },
    mind: { icon: '🧠', bg: '#FFF3E0' },
    think: { icon: '💭', bg: '#F3E5F5' },
    mental: { icon: '🧠', bg: '#FFF3E0' },
    cognitive: { icon: '🧠', bg: '#FFF3E0' },
    behavior: { icon: '🔄', bg: '#E8F5E9' },
    emotional: { icon: '❤️', bg: '#FCE4EC' },

    // Health & Wellness
    health: { icon: '❤️', bg: '#FCE4EC' },
    wellness: { icon: '🌿', bg: '#E8F5E9' },
    fitness: { icon: '💪', bg: '#E3F2FD' },
    exercise: { icon: '🏃', bg: '#E3F2FD' },
    nutrition: { icon: '🥗', bg: '#E8F5E9' },
    diet: { icon: '🍎', bg: '#FFEBEE' },
    sleep: { icon: '😴', bg: '#E8EAF6' },
    meditation: { icon: '🧘', bg: '#F3E5F5' },
    mindfulness: { icon: '🧘', bg: '#F3E5F5' },

    // Business & Leadership
    business: { icon: '💼', bg: '#F3E5F5' },
    startup: { icon: '🚀', bg: '#E3F2FD' },
    entrepreneur: { icon: '🚀', bg: '#E3F2FD' },
    leadership: { icon: '👔', bg: '#E8EAF6' },
    management: { icon: '👔', bg: '#E8EAF6' },
    marketing: { icon: '📢', bg: '#FFF3E0' },
    sales: { icon: '🤝', bg: '#E8F5E9' },
    strategy: { icon: '♟️', bg: '#F3E5F5' },
    negotiation: { icon: '🤝', bg: '#E8F5E9' },

    // Self-Help & Personal Development
    'self-help': { icon: '⭐', bg: '#FFF8E1' },
    selfhelp: { icon: '⭐', bg: '#FFF8E1' },
    personal: { icon: '⭐', bg: '#FFF8E1' },
    growth: { icon: '🌱', bg: '#E8F5E9' },
    motivation: { icon: '🔥', bg: '#FFF3E0' },
    inspiration: { icon: '✨', bg: '#FFF8E1' },
    success: { icon: '🏆', bg: '#FFF8E1' },
    confidence: { icon: '💪', bg: '#E3F2FD' },
    happiness: { icon: '😊', bg: '#FFF8E1' },

    // Communication & Relationships
    communication: { icon: '💬', bg: '#E3F2FD' },
    relationship: { icon: '❤️', bg: '#FCE4EC' },
    social: { icon: '👥', bg: '#E8EAF6' },
    influence: { icon: '🎯', bg: '#E8F5E9' },
    persuasion: { icon: '🗣️', bg: '#FFF3E0' },
    networking: { icon: '🔗', bg: '#E3F2FD' },
    parenting: { icon: '👨‍👩‍👧', bg: '#FCE4EC' },

    // Science & Technology
    science: { icon: '🔬', bg: '#E8EAF6' },
    tech: { icon: '💻', bg: '#E3F2FD' },
    technology: { icon: '💻', bg: '#E3F2FD' },
    ai: { icon: '🤖', bg: '#E8EAF6' },
    programming: { icon: '👨‍💻', bg: '#E3F2FD' },
    data: { icon: '📊', bg: '#E8F5E9' },

    // History & Biography
    history: { icon: '📜', bg: '#FFF8E1' },
    biography: { icon: '👤', bg: '#E8EAF6' },
    memoir: { icon: '📔', bg: '#FFF3E0' },

    // Philosophy & Spirituality
    philosophy: { icon: '💭', bg: '#F3E5F5' },
    spiritual: { icon: '🕊️', bg: '#E8EAF6' },
    religion: { icon: '🙏', bg: '#FFF8E1' },
    stoic: { icon: '🏛️', bg: '#E8EAF6' },

    // Creativity & Arts
    creativity: { icon: '🎨', bg: '#FCE4EC' },
    art: { icon: '🎨', bg: '#FCE4EC' },
    design: { icon: '✏️', bg: '#F3E5F5' },
    writing: { icon: '✍️', bg: '#FFF3E0' },
    music: { icon: '🎵', bg: '#FCE4EC' },

    // Education & Learning
    education: { icon: '📚', bg: '#E3F2FD' },
    learning: { icon: '📖', bg: '#E8F5E9' },
    study: { icon: '📝', bg: '#FFF3E0' },
    memory: { icon: '🧠', bg: '#FFF3E0' },
    reading: { icon: '📖', bg: '#E8F5E9' }
};

// Default icon for unmatched categories
const DEFAULT_ICON = { icon: '📁', bg: '#f0f0f0' };

/**
 * Get icon and background color for a category name
 * @param {string} categoryName - The folder/category name
 * @returns {object} - { icon: string, bg: string }
 */
function getCategoryIcon(categoryName) {
    const lowerName = categoryName.toLowerCase();

    // Check if category name starts with an emoji
    const emojiMatch = categoryName.match(/^(\p{Emoji})\s*/u);
    if (emojiMatch) {
        return {
            icon: emojiMatch[1],
            bg: '#f0f0f0',
            displayName: categoryName.replace(emojiMatch[0], '').trim()
        };
    }

    // Search for keyword matches
    for (const [keyword, iconData] of Object.entries(CATEGORY_ICONS)) {
        if (lowerName.includes(keyword)) {
            return { ...iconData, displayName: categoryName };
        }
    }

    // Return default
    return { ...DEFAULT_ICON, displayName: categoryName };
}

/**
 * Generate a consistent color for book covers based on title
 * @param {string} title - Book title
 * @returns {string} - CSS gradient
 */
function getBookCoverGradient(title) {
    const gradients = [
        'linear-gradient(135deg, #667eea, #764ba2)',
        'linear-gradient(135deg, #FF6B6B, #FF8E53)',
        'linear-gradient(135deg, #4ECDC4, #44A08D)',
        'linear-gradient(135deg, #f093fb, #f5576c)',
        'linear-gradient(135deg, #4facfe, #00f2fe)',
        'linear-gradient(135deg, #43e97b, #38f9d7)',
        'linear-gradient(135deg, #fa709a, #fee140)',
        'linear-gradient(135deg, #a8edea, #fed6e3)',
        'linear-gradient(135deg, #ff9a9e, #fecfef)',
        'linear-gradient(135deg, #ffecd2, #fcb69f)'
    ];

    // Generate consistent index from title
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
        hash = ((hash << 5) - hash) + title.charCodeAt(i);
        hash = hash & hash;
    }

    return gradients[Math.abs(hash) % gradients.length];
}
