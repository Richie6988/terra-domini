/**
 * i18n Translation System
 * Mandated by: Localization Agent (Yasmine/FR, Sofia/PT-BR, Kenji/JA, Zhang Wei/ZH, Tariq/AR, Priya/HI)
 *
 * Uses react-i18next with automatic browser language detection.
 * Priority: FR → PT-BR → JA → ZH-CN → AR → HI → EN (fallback)
 */

export type SupportedLanguage = 'en' | 'fr' | 'pt-BR' | 'ja' | 'zh-CN' | 'ar' | 'hi'

export const LANGUAGES: Record<SupportedLanguage, { label: string; flag: string; rtl?: boolean }> = {
  'en':    { label: 'English',    flag: '🇬🇧' },
  'fr':    { label: 'Français',   flag: '🇫🇷' },
  'pt-BR': { label: 'Português',  flag: '🇧🇷' },
  'ja':    { label: '日本語',      flag: '🇯🇵' },
  'zh-CN': { label: '中文',        flag: '🇨🇳' },
  'ar':    { label: 'العربية',    flag: '🇦🇪', rtl: true },
  'hi':    { label: 'हिंदी',       flag: '🇮🇳' },
}

// Jargon-free mode: beginner-friendly term overrides
export const JARGON_FREE: Record<string, string> = {
  'hexagon': 'zone',
  'hex': 'zone',
  'h3_index': 'zone ID',
  'territory': 'zone',
  'fortify': 'defend',
  'fortification': 'defense wall',
  'HEX Coin': 'Coins',
  'tdc': 'coins',
  'TerraDominiCoin': 'Coins',
  'intel': 'spy info',
  'garrison': 'troops',
  'siege': 'long attack',
  'ARPU': 'earnings per player',
  'stockpile': 'storage',
  'tick': 'update cycle',
  'alliance': 'team',
  'federation': 'mega-team',
  'guild': 'large team',
  'squad': 'small team',
  'ERC-20': 'blockchain token',
  'Polygon': 'blockchain network',
  'control tower': 'key landmark',
}

// Core translations (English baseline — other languages loaded from /locales/)
export const TRANSLATIONS_EN = {
  // Navigation
  'nav.map': 'Map',
  'nav.combat': 'Combat',
  'nav.alliance': 'Alliance',
  'nav.shop': 'Shop',
  'nav.profile': 'Profile',
  'nav.events': 'Events',

  // Map
  'map.claim_zone': 'Claim Zone',
  'map.attack': 'Attack',
  'map.build': 'Build',
  'map.zones_near_you': 'Zones near you',
  'map.unclaimed': 'Unclaimed',
  'map.your_zone': 'Your Zone',
  'map.under_attack': 'Under Attack',
  'map.control_tower': 'Control Tower',
  'map.poi_event': 'Live World Event',

  // Tutorial
  'tutorial.step1.title': 'Welcome to Hexod',
  'tutorial.step1.body': 'The real world is your game board. Claim zones near you. Build an empire. Earn real Coins.',
  'tutorial.step1.action': 'Start Playing →',
  'tutorial.step2.title': 'Zones are your currency',
  'tutorial.step2.body': 'The map is divided into zones. Each zone earns Coins every 5 minutes. Tap an empty zone to claim it!',
  'tutorial.step2.action': 'Got it →',
  'tutorial.step3.title': 'Claim your first zone!',
  'tutorial.step3.body': 'Tap any grey zone, then press "Claim Zone". It\'s yours instantly!',
  'tutorial.step3.action': 'I claimed it! ✓',
  'tutorial.step4.title': 'You\'re earning!',
  'tutorial.step4.body': 'Your zone earns resources every 5 minutes — even offline. More zones = more earnings.',
  'tutorial.step4.action': 'What are Coins? →',
  'tutorial.step5.title': 'Coins = Real Crypto',
  'tutorial.step5.body': 'HEX Coins are real cryptocurrency. Earn from brand ads on your zones. Withdraw to your wallet anytime.',
  'tutorial.step5.action': '🚀 Start Exploring!',

  // Territory panel
  'territory.production': 'Earning every 5 min',
  'territory.defense': 'Defense',
  'territory.ad_revenue': 'Ad Revenue Today',
  'territory.viewers': 'viewers',
  'territory.stockpile': 'Stored resources',
  'territory.buildings': 'Buildings',
  'territory.claim': 'Claim this Zone',
  'territory.shield': 'Activate Shield',
  'territory.build_menu': 'Construct Building',

  // Combat
  'combat.attack_launch': 'Launch Attack',
  'combat.battle_timer': 'Battle ends in',
  'combat.join_battle': 'Join Battle',
  'combat.units.infantry': 'Infantry',
  'combat.units.cavalry': 'Cavalry',
  'combat.units.artillery': 'Artillery',
  'combat.units.air': 'Air Support',
  'combat.units.naval': 'Naval',
  'combat.won': 'Battle Won! 🏆',
  'combat.lost': 'Battle Lost 💀',
  'combat.type.conquest': 'Conquest',
  'combat.type.raid': 'Resource Raid',
  'combat.type.surprise': 'Surprise Attack',
  'combat.preview': 'Your estimated win chance',

  // Alliance
  'alliance.create': 'Create Team',
  'alliance.join': 'Join Team',
  'alliance.leave': 'Leave',
  'alliance.squad': 'Squad',
  'alliance.guild': 'Guild',
  'alliance.federation': 'Federation',
  'alliance.treasury': 'Team Treasury',
  'alliance.members': 'Members',
  'alliance.war_score': 'War Score',
  'alliance.diplomacy': 'Diplomacy',

  // Shop / HEX Coin
  'shop.buy_coins': 'Buy Coins',
  'shop.balance': 'Your Coins',
  'shop.withdraw': 'Withdraw to Wallet',
  'shop.history': 'Transaction History',
  'shop.ad_earnings': 'Ad Earnings',
  'shop.packages': 'Coin Packages',

  // Notifications
  'notif.attack_incoming': '⚔️ {player} is attacking your zone!',
  'notif.battle_won': '🏆 You won! {territory} is yours.',
  'notif.battle_lost': '💀 You lost {territory} to {player}.',
  'notif.streak_risk': '⚠️ Your {days}-day streak expires in {hours}h!',
  'notif.offline_harvest': '🌅 You earned {amount} Coins while sleeping.',
  'notif.ad_revenue': '🪙 +{amount} HEX Coin from ads on {territory}.',
  'notif.friend_request': '👥 {player} wants to be your ally!',

  // Errors
  'error.insufficient_tdc': 'Not enough Coins. Buy more or earn from zones.',
  'error.territory_protected': 'This player is protected for {time}.',
  'error.already_under_attack': 'This zone is already being attacked.',
  'error.rate_limit': 'Slow down! Try again in a moment.',
  'error.offline': 'You\'re offline. Changes will sync when you reconnect.',

  // Common
  'common.confirm': 'Confirm',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.loading': 'Loading…',
  'common.save': 'Save',
  'common.share': 'Share',
  'common.copy': 'Copy',
  'common.copied': 'Copied!',
}

// French translations
export const TRANSLATIONS_FR: Partial<typeof TRANSLATIONS_EN> = {
  'nav.map': 'Carte',
  'nav.combat': 'Combat',
  'nav.alliance': 'Alliance',
  'nav.shop': 'Boutique',
  'nav.profile': 'Profil',
  'nav.events': 'Événements',

  'map.claim_zone': 'Revendiquer',
  'map.attack': 'Attaquer',
  'map.build': 'Construire',
  'map.unclaimed': 'Non revendiqué',
  'map.your_zone': 'Votre zone',
  'map.under_attack': 'Sous attaque',

  'tutorial.step1.title': 'Bienvenue sur Hexod',
  'tutorial.step1.body': 'Le monde réel est votre terrain de jeu. Revendiquez des zones près de chez vous. Construisez un empire. Gagnez de vraies Pièces.',
  'tutorial.step1.action': 'Commencer →',
  'tutorial.step2.title': 'Les zones sont votre monnaie',
  'tutorial.step2.body': 'La carte est divisée en zones. Chaque zone rapporte des Pièces toutes les 5 minutes. Touchez une zone vide pour la revendiquer !',
  'tutorial.step2.action': 'Compris →',
  'tutorial.step3.title': 'Revendiquez votre première zone !',
  'tutorial.step3.body': 'Touchez une zone grise, puis appuyez sur "Revendiquer". Elle est à vous instantanément !',
  'tutorial.step3.action': 'C\'est fait ! ✓',
  'tutorial.step4.title': 'Vous gagnez déjà !',
  'tutorial.step4.body': 'Votre zone génère des ressources toutes les 5 minutes — même hors ligne. Plus de zones = plus de gains.',
  'tutorial.step4.action': 'C\'est quoi les Pièces ? →',
  'tutorial.step5.title': 'Les Pièces = Vraie Crypto',
  'tutorial.step5.body': 'Les Pièces HEX Coin sont de la vraie cryptomonnaie. Gagnez-en grâce aux publicités sur vos zones. Retirez vers votre portefeuille à tout moment.',
  'tutorial.step5.action': '🚀 Explorer la carte !',

  'territory.production': 'Gains toutes les 5 min',
  'territory.defense': 'Défense',
  'territory.ad_revenue': 'Revenus pub aujourd\'hui',
  'territory.claim': 'Revendiquer cette zone',
  'territory.shield': 'Activer le bouclier',

  'combat.attack_launch': 'Lancer l\'attaque',
  'combat.battle_timer': 'Bataille dans',
  'combat.won': 'Victoire ! 🏆',
  'combat.lost': 'Défaite 💀',
  'combat.type.conquest': 'Conquête',
  'combat.type.raid': 'Pillage',
  'combat.type.surprise': 'Attaque surprise',

  'shop.buy_coins': 'Acheter des Pièces',
  'shop.balance': 'Vos Pièces',
  'shop.withdraw': 'Retirer vers le portefeuille',

  'notif.attack_incoming': '⚔️ {player} attaque votre zone !',
  'notif.battle_won': '🏆 Victoire ! {territory} est à vous.',
  'notif.battle_lost': '💀 Vous avez perdu {territory} contre {player}.',
  'notif.offline_harvest': '🌅 Vous avez gagné {amount} Pièces pendant votre absence.',

  'error.insufficient_tdc': 'Pièces insuffisantes. Achetez-en ou gagnez-en via vos zones.',
  'error.territory_protected': 'Ce joueur est protégé pendant encore {time}.',

  'common.confirm': 'Confirmer',
  'common.cancel': 'Annuler',
  'common.close': 'Fermer',
  'common.loading': 'Chargement…',
  'common.share': 'Partager',
}

// Portuguese (Brazil) translations
export const TRANSLATIONS_PT_BR: Partial<typeof TRANSLATIONS_EN> = {
  'nav.map': 'Mapa',
  'nav.combat': 'Combate',
  'nav.alliance': 'Aliança',
  'nav.shop': 'Loja',
  'nav.profile': 'Perfil',

  'map.claim_zone': 'Reivindicar',
  'map.attack': 'Atacar',
  'map.your_zone': 'Sua zona',
  'map.under_attack': 'Sob ataque',

  'tutorial.step1.title': 'Bem-vindo ao Hexod',
  'tutorial.step1.body': 'O mundo real é seu tabuleiro. Reivindique zonas perto de você. Construa um império. Ganhe Moedas reais.',
  'tutorial.step1.action': 'Começar →',

  'territory.production': 'Ganhos a cada 5 min',
  'territory.claim': 'Reivindicar esta zona',
  'combat.won': 'Vitória! 🏆',
  'combat.lost': 'Derrota 💀',
  'shop.buy_coins': 'Comprar Moedas',

  'common.confirm': 'Confirmar',
  'common.cancel': 'Cancelar',
  'common.loading': 'Carregando…',
}

// Japanese translations
export const TRANSLATIONS_JA: Partial<typeof TRANSLATIONS_EN> = {
  'nav.map': 'マップ',
  'nav.combat': '戦闘',
  'nav.alliance': '同盟',
  'nav.shop': 'ショップ',
  'nav.profile': 'プロフィール',

  'map.claim_zone': '領土を獲得',
  'map.attack': '攻撃',
  'map.your_zone': 'あなたの領土',
  'map.under_attack': '攻撃中',

  'tutorial.step1.title': 'テラドミニへようこそ',
  'tutorial.step1.body': 'リアルな地球があなたのゲームボードです。近くのゾーンを獲得して、帝国を築き、本物のコインを稼ぎましょう。',
  'tutorial.step1.action': 'プレイ開始 →',

  'territory.claim': 'このゾーンを獲得',
  'combat.won': '勝利！🏆',
  'combat.lost': '敗北 💀',
  'shop.buy_coins': 'コインを購入',

  'common.confirm': '確認',
  'common.cancel': 'キャンセル',
  'common.loading': '読み込み中…',
}

// Simplified Chinese translations
export const TRANSLATIONS_ZH_CN: Partial<typeof TRANSLATIONS_EN> = {
  'nav.map': '地图',
  'nav.combat': '战斗',
  'nav.alliance': '联盟',
  'nav.shop': '商店',
  'nav.profile': '档案',

  'map.claim_zone': '占领区域',
  'map.attack': '攻击',
  'map.your_zone': '您的区域',
  'map.under_attack': '受到攻击',

  'tutorial.step1.title': '欢迎来到 Hexod',
  'tutorial.step1.body': '真实的地球是您的游戏棋盘。占领您附近的区域，建立帝国，赚取真实货币。',
  'tutorial.step1.action': '开始游戏 →',

  'territory.claim': '占领此区域',
  'combat.won': '胜利！🏆',
  'combat.lost': '失败 💀',
  'shop.buy_coins': '购买金币',

  'common.confirm': '确认',
  'common.cancel': '取消',
  'common.loading': '加载中…',
}

// Translation registry
export const ALL_TRANSLATIONS: Record<string, Partial<typeof TRANSLATIONS_EN>> = {
  'en': TRANSLATIONS_EN,
  'fr': TRANSLATIONS_FR,
  'pt-BR': TRANSLATIONS_PT_BR,
  'ja': TRANSLATIONS_JA,
  'zh-CN': TRANSLATIONS_ZH_CN,
}

// Simple translation hook (production would use react-i18next)
export function useTranslation() {
  const lang = detectLanguage()
  const translations = ALL_TRANSLATIONS[lang] ?? TRANSLATIONS_EN

  function t(key: keyof typeof TRANSLATIONS_EN, vars?: Record<string, string | number>): string {
    let text = (translations[key] ?? TRANSLATIONS_EN[key]) as string
    if (!text) return key
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v))
      })
    }
    return text
  }

  return { t, lang, rtl: LANGUAGES[lang as SupportedLanguage]?.rtl ?? false }
}

function detectLanguage(): SupportedLanguage {
  // 1. User preference stored
  const stored = localStorage.getItem('td_language') as SupportedLanguage
  if (stored && ALL_TRANSLATIONS[stored]) return stored

  // 2. Browser language
  const browserLang = navigator.language || navigator.languages?.[0] || 'en'
  const langMap: Record<string, SupportedLanguage> = {
    'fr': 'fr', 'fr-FR': 'fr', 'fr-BE': 'fr', 'fr-CH': 'fr',
    'pt-BR': 'pt-BR', 'pt': 'pt-BR',
    'ja': 'ja', 'ja-JP': 'ja',
    'zh': 'zh-CN', 'zh-CN': 'zh-CN', 'zh-Hans': 'zh-CN',
    'ar': 'ar', 'ar-AE': 'ar', 'ar-SA': 'ar',
    'hi': 'hi', 'hi-IN': 'hi',
  }
  return langMap[browserLang] ?? langMap[browserLang.split('-')[0]] ?? 'en'
}

export function setLanguage(lang: SupportedLanguage) {
  localStorage.setItem('td_language', lang)
  window.location.reload()
}
