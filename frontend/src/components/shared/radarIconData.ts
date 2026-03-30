/**
 * radarIconData.ts — Complete SVG icon library for HEXOD Radar Filter Panel.
 * Source: read_only_templates/rare_territory_display_filter_panel
 * 10 categories × 48 icons
 */

export interface IconDef { id: string; name: string }

export interface CategoryDef {
  name: string
  color: string
  icons: IconDef[]
}

export const CATEGORIES: Record<string, CategoryDef> = {
  natural_disasters: {
    name: 'Natural Disasters', color: '#f97316',
    icons: [
      { id: 'earthquake', name: 'Earthquake' },
      { id: 'tsunami',    name: 'Tsunami' },
      { id: 'volcano',    name: 'Volcano' },
      { id: 'nuclear',    name: 'Nuclear' },
    ],
  },
  places_structures: {
    name: 'Places & Structures', color: '#6366f1',
    icons: [
      { id: 'city',         name: 'City' },
      { id: 'capitalCity',  name: 'Capital' },
      { id: 'museum',       name: 'Museum' },
      { id: 'monument',     name: 'Monument' },
      { id: 'wonder',       name: 'Wonder' },
      { id: 'cult',         name: 'Cult Site' },
      { id: 'port',         name: 'Port' },
      { id: 'tower',        name: 'Tower' },
      { id: 'observatory',  name: 'Observatory' },
      { id: 'farm',         name: 'Farm' },
      { id: 'mine',         name: 'Mine' },
    ],
  },
  nature_geography: {
    name: 'Nature & Geography', color: '#7c3aed',
    icons: [
      { id: 'waterfall', name: 'Waterfall' },
      { id: 'cave',      name: 'Cave' },
      { id: 'mountain',  name: 'Mountain' },
      { id: 'glacier',   name: 'Glacier' },
      { id: 'island',    name: 'Island' },
      { id: 'forest',    name: 'Forest' },
      { id: 'ocean',     name: 'Ocean' },
      { id: 'desert',    name: 'Desert' },
    ],
  },
  knowledge_science: {
    name: 'Knowledge & Science', color: '#2563eb',
    icons: [
      { id: 'science',      name: 'Science' },
      { id: 'tech',         name: 'Technology' },
      { id: 'intelligence', name: 'Intelligence' },
      { id: 'medicine',     name: 'Medicine' },
    ],
  },
  industry_economy: {
    name: 'Industry & Economy', color: '#64748b',
    icons: [
      { id: 'industry',       name: 'Industry' },
      { id: 'infrastructure', name: 'Infrastructure' },
      { id: 'treasure',       name: 'Treasure' },
    ],
  },
  culture_society: {
    name: 'Culture & Society', color: '#d946ef',
    icons: [
      { id: 'celebs',        name: 'Celebrities' },
      { id: 'entertainment', name: 'Entertainment' },
      { id: 'art',           name: 'Art' },
      { id: 'sport',         name: 'Sport' },
      { id: 'music',         name: 'Music' },
      { id: 'food',          name: 'Food' },
      { id: 'history',       name: 'History' },
    ],
  },
  conflict_intrigue: {
    name: 'Conflict & Intrigue', color: '#dc2626',
    icons: [
      { id: 'chokepoint',  name: 'Chokepoint' },
      { id: 'weapon',      name: 'Weapon' },
      { id: 'war',         name: 'War' },
      { id: 'conspiracy',  name: 'Conspiracy' },
      { id: 'mystery',     name: 'Mystery' },
      { id: 'piracy',      name: 'Piracy' },
      { id: 'diplomacy',   name: 'Diplomacy' },
    ],
  },
  life_organisms: {
    name: 'Life & Organisms', color: '#22c55e',
    icons: [
      { id: 'vegetal',        name: 'Vegetal' },
      { id: 'microOrganism',  name: 'Micro-Org' },
      { id: 'animal',         name: 'Animal' },
      { id: 'insect',         name: 'Insect' },
      { id: 'mushroom',       name: 'Mushroom' },
      { id: 'fossil',         name: 'Fossil' },
      { id: 'trex',           name: 'T-Rex' },
      { id: 'raptor',         name: 'Raptor' },
      { id: 'stego',          name: 'Stegosaurus' },
      { id: 'dinosaur',       name: 'Dinosaur' },
      { id: 'eagle',          name: 'Eagle' },
      { id: 'whale',          name: 'Whale' },
      { id: 'orchid',         name: 'Orchid' },
      { id: 'fungus',         name: 'Fungus' },
    ],
  },
  special_epic: {
    name: 'Special & Epic', color: '#a855f7',
    icons: [
      { id: 'space',      name: 'Space' },
      { id: 'mythology',  name: 'Mythology' },
      { id: 'countries',  name: 'Countries' },
      { id: 'sponsored',  name: 'Sponsored' },
      { id: 'gift',       name: 'Gift' },
      { id: 'dragon',     name: 'Dragon' },
      { id: 'phoenix',    name: 'Phoenix' },
      { id: 'alien',      name: 'Alien' },
    ],
  },
  news: {
    name: 'News & Events', color: '#0ea5e9',
    icons: [
      { id: 'news', name: 'Breaking News' },
    ],
  },
}

// Total icon count
export const TOTAL_ICONS = Object.values(CATEGORIES).reduce((sum, c) => sum + c.icons.length, 0)
