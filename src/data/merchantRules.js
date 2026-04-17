// Pre-seeded merchant rules — common UK merchants mapped to transaction categories.
// These are included in the LLM prompt so the AI applies them exactly.
// Custom (user-defined) rules are loaded from Vercel Blob and take priority over these.

export const MERCHANT_RULES = [
  // ── Transfers ─────────────────────────────────────────────────────────────────
  // Monzo Flex repayments are a transfer between your own accounts (paying off the Flex balance).
  // Note: actual Flex *purchases* (e.g. "COSTA" bought via Flex) keep their real category.
  { pattern: 'FLEX REPAYMENT',           matchType: 'contains', category: 'Transfer' },
  { pattern: 'MONZO FLEX REPAYMENT',     matchType: 'contains', category: 'Transfer' },
  { pattern: 'MONZO FLEX',               matchType: 'startsWith', category: 'Transfer' },

  // ── Groceries ─────────────────────────────────────────────────────────────────
  { pattern: 'TESCO',                    matchType: 'contains', category: 'Groceries' },
  { pattern: 'SAINSBURY',                matchType: 'contains', category: 'Groceries' },
  { pattern: 'WAITROSE',                 matchType: 'contains', category: 'Groceries' },
  { pattern: 'ASDA',                     matchType: 'contains', category: 'Groceries' },
  { pattern: 'MORRISONS',               matchType: 'contains', category: 'Groceries' },
  { pattern: 'LIDL',                     matchType: 'contains', category: 'Groceries' },
  { pattern: 'ALDI',                     matchType: 'contains', category: 'Groceries' },
  { pattern: 'M&S FOOD',                 matchType: 'contains', category: 'Groceries' },
  { pattern: 'MARKS AND SPENCER FOOD',   matchType: 'contains', category: 'Groceries' },
  { pattern: 'MARKS & SPENCER FOOD',     matchType: 'contains', category: 'Groceries' },
  { pattern: 'CO-OP',                    matchType: 'contains', category: 'Groceries' },
  { pattern: 'COOP',                     matchType: 'contains', category: 'Groceries' },
  { pattern: 'ICELAND',                  matchType: 'contains', category: 'Groceries' },
  { pattern: 'OCADO',                    matchType: 'contains', category: 'Groceries' },
  { pattern: 'WHOLE FOODS',              matchType: 'contains', category: 'Groceries' },
  { pattern: 'FARM FOODS',               matchType: 'contains', category: 'Groceries' },

  // ── Coffee & Drinks ────────────────────────────────────────────────────────────
  { pattern: 'COSTA COFFEE',             matchType: 'contains', category: 'Coffee & Drinks' },
  { pattern: 'COSTA',                    matchType: 'contains', category: 'Coffee & Drinks' },
  { pattern: 'STARBUCKS',                matchType: 'contains', category: 'Coffee & Drinks' },
  { pattern: 'CAFFE NERO',               matchType: 'contains', category: 'Coffee & Drinks' },
  { pattern: 'CAFE NERO',                matchType: 'contains', category: 'Coffee & Drinks' },
  { pattern: 'PRET A MANGER',            matchType: 'contains', category: 'Coffee & Drinks' },
  { pattern: 'PRET',                     matchType: 'contains', category: 'Coffee & Drinks' },
  { pattern: 'PAUL BAKERY',              matchType: 'contains', category: 'Coffee & Drinks' },
  { pattern: 'ESQUIRES',                 matchType: 'contains', category: 'Coffee & Drinks' },

  // ── Eating Out & Takeaways ─────────────────────────────────────────────────────
  { pattern: 'DELIVEROO',                matchType: 'contains', category: 'Eating Out & Takeaways' },
  { pattern: 'UBER EATS',                matchType: 'contains', category: 'Eating Out & Takeaways' },
  { pattern: 'JUST EAT',                 matchType: 'contains', category: 'Eating Out & Takeaways' },
  { pattern: 'MCDONALDS',                matchType: 'contains', category: 'Eating Out & Takeaways' },
  { pattern: 'MC DONALDS',               matchType: 'contains', category: 'Eating Out & Takeaways' },
  { pattern: 'KFC',                      matchType: 'contains', category: 'Eating Out & Takeaways' },
  { pattern: 'SUBWAY',                   matchType: 'contains', category: 'Eating Out & Takeaways' },
  { pattern: 'NANDOS',                   matchType: 'contains', category: 'Eating Out & Takeaways' },
  { pattern: "NANDO'S",                  matchType: 'contains', category: 'Eating Out & Takeaways' },
  { pattern: 'PIZZA HUT',                matchType: 'contains', category: 'Eating Out & Takeaways' },
  { pattern: 'DOMINOS',                  matchType: 'contains', category: 'Eating Out & Takeaways' },
  { pattern: "DOMINO'S",                 matchType: 'contains', category: 'Eating Out & Takeaways' },
  { pattern: 'PAPA JOHNS',               matchType: 'contains', category: 'Eating Out & Takeaways' },
  { pattern: 'GREGGS',                   matchType: 'contains', category: 'Eating Out & Takeaways' },
  { pattern: 'LEON',                     matchType: 'contains', category: 'Eating Out & Takeaways' },
  { pattern: 'WAGAMAMA',                 matchType: 'contains', category: 'Eating Out & Takeaways' },
  { pattern: 'FIVE GUYS',                matchType: 'contains', category: 'Eating Out & Takeaways' },
  { pattern: 'ITSU',                     matchType: 'contains', category: 'Eating Out & Takeaways' },

  // ── Transport — Public Transport ───────────────────────────────────────────────
  { pattern: 'TFL',                      matchType: 'contains', category: 'Transport - Public Transport' },
  { pattern: 'TF TRAVEL',                matchType: 'contains', category: 'Transport - Public Transport' },
  { pattern: 'OYSTER',                   matchType: 'contains', category: 'Transport - Public Transport' },
  { pattern: 'TRAINLINE',                matchType: 'contains', category: 'Transport - Public Transport' },
  { pattern: 'NATIONAL RAIL',            matchType: 'contains', category: 'Transport - Public Transport' },
  { pattern: 'AVANTI',                   matchType: 'contains', category: 'Transport - Public Transport' },
  { pattern: 'GWR',                      matchType: 'contains', category: 'Transport - Public Transport' },
  { pattern: 'GREAT WESTERN',            matchType: 'contains', category: 'Transport - Public Transport' },
  { pattern: 'CROSSCOUNTRY',             matchType: 'contains', category: 'Transport - Public Transport' },
  { pattern: 'TRANSPENNINE',             matchType: 'contains', category: 'Transport - Public Transport' },
  { pattern: 'NORTHERN RAIL',            matchType: 'contains', category: 'Transport - Public Transport' },
  { pattern: 'SOUTHEASTERN',             matchType: 'contains', category: 'Transport - Public Transport' },
  { pattern: 'THAMESLINK',               matchType: 'contains', category: 'Transport - Public Transport' },
  { pattern: 'SOUTHERN RAIL',            matchType: 'contains', category: 'Transport - Public Transport' },
  { pattern: 'STAGECOACH',               matchType: 'contains', category: 'Transport - Public Transport' },
  { pattern: 'ARRIVA',                   matchType: 'contains', category: 'Transport - Public Transport' },
  { pattern: 'FIRST BUS',                matchType: 'contains', category: 'Transport - Public Transport' },
  { pattern: 'MEGABUS',                  matchType: 'contains', category: 'Transport - Public Transport' },
  { pattern: 'NATIONAL EXPRESS',         matchType: 'contains', category: 'Transport - Public Transport' },

  // ── Transport — EV Charging ────────────────────────────────────────────────────
  { pattern: 'POD POINT',                matchType: 'contains', category: 'Transport - EV Charging' },
  { pattern: 'BP PULSE',                 matchType: 'contains', category: 'Transport - EV Charging' },
  { pattern: 'OSPREY',                   matchType: 'contains', category: 'Transport - EV Charging' },
  { pattern: 'GRIDSERVE',                matchType: 'contains', category: 'Transport - EV Charging' },
  { pattern: 'UBITRICITY',               matchType: 'contains', category: 'Transport - EV Charging' },
  { pattern: 'ZAP MAP',                  matchType: 'contains', category: 'Transport - EV Charging' },
  { pattern: 'IONITY',                   matchType: 'contains', category: 'Transport - EV Charging' },
  { pattern: 'FASTNED',                  matchType: 'contains', category: 'Transport - EV Charging' },

  // ── Subscriptions — Streaming ──────────────────────────────────────────────────
  { pattern: 'NETFLIX',                  matchType: 'contains', category: 'Subscriptions - Streaming' },
  { pattern: 'SPOTIFY',                  matchType: 'contains', category: 'Subscriptions - Streaming' },
  { pattern: 'DISNEY PLUS',              matchType: 'contains', category: 'Subscriptions - Streaming' },
  { pattern: 'DISNEY+',                  matchType: 'contains', category: 'Subscriptions - Streaming' },
  { pattern: 'AMAZON PRIME',             matchType: 'contains', category: 'Subscriptions - Streaming' },
  { pattern: 'PRIME VIDEO',              matchType: 'contains', category: 'Subscriptions - Streaming' },
  { pattern: 'APPLE TV',                 matchType: 'contains', category: 'Subscriptions - Streaming' },
  { pattern: 'YOUTUBE PREMIUM',          matchType: 'contains', category: 'Subscriptions - Streaming' },
  { pattern: 'NOW TV',                   matchType: 'contains', category: 'Subscriptions - Streaming' },
  { pattern: 'NOWTV',                    matchType: 'contains', category: 'Subscriptions - Streaming' },
  { pattern: 'APPLE MUSIC',              matchType: 'contains', category: 'Subscriptions - Streaming' },
  { pattern: 'TIDAL',                    matchType: 'contains', category: 'Subscriptions - Streaming' },
  { pattern: 'DEEZER',                   matchType: 'contains', category: 'Subscriptions - Streaming' },
  { pattern: 'PARAMOUNT+',               matchType: 'contains', category: 'Subscriptions - Streaming' },
  { pattern: 'PARAMOUNT PLUS',           matchType: 'contains', category: 'Subscriptions - Streaming' },

  // ── Subscriptions — Software ───────────────────────────────────────────────────
  { pattern: 'ADOBE',                    matchType: 'contains', category: 'Subscriptions - Software' },
  { pattern: 'MICROSOFT 365',            matchType: 'contains', category: 'Subscriptions - Software' },
  { pattern: 'MICROSOFT OFFICE',         matchType: 'contains', category: 'Subscriptions - Software' },
  { pattern: 'GITHUB',                   matchType: 'contains', category: 'Subscriptions - Software' },
  { pattern: 'DROPBOX',                  matchType: 'contains', category: 'Subscriptions - Software' },
  { pattern: '1PASSWORD',                matchType: 'contains', category: 'Subscriptions - Software' },
  { pattern: 'ICLOUD',                   matchType: 'contains', category: 'Subscriptions - Software' },
  { pattern: 'GOOGLE ONE',               matchType: 'contains', category: 'Subscriptions - Software' },
  { pattern: 'GOOGLE STORAGE',           matchType: 'contains', category: 'Subscriptions - Software' },
  { pattern: 'NOTION',                   matchType: 'contains', category: 'Subscriptions - Software' },
  { pattern: 'FIGMA',                    matchType: 'contains', category: 'Subscriptions - Software' },
  { pattern: 'CANVA',                    matchType: 'contains', category: 'Subscriptions - Software' },
  { pattern: 'CHATGPT',                  matchType: 'contains', category: 'Subscriptions - Software' },
  { pattern: 'OPENAI',                   matchType: 'contains', category: 'Subscriptions - Software' },
  { pattern: 'ANTHROPIC',                matchType: 'contains', category: 'Subscriptions - Software' },
  { pattern: 'CURSOR',                   matchType: 'contains', category: 'Subscriptions - Software' },

  // ── Health — Gym ───────────────────────────────────────────────────────────────
  { pattern: 'PUREGYM',                  matchType: 'contains', category: 'Health - Gym' },
  { pattern: 'THE GYM GROUP',            matchType: 'contains', category: 'Health - Gym' },
  { pattern: 'JD GYM',                   matchType: 'contains', category: 'Health - Gym' },
  { pattern: 'VIRGIN ACTIVE',            matchType: 'contains', category: 'Health - Gym' },
  { pattern: 'DAVID LLOYD',              matchType: 'contains', category: 'Health - Gym' },
  { pattern: 'NUFFIELD HEALTH',          matchType: 'contains', category: 'Health - Gym' },
  { pattern: 'ANYTIME FITNESS',          matchType: 'contains', category: 'Health - Gym' },
  { pattern: 'BARRY\'S',                 matchType: 'contains', category: 'Health - Gym' },
  { pattern: 'F45',                      matchType: 'contains', category: 'Health - Gym' },

  // ── Pets ────────────────────────────────────────────────────────────────────────
  { pattern: 'PETS AT HOME',             matchType: 'contains', category: 'Pets' },
  { pattern: 'VETS4PETS',                matchType: 'contains', category: 'Pets' },
  { pattern: 'VETS NOW',                 matchType: 'contains', category: 'Pets' },
  { pattern: 'PDSA',                     matchType: 'contains', category: 'Pets' },
  { pattern: 'PETPLAN',                  matchType: 'contains', category: 'Pets' },
  { pattern: 'VET',                      matchType: 'contains', category: 'Pets' },

  // ── Housing — Energy ───────────────────────────────────────────────────────────
  { pattern: 'OCTOPUS ENERGY',           matchType: 'contains', category: 'Housing - Energy' },
  { pattern: 'E.ON',                     matchType: 'contains', category: 'Housing - Energy' },
  { pattern: 'EON NEXT',                 matchType: 'contains', category: 'Housing - Energy' },
  { pattern: 'BRITISH GAS',              matchType: 'contains', category: 'Housing - Energy' },
  { pattern: 'EDF ENERGY',               matchType: 'contains', category: 'Housing - Energy' },
  { pattern: 'EDF',                      matchType: 'contains', category: 'Housing - Energy' },
  { pattern: 'SCOTTISH POWER',           matchType: 'contains', category: 'Housing - Energy' },
  { pattern: 'OVO ENERGY',               matchType: 'contains', category: 'Housing - Energy' },
  { pattern: 'BULB',                     matchType: 'contains', category: 'Housing - Energy' },
  { pattern: 'SO ENERGY',                matchType: 'contains', category: 'Housing - Energy' },

  // ── Housing — Water ────────────────────────────────────────────────────────────
  { pattern: 'THAMES WATER',             matchType: 'contains', category: 'Housing - Water' },
  { pattern: 'SEVERN TRENT',             matchType: 'contains', category: 'Housing - Water' },
  { pattern: 'ANGLIAN WATER',            matchType: 'contains', category: 'Housing - Water' },
  { pattern: 'YORKSHIRE WATER',          matchType: 'contains', category: 'Housing - Water' },
  { pattern: 'UNITED UTILITIES',         matchType: 'contains', category: 'Housing - Water' },
  { pattern: 'SOUTHERN WATER',           matchType: 'contains', category: 'Housing - Water' },
  { pattern: 'WESSEX WATER',             matchType: 'contains', category: 'Housing - Water' },
  { pattern: 'NORTHUMBRIAN WATER',       matchType: 'contains', category: 'Housing - Water' },

  // ── Housing — Broadband ────────────────────────────────────────────────────────
  { pattern: 'BT GROUP',                 matchType: 'contains', category: 'Housing - Broadband' },
  { pattern: 'BT BROADBAND',             matchType: 'contains', category: 'Housing - Broadband' },
  { pattern: 'SKY BROADBAND',            matchType: 'contains', category: 'Housing - Broadband' },
  { pattern: 'VIRGIN MEDIA',             matchType: 'contains', category: 'Housing - Broadband' },
  { pattern: 'TALKTALK',                 matchType: 'contains', category: 'Housing - Broadband' },
  { pattern: 'PLUSNET',                  matchType: 'contains', category: 'Housing - Broadband' },
  { pattern: 'HYPEROPTIC',               matchType: 'contains', category: 'Housing - Broadband' },
  { pattern: 'VODAFONE HOME',            matchType: 'contains', category: 'Housing - Broadband' },
]

// Applies merchant rules to a description string.
// Returns the matched category, or null if no rule matches.
// customRules (user-defined) are checked first and take priority over pre-seeded rules.
export function applyMerchantRules(description, customRules = []) {
  const allRules = [...customRules, ...MERCHANT_RULES]
  const desc = (description || '').toUpperCase()
  for (const rule of allRules) {
    const pattern = rule.pattern.toUpperCase()
    if (rule.matchType === 'contains' && desc.includes(pattern)) return rule.category
    if (rule.matchType === 'startsWith' && desc.startsWith(pattern)) return rule.category
    if (rule.matchType === 'exact' && desc === pattern) return rule.category
  }
  return null
}

// Builds the "Known merchants" block for injection into the LLM prompt.
// customRules are listed first so the LLM sees them as higher priority.
export function buildMerchantRulesPromptSection(customRules = []) {
  const custom = customRules.length > 0
    ? customRules.map(r => `- "${r.pattern}" → ${r.category}  ← your custom rule`).join('\n')
    : ''
  const seeded = MERCHANT_RULES.map(r => `- "${r.pattern}" → ${r.category}`).join('\n')
  const body = [custom, seeded].filter(Boolean).join('\n')
  return `## Known merchants — apply these exact categories

When the transaction description contains any of the following patterns (case-insensitive), use the specified category regardless of context. Do not override these with your own judgement.

${body}`
}
