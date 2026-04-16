/**
 * emojiIcons.tsx
 *
 * Maps emojis → SVG icon IDs from iconBank.
 * Provides <EmojiIcon>, <EmojiOrText>, and emojiToIcon() helpers to replace
 * emoji-based UI everywhere.
 *
 * RULE 4 of the project: ZERO EMOJI. All icons must be original SVG designs.
 */
import { IconSVG } from './iconBank'

/** Map every emoji used in the app to an icon ID from iconBank. */
export const EMOJI_TO_ICON: Record<string, string> = {
  // Combat / weapons
  '⚔': 'swords', '⚔️': 'swords',
  '🛡': 'ui_shield', '🛡️': 'ui_shield',
  '🗡': 'dagger', '🗡️': 'dagger',
  '🔨': 'hammer',
  '💣': 'bomb',
  '🏹': 'bow',
  '🧱': 'bricks',

  // Currency / trading
  '💎': 'gem',
  '💰': 'money_bag',
  '🪙': 'hex_coin',
  '💸': 'cash_wings',
  '🏷': 'price_tag', '🏷️': 'price_tag',
  '🛒': 'cart',
  '🏪': 'auction_gavel',
  '💼': 'briefcase',
  '🤝': 'handshake',

  // Power / energy
  '🔥': 'flame',
  '⚡': 'lightning', '⚡️': 'lightning',
  '✨': 'sparkles',
  '💥': 'explosion',
  '🔋': 'battery',
  '🔌': 'plug',
  '💡': 'bulb',
  '☢': 'nuclear', '☢️': 'nuclear',
  '⚛': 'atom', '⚛️': 'atom',

  // Royalty / military
  '👑': 'crown',
  '🏰': 'castle',
  '🏛': 'museum', '🏛️': 'museum',
  '🏴': 'flag_black',
  '🚩': 'flag_red',
  '🎖': 'medal', '🎖️': 'medal',
  '🏆': 'trophy',
  '🥇': 'gold_medal',

  // Targets / navigation
  '🎯': 'target',
  '📍': 'pin',
  '📌': 'pushpin',
  '📡': 'safari_radar',
  '🗺': 'map_folded', '🗺️': 'map_folded',
  '🧭': 'compass',
  '🔍': 'magnifier',
  '👁': 'eye', '👁️': 'eye',

  // People / social
  '👥': 'people',
  '👤': 'person',
  '🕵': 'spy', '🕵️': 'spy',
  '👷': 'worker',
  '🤖': 'robot',
  '🦾': 'mech_arm',

  // Nature / elements
  '💧': 'water_drop',
  '🌊': 'ocean',
  '❄': 'snowflake', '❄️': 'snowflake',
  '🌲': 'forest',
  '🌱': 'sprout',
  '🌾': 'wheat',
  '🌿': 'leaf',
  '🍀': 'clover',
  '🌙': 'moon',
  '🌅': 'sunrise',
  '🌍': 'globe',
  '🌐': 'grid_globe',

  // Places / buildings
  '🏠': 'house',
  '🏙': 'city', '🏙️': 'city',
  '🏭': 'industrial',
  '🏦': 'bank',
  '🏥': 'medicine',
  '🏗': 'construction', '🏗️': 'construction',
  '⛰': 'mountain', '⛰️': 'mountain',
  '🏔': 'snow_peak', '🏔️': 'snow_peak',
  '🗼': 'tower',
  '🏜': 'desert', '🏜️': 'desert',
  '🌋': 'volcano',

  // Science / tech
  '🔬': 'microscope',
  '🔭': 'observatory',
  '🧪': 'flask',
  '⚗': 'alchemy', '⚗️': 'alchemy',
  '🧬': 'dna',
  '💻': 'computer',
  '🛸': 'ufo',
  '🚀': 'rocket',
  '🛰': 'satellite', '🛰️': 'satellite',
  '🧠': 'brain',

  // Animals (safari)
  '🐉': 'dragon',
  '🐊': 'crocodile',
  '🐋': 'whale',
  '🐍': 'snake',
  '🐎': 'horse',
  '🐘': 'elephant',
  '🐙': 'octopus',
  '🐛': 'bug',
  '🐝': 'bee',
  '🐺': 'wolf',
  '🐻': 'bear',
  '🦀': 'crab',
  '🦁': 'lion',
  '🦂': 'scorpion',
  '🦅': 'eagle',
  '🦇': 'bat',
  '🦈': 'shark',
  '🦊': 'fox',
  '🦋': 'butterfly',
  '🦌': 'deer',
  '🦏': 'rhino',
  '🦑': 'squid',
  '🦕': 'stego',
  '🦖': 'trex',
  '🦬': 'bison',
  '🍄': 'mushroom',

  // UI / misc
  '📊': 'chart_bar',
  '📈': 'chart_up',
  '📋': 'clipboard',
  '📝': 'notepad',
  '📢': 'megaphone',
  '📦': 'box',
  '🎁': 'gift',
  '🎭': 'theater',
  '🎨': 'palette',
  '🎉': 'party',
  '🎴': 'cards',
  '🔮': 'crystal_ball',
  '🖼': 'picture', '🖼️': 'picture',
  '📷': 'camera',
  '📺': 'tv',
  '⚙': 'gear', '⚙️': 'gear',
  '🔧': 'wrench',
  '🔩': 'bolt',
  '⛏': 'pickaxe', '⛏️': 'pickaxe',
  '🛢': 'oil_barrel', '🛢️': 'oil_barrel',
  '🪨': 'rock',
  '🔒': 'lock',
  '🔓': 'unlock',
  '🔐': 'lock_key',
  '🔴': 'dot_red',
  '🔵': 'dot_blue',
  '🟢': 'dot_green',
  '🟠': 'dot_orange',
  '🟡': 'dot_yellow',
  '🔷': 'diamond_blue',
  '💠': 'diamond_blossom',
  '♻': 'recycle', '♻️': 'recycle',
  '🔄': 'arrow_cycle',
  '📤': 'upload',
  '📧': 'email',
  '💬': 'chat',
  '🚨': 'alarm',
  '🕳': 'hole', '🕳️': 'hole',
  '⚖': 'scales', '⚖️': 'scales',
  '💀': 'skull',
  '😤': 'face_steam',
  '😂': 'face_laugh',
  '🙈': 'monkey_see_no',
  '👀': 'eyes',
  '💪': 'muscle',
  '🖱': 'mouse', '🖱️': 'mouse',
  '👆': 'point_up',
  '💜': 'heart_purple',
  '🕊': 'dove', '🕊️': 'dove',
  '⛔': 'no_entry',
  '✗': 'x_mark',
  '🏋': 'lift', '🏋️': 'lift',
  '⚓': 'anchor', '⚓️': 'anchor',
  '✈': 'plane', '✈️': 'plane',
  '⚽': 'ball', '⚽️': 'ball',
  '🏈': 'football',
  '🌪': 'tornado', '🌪️': 'tornado',
  '🚢': 'ship',
}

/** Look up icon ID for an emoji. Returns null if not mapped. */
export function emojiToIcon(emoji: string): string | null {
  return EMOJI_TO_ICON[emoji] ?? EMOJI_TO_ICON[emoji.replace('\uFE0F', '')] ?? null
}

/** Render an emoji as an SVG icon — drop-in replacement for bare emoji text. */
export function EmojiIcon({ emoji, size = 20, className }: { emoji: string; size?: number; className?: string }) {
  const iconId = emojiToIcon(emoji)
  if (!iconId) {
    // Fallback: render as text but stripped of variation selector
    return <span className={className} style={{ fontSize: size }}>{emoji}</span>
  }
  return <IconSVG id={iconId} size={size} className={className} />
}
