/**
 * radarIconData.ts — 57 official HEXOD territory categories.
 * Source: Richard's master category list.
 * Each maps to an SVG icon in iconBank.tsx.
 */

export interface IconDef { id: string; name: string; cat_color?: string }

export interface CategoryDef {
  name: string
  color: string
  icons: IconDef[]
}

export const CATEGORIES: Record<string, CategoryDef> = {
  natural_disasters: {
    name: 'Natural Disasters', color: '#f97316',
    icons: [
      { id: 'earthquake', name: 'Earthquake',  cat_color: '#FF6347' },
      { id: 'tsunami',    name: 'Tsunami',      cat_color: '#1E90FF' },
      { id: 'volcano',    name: 'Volcano',      cat_color: '#FF4500' },
      { id: 'nuclear',    name: 'Nuclear',      cat_color: '#7CFC00' },
    ],
  },
  places_structures: {
    name: 'Places & Structures', color: '#6366f1',
    icons: [
      { id: 'city',           name: 'City',         cat_color: '#6366f1' },
      { id: 'capitalCity',    name: 'Capital',      cat_color: '#e11d48' },
      { id: 'museum',         name: 'Museum',       cat_color: '#8b5cf6' },
      { id: 'monument',       name: 'Monument',     cat_color: '#d97706' },
      { id: 'wonder',         name: 'Wonder',       cat_color: '#1e1b4b' },
      { id: 'cult',           name: 'Cult Site',    cat_color: '#1c1917' },
      { id: 'port',           name: 'Port',         cat_color: '#0ea5e9' },
      { id: 'tower',          name: 'Tower',        cat_color: '#a855f7' },
      { id: 'observatory',    name: 'Observatory',  cat_color: '#1e3a8a' },
      { id: 'farm',           name: 'Farm',         cat_color: '#dc2626' },
      { id: 'mine',           name: 'Mine',         cat_color: '#7c3aed' },
    ],
  },
  nature_geography: {
    name: 'Nature & Geography', color: '#22c55e',
    icons: [
      { id: 'waterfall', name: 'Waterfall', cat_color: '#2563eb' },
      { id: 'cave',      name: 'Cave',      cat_color: '#92400e' },
      { id: 'mountain',  name: 'Mountain',  cat_color: '#7c3aed' },
      { id: 'glacier',   name: 'Glacier',   cat_color: '#06b6d4' },
      { id: 'island',    name: 'Island',    cat_color: '#0891b2' },
      { id: 'forest',    name: 'Forest',    cat_color: '#16a34a' },
      { id: 'ocean',     name: 'Ocean',     cat_color: '#1e40af' },
      { id: 'desert',    name: 'Desert',    cat_color: '#f59e0b' },
    ],
  },
  knowledge_science: {
    name: 'Knowledge & Science', color: '#2563eb',
    icons: [
      { id: 'science',      name: 'Science',      cat_color: '#2563eb' },
      { id: 'tech',         name: 'Technology',   cat_color: '#0891b2' },
      { id: 'intelligence', name: 'Intelligence', cat_color: '#4338ca' },
      { id: 'medicine',     name: 'Medicine',     cat_color: '#e11d48' },
      { id: 'space',        name: 'Space',        cat_color: '#312e81' },
    ],
  },
  industry_economy: {
    name: 'Industry & Economy', color: '#64748b',
    icons: [
      { id: 'industry',       name: 'Industry',       cat_color: '#475569' },
      { id: 'infrastructure', name: 'Infrastructure', cat_color: '#6b7280' },
      { id: 'treasure',       name: 'Treasure',       cat_color: '#f59e0b' },
    ],
  },
  culture_society: {
    name: 'Culture & Society', color: '#d946ef',
    icons: [
      { id: 'celebs',        name: 'Celebrities',   cat_color: '#ec4899' },
      { id: 'entertainment', name: 'Entertainment', cat_color: '#f43f5e' },
      { id: 'art',           name: 'Art',           cat_color: '#00F0FF' },
      { id: 'sport',         name: 'Sport',         cat_color: '#3b82f6' },
      { id: 'music',         name: 'Music',         cat_color: '#a855f7' },
      { id: 'food',          name: 'Food',          cat_color: '#f97316' },
      { id: 'history',       name: 'History',       cat_color: '#92400e' },
    ],
  },
  conflict_intrigue: {
    name: 'Conflict & Intrigue', color: '#dc2626',
    icons: [
      { id: 'chokepoint',  name: 'Chokepoint',  cat_color: '#991b1b' },
      { id: 'weapon',      name: 'Weapon',      cat_color: '#b91c1c' },
      { id: 'war',         name: 'War',         cat_color: '#dc2626' },
      { id: 'conspiracy',  name: 'Conspiracy',  cat_color: '#1e1b4b' },
      { id: 'mystery',     name: 'Mystery',     cat_color: '#6d28d9' },
      { id: 'piracy',      name: 'Piracy',      cat_color: '#0f172a' },
      { id: 'diplomacy',   name: 'Diplomacy',   cat_color: '#059669' },
    ],
  },
  life_organisms: {
    name: 'Life & Organisms', color: '#10b981',
    icons: [
      { id: 'vegetal',        name: 'Vegetal',     cat_color: '#22c55e' },
      { id: 'microOrganism',  name: 'Micro-Org',  cat_color: '#06b6d4' },
      { id: 'animal',         name: 'Animal',      cat_color: '#FF10F0' },
      { id: 'insect',         name: 'Insect',      cat_color: '#84cc16' },
      { id: 'mushroom',       name: 'Mushroom',    cat_color: '#a855f7' },
      { id: 'fossil',         name: 'Fossil',      cat_color: '#78716c' },
    ],
  },
  special_epic: {
    name: 'Special & Epic', color: '#a855f7',
    icons: [
      { id: 'mythology',  name: 'Mythology',  cat_color: '#7c3aed' },
      { id: 'country',    name: 'Country',  cat_color: '#0ea5e9' },
      { id: 'sponsored',  name: 'Sponsored',  cat_color: '#f59e0b' },
      { id: 'gift',       name: 'Gift',       cat_color: '#ec4899' },
    ],
  },
  news_events: {
    name: 'News & Events', color: '#0ea5e9',
    icons: [
      { id: 'news', name: 'Breaking News', cat_color: '#ef4444' },
    ],
  },
}

// Total: 57 categories
export const TOTAL_ICONS = Object.values(CATEGORIES).reduce((sum, c) => sum + c.icons.length, 0)

// Flat lookup: iconId → { name, cat_color, categoryKey }
export const FLAT_CATEGORIES: Record<string, { name: string; cat_color: string; categoryKey: string; categoryColor: string }> = {}
for (const [key, cat] of Object.entries(CATEGORIES)) {
  for (const icon of cat.icons) {
    FLAT_CATEGORIES[icon.id] = {
      name: icon.name,
      cat_color: icon.cat_color || cat.color,
      categoryKey: key,
      categoryColor: cat.color,
    }
  }
}
