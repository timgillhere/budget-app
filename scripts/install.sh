#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# NeuroBank — Local Transaction Processor
# One-time setup: installs Ollama, downloads the AI model, and creates the
# `nb-transactions` command you can run from any folder each month.
#
# Usage (paste this into your terminal):
#   curl -fsSL https://raw.githubusercontent.com/timgillhere/budget-app/main/scripts/install.sh | bash
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
NB="[nb-transactions]"
log()  { echo -e "${CYAN}${NB}${NC} $1"; }
ok()   { echo -e "${GREEN}${NB}${NC} $1"; }
warn() { echo -e "${YELLOW}${NB}${NC} $1"; }
die()  { echo -e "${RED}${NB} Error:${NC} $1"; exit 1; }

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  NeuroBank · Local Transaction Processor · Installer${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── 1. Homebrew ───────────────────────────────────────────────────────────────
if ! command -v brew &>/dev/null; then
  die "Homebrew is not installed. Install it first, then re-run:\n\n  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"\n"
fi
log "Homebrew found"

# ── 2. Node.js ────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  log "Installing Node.js..."
  brew install node
else
  log "Node.js $(node --version) found"
fi

# ── 3. Ollama ─────────────────────────────────────────────────────────────────
if ! command -v ollama &>/dev/null; then
  log "Installing Ollama..."
  brew install ollama
else
  log "Ollama found"
fi

# ── 4. Start Ollama and wait until it is ready ───────────────────────────────
OLLAMA_STARTED_BY_INSTALLER=false
if ! curl -sf http://localhost:11434/api/tags &>/dev/null; then
  log "Starting Ollama service..."
  ollama serve &>/dev/null &
  OLLAMA_STARTED_BY_INSTALLER=true
  log "Waiting for Ollama to be ready..."
  for i in $(seq 1 30); do
    if curl -sf http://localhost:11434/api/tags &>/dev/null; then
      break
    fi
    if [ "$i" -eq 30 ]; then
      die "Ollama did not start after 30 seconds. Try running 'ollama serve' in a separate terminal and re-run this script."
    fi
    sleep 1
  done
fi
ok "Ollama is running"

# ── 5. Pull the AI model (qwen2.5:3b, ~2 GB — first time only) ──────────────
# qwen2.5:3b follows instructions and strict-JSON output better than llama3.2:3b
# at the same size/speed, which means fewer parse-failure retries.
MODEL="qwen2.5:3b"
if ollama list 2>/dev/null | grep -q "$MODEL"; then
  ok "Model $MODEL already installed — skipping download"
else
  log "Pulling $MODEL model (~2 GB, first time only)..."
  PULL_OK=0
  for attempt in 1 2 3; do
    if ollama pull "$MODEL"; then
      PULL_OK=1
      break
    fi
    if [ "$attempt" -lt 3 ]; then
      warn "Model download attempt $attempt failed — retrying in $((attempt * 5))s..."
      sleep $((attempt * 5))
    fi
  done
  if [ "$PULL_OK" -ne 1 ]; then
    warn "Could not download $MODEL after 3 attempts."
    warn "This is almost always a network/DNS issue reaching registry.ollama.ai"
    warn "(the exact error was a lookup/timeout). Check Wi-Fi, VPN, and any firewall/DNS."
    warn "Setup will continue — everything else is configured. When you're back online, finish with:"
    warn "    ollama pull $MODEL"
  fi
fi

# ── 6. Config file ────────────────────────────────────────────────────────────
CONFIG_DIR="$HOME/.config/nb-transactions"
CONFIG_FILE="$CONFIG_DIR/config.json"
mkdir -p "$CONFIG_DIR"
if [ ! -f "$CONFIG_FILE" ]; then
  cat > "$CONFIG_FILE" << 'CONFIGEOF'
{
  "model": "qwen2.5:3b",
  "accounts": ["Starling", "Monzo"],
  "ollamaUrl": "http://localhost:11434"
}
CONFIGEOF
  log "Config created at $CONFIG_FILE"
elif grep -q '"llama3.2:3b"' "$CONFIG_FILE"; then
  # Migrate configs still on the old default so they don't reference an unpulled model.
  sed -i.bak 's/"llama3.2:3b"/"qwen2.5:3b"/' "$CONFIG_FILE" && rm -f "$CONFIG_FILE.bak"
  log "Updated model in $CONFIG_FILE: llama3.2:3b → qwen2.5:3b"
else
  log "Config already exists — keeping your settings"
fi

# ── 7. Install the nb-transactions command ────────────────────────────────────
BIN_DIR="$HOME/.local/bin"
mkdir -p "$BIN_DIR"
PROCESSOR="$BIN_DIR/nb-transactions"
log "Installing nb-transactions to $PROCESSOR..."

# The Node.js processor script is embedded below.
# Quoted heredoc (PROCESSOREOF) means nothing inside is shell-expanded.
cat > "$PROCESSOR" << 'PROCESSOREOF'
#!/usr/bin/env node
'use strict'
// nb-transactions — NeuroBank local LLM transaction processor
// To update: re-run the install.sh script from NeuroBank.

const fs = require('fs')
const path = require('path')
const os = require('os')
const https = require('https')
const http = require('http')
const readline = require('readline')

// ── Categories (must match app exactly) ──────────────────────────────────────
const CATEGORIES = [
  'Income - Salary', 'Income - Freelance', 'Income - Other', 'Transfer',
  'Housing - Mortgage / Rent', 'Housing - Council Tax', 'Housing - Water',
  'Housing - Energy', 'Housing - Broadband', 'Housing - Service Charge',
  'Housing - Building Insurance', 'Housing - Contents Insurance', 'Housing - Property Costs',
  'Transport - Public Transport', 'Transport - EV Charging', 'Transport - Vehicle Insurance',
  'Transport - Vehicle Tax & MOT', 'Transport - Vehicle Service',
  'Groceries', 'Eating Out & Takeaways', 'Coffee & Drinks', 'Socialising', 'Personal Spend',
  'Health - Gym', 'Health - Therapy & Counselling', 'Health - Medical',
  'Subscriptions - Streaming', 'Subscriptions - Software', 'Subscriptions - Other',
  'Pets', 'Gifts', 'Clothing', 'Holidays & Travel',
  'Savings - Sinking Fund', 'Savings - Investment', 'Savings - Pension',
  'Savings - ISA', 'Savings - Emergency Fund', 'Other',
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function die(msg) { process.stderr.write('\nError: ' + msg + '\n\n'); process.exit(1) }
function log(msg) { process.stderr.write('  ' + msg + '\n') }
function askUser(rl, question) {
  return new Promise(function(resolve) { rl.question(question, resolve) })
}

function expandPath(p) {
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2))
  if (p === '~') return os.homedir()
  return p
}

// ── CLI ───────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = argv.slice(2)
  if (!args.length || args[0] === '--help' || args[0] === '-h') {
    process.stdout.write([
      '',
      'Usage: nb-transactions <csv-file> <bank-name> [--month YYYY-MM] [--dry-run]',
      '',
      'Banks:   starling  monzo  hsbc  nationwide  halifax  barclays  revolut  generic',
      '',
      'Options:',
      '  --month YYYY-MM   Override the month (default: inferred from CSV dates)',
      '  --dry-run         Print the prompt sent to the AI and exit without processing',
      '  --append          Merge into existing ~/Downloads/transactions-YYYY-MM.json files',
      '                    instead of overwriting them. Use when adding a second bank after',
      '                    a previous session already saved some months.',
      '',
      'Examples:',
      '  nb-transactions ~/Downloads/starling-april.csv Starling',
      '  nb-transactions ~/Downloads/monzo.csv Monzo --month 2026-03',
      '  nb-transactions statement.csv HSBC --dry-run',
      '',
    ].join('\n'))
    process.exit(0)
  }
  if (args.length < 2) die('Usage: nb-transactions <csv-file> <bank-name>')
  const csvPath = args[0]
  const bankLabel = args[1]
  let month = null, dryRun = false, appendMode = false
  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--month' && args[i + 1]) {
      month = args[++i]
      if (!/^\d{4}-\d{2}$/.test(month)) die('Invalid month "' + month + '". Use YYYY-MM, e.g. 2026-04')
    } else if (args[i] === '--dry-run') {
      dryRun = true
    } else if (args[i] === '--append') {
      appendMode = true
    } else {
      die('Unknown argument "' + args[i] + '". Run nb-transactions --help for usage.')
    }
  }
  return { csvPath, bankLabel, bankKey: bankLabel.toLowerCase(), month, dryRun, appendMode }
}

// ── Config ────────────────────────────────────────────────────────────────────
function loadConfig() {
  const configPath = path.join(os.homedir(), '.config', 'nb-transactions', 'config.json')
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') die('Config not found. Re-run the installer script from NeuroBank.')
    die('Could not read config at ' + configPath + ': ' + e.message)
  }
}

function loadCorrections() {
  const p = path.join(os.homedir(), '.config', 'nb-transactions', 'corrections.json')
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return [] }
}

// ── Merchant rules (pre-seeded + user custom) ─────────────────────────────────
const PRE_SEEDED_MERCHANT_RULES = [
  // Transfers
  { pattern: 'FLEX REPAYMENT',           category: 'Transfer' },
  { pattern: 'MONZO FLEX REPAYMENT',     category: 'Transfer' },
  // Groceries
  { pattern: 'TESCO',                    category: 'Groceries' },
  { pattern: 'SAINSBURY',                category: 'Groceries' },
  { pattern: 'WAITROSE',                 category: 'Groceries' },
  { pattern: 'ASDA',                     category: 'Groceries' },
  { pattern: 'MORRISONS',                category: 'Groceries' },
  { pattern: 'LIDL',                     category: 'Groceries' },
  { pattern: 'ALDI',                     category: 'Groceries' },
  { pattern: 'M&S FOOD',                 category: 'Groceries' },
  { pattern: 'CO-OP',                    category: 'Groceries' },
  { pattern: 'ICELAND',                  category: 'Groceries' },
  { pattern: 'OCADO',                    category: 'Groceries' },
  // Coffee & Drinks
  { pattern: 'COSTA',                    category: 'Coffee & Drinks' },
  { pattern: 'STARBUCKS',                category: 'Coffee & Drinks' },
  { pattern: 'CAFFE NERO',               category: 'Coffee & Drinks' },
  { pattern: 'PRET',                     category: 'Coffee & Drinks' },
  // Eating Out
  { pattern: 'DELIVEROO',                category: 'Eating Out & Takeaways' },
  { pattern: 'UBER EATS',                category: 'Eating Out & Takeaways' },
  { pattern: 'JUST EAT',                 category: 'Eating Out & Takeaways' },
  { pattern: 'MCDONALDS',                category: 'Eating Out & Takeaways' },
  { pattern: 'KFC',                      category: 'Eating Out & Takeaways' },
  { pattern: 'NANDOS',                   category: 'Eating Out & Takeaways' },
  { pattern: 'GREGGS',                   category: 'Eating Out & Takeaways' },
  { pattern: 'DOMINOS',                  category: 'Eating Out & Takeaways' },
  // Transport
  { pattern: 'TFL',                      category: 'Transport - Public Transport' },
  { pattern: 'TRAINLINE',                category: 'Transport - Public Transport' },
  { pattern: 'NATIONAL RAIL',            category: 'Transport - Public Transport' },
  { pattern: 'AVANTI',                   category: 'Transport - Public Transport' },
  { pattern: 'GWR',                      category: 'Transport - Public Transport' },
  { pattern: 'POD POINT',                category: 'Transport - EV Charging' },
  { pattern: 'BP PULSE',                 category: 'Transport - EV Charging' },
  { pattern: 'OSPREY',                   category: 'Transport - EV Charging' },
  { pattern: 'GRIDSERVE',                category: 'Transport - EV Charging' },
  // Streaming
  { pattern: 'NETFLIX',                  category: 'Subscriptions - Streaming' },
  { pattern: 'SPOTIFY',                  category: 'Subscriptions - Streaming' },
  { pattern: 'DISNEY',                   category: 'Subscriptions - Streaming' },
  { pattern: 'AMAZON PRIME',             category: 'Subscriptions - Streaming' },
  { pattern: 'APPLE TV',                 category: 'Subscriptions - Streaming' },
  // Software
  { pattern: 'ADOBE',                    category: 'Subscriptions - Software' },
  { pattern: 'MICROSOFT 365',            category: 'Subscriptions - Software' },
  { pattern: 'GITHUB',                   category: 'Subscriptions - Software' },
  { pattern: 'ICLOUD',                   category: 'Subscriptions - Software' },
  { pattern: 'CHATGPT',                  category: 'Subscriptions - Software' },
  { pattern: 'OPENAI',                   category: 'Subscriptions - Software' },
  { pattern: 'ANTHROPIC',                category: 'Subscriptions - Software' },
  // Gym
  { pattern: 'PUREGYM',                  category: 'Health - Gym' },
  { pattern: 'THE GYM GROUP',            category: 'Health - Gym' },
  { pattern: 'DAVID LLOYD',              category: 'Health - Gym' },
  { pattern: 'VIRGIN ACTIVE',            category: 'Health - Gym' },
  // Pets
  { pattern: 'PETS AT HOME',             category: 'Pets' },
  { pattern: 'VETS4PETS',                category: 'Pets' },
  // Energy
  { pattern: 'OCTOPUS ENERGY',           category: 'Housing - Energy' },
  { pattern: 'BRITISH GAS',              category: 'Housing - Energy' },
  { pattern: 'EDF',                      category: 'Housing - Energy' },
  // Water
  { pattern: 'THAMES WATER',             category: 'Housing - Water' },
  { pattern: 'SEVERN TRENT',             category: 'Housing - Water' },
  // Broadband
  { pattern: 'VIRGIN MEDIA',             category: 'Housing - Broadband' },
  { pattern: 'BT BROADBAND',             category: 'Housing - Broadband' },
  { pattern: 'SKY BROADBAND',            category: 'Housing - Broadband' },
]

function loadMerchantRules() {
  const rulesPath = path.join(os.homedir(), '.config', 'nb-transactions', 'merchant-rules.json')
  try {
    const data = JSON.parse(fs.readFileSync(rulesPath, 'utf8'))
    return Array.isArray(data) ? data : []
  } catch (e) {
    if (e.code !== 'ENOENT') log('Warning: could not read merchant-rules.json: ' + e.message)
    return []
  }
}

function buildMerchantSection(customRules) {
  const custom = customRules.length > 0
    ? customRules.map(function(r) { return '- "' + r.pattern + '" \u2192 ' + r.category + '  \u2190 your custom rule' }).join('\n')
    : ''
  const seeded = PRE_SEEDED_MERCHANT_RULES.map(function(r) { return '- "' + r.pattern + '" \u2192 ' + r.category }).join('\n')
  const body = [custom, seeded].filter(Boolean).join('\n')
  return '## Known merchants \u2014 apply these exact categories\n\nWhen the transaction description contains any of the following patterns (case-insensitive), use the specified category. Do not override these with your own judgement.\n\n' + body
}

// ── CSV parser (no deps, handles quoted fields + CRLF) ────────────────────────
function parseCSV(text) {
  const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalised.split('\n')
  const rows = []
  for (const line of lines) {
    if (!line.trim()) continue
    rows.push(parseLine(line))
  }
  if (rows.length < 2) return []
  const headers = rows[0]
  return rows.slice(1).map(function(cells) {
    const obj = {}
    headers.forEach(function(h, i) { obj[h.trim()] = (cells[i] || '').trim() })
    return obj
  })
}

function parseLine(line) {
  const fields = []
  let cur = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      fields.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields
}

// ── Date / amount parsing ─────────────────────────────────────────────────────
const MONTH_MAP = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 }

function parseDate(raw) {
  if (!raw) return null
  raw = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)          // YYYY-MM-DD
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)              // DD/MM/YYYY
  if (dmy) return dmy[3] + '-' + dmy[2].padStart(2,'0') + '-' + dmy[1].padStart(2,'0')
  const dmy2 = raw.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/)      // 01 Apr 2026
  if (dmy2) {
    const m = MONTH_MAP[dmy2[2].toLowerCase()]
    if (m) return dmy2[3] + '-' + String(m).padStart(2,'0') + '-' + dmy2[1].padStart(2,'0')
  }
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})[T ]/)                    // ISO timestamp
  if (iso) return iso[1]
  return null
}

function parseAmount(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  const n = parseFloat(String(raw).replace(/[£,\s]/g, ''))
  return isNaN(n) ? null : n
}

// ── Bank normalisers ──────────────────────────────────────────────────────────
function normaliseRows(rows, bankKey) {
  const normalisers = {
    starling:   normaliseStarling,
    monzo:      normaliseMonzo,
    hsbc:       normaliseHsbc,
    nationwide: normaliseNationwide,
    halifax:    normaliseHalifax,
    barclays:   normaliseBarclays,
    revolut:    normaliseRevolut,
    generic:    normaliseGeneric,
  }
  if (!normalisers[bankKey]) {
    die('Unknown bank "' + bankKey + '".\nSupported: starling  monzo  hsbc  nationwide  halifax  barclays  revolut  generic')
  }
  return normalisers[bankKey](rows).filter(function(r) {
    return r.date && r.amount !== null && isFinite(r.amount)
  })
}

function normaliseStarling(rows) {
  return rows.map(function(r) {
    const desc = [r['Counter Party'], r['Reference']].filter(Boolean).join(' — ')
    return { date: parseDate(r['Date']), description: desc, amount: parseAmount(r['Amount (GBP)']) }
  })
}

function normaliseMonzo(rows) {
  return rows.map(function(r) {
    return { date: parseDate(r['Date']), description: r['Name'] || r['Description'] || '', amount: parseAmount(r['Amount']) }
  })
}

function normaliseHsbc(rows) {
  return rows.map(function(r) {
    return { date: parseDate(r['Date']), description: r['Description'] || '', amount: parseAmount(r['Amount']) }
  })
}

function normaliseNationwide(rows) {
  // Nationwide prepends metadata rows — skip until we hit rows that have a parseable date
  return rows.filter(function(r) { return r['Date'] && r['Date'] !== 'Date' && parseDate(r['Date']) })
    .map(function(r) {
      const debit  = parseAmount(r['Debit Amount'])
      const credit = parseAmount(r['Credit Amount'])
      const amount = (debit  !== null && debit  !== 0) ? -Math.abs(debit)
                   : (credit !== null && credit !== 0) ?  Math.abs(credit) : null
      return { date: parseDate(r['Date']), description: r['Transactions'] || '', amount }
    })
}

function normaliseHalifax(rows) {
  return rows.map(function(r) {
    const debit  = parseAmount(r['Debit Amount'])
    const credit = parseAmount(r['Credit Amount'])
    const amount = (debit  !== null && debit  !== 0) ? -Math.abs(debit)
                 : (credit !== null && credit !== 0) ?  Math.abs(credit) : null
    return { date: parseDate(r['Transaction Date']), description: r['Transaction Description'] || '', amount }
  })
}

function normaliseBarclays(rows) {
  return rows.map(function(r) {
    return { date: parseDate(r['Date']), description: r['Memo'] || r['Subcategory'] || '', amount: parseAmount(r['Amount']) }
  })
}

function normaliseRevolut(rows) {
  return rows.map(function(r) {
    return { date: parseDate(r['Started Date'] || r['Completed Date']), description: r['Description'] || '', amount: parseAmount(r['Amount']) }
  })
}

function normaliseGeneric(rows) {
  if (!rows.length) return []
  const keys = Object.keys(rows[0])
  const dateKey = keys.find(function(k) { return /date/i.test(k) }) || keys[0]
  const amtKey  = keys.find(function(k) { return /amount|debit|credit/i.test(k) })
  const descKey = keys.find(function(k) { return /desc|name|memo|narrative|detail/i.test(k) }) || keys[1] || keys[0]
  return rows.map(function(r) {
    return { date: parseDate(r[dateKey]), description: r[descKey] || '', amount: amtKey ? parseAmount(r[amtKey]) : null }
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function inferMonth(rows) {
  for (const r of rows) {
    if (r.date) {
      const m = r.date.match(/^(\d{4}-\d{2})/)
      if (m) return m[1]
    }
  }
  die('Could not infer month from CSV. Use --month YYYY-MM to specify it manually.')
}

function buildChunks(rows, size) {
  size = size || 40
  const chunks = []
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size))
  return chunks
}

// ── Group normalised rows by YYYY-MM ─────────────────────────────────────────
function groupByMonth(rows) {
  const months = {}
  for (const r of rows) {
    const m = r.date ? r.date.slice(0, 7) : null
    if (!m) continue
    if (!months[m]) months[m] = []
    months[m].push(r)
  }
  return months
}

// ── Prompt ────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = 'You are a UK personal finance assistant. Your only job is to categorise bank transactions and output structured JSON.\n\n## Output format\n\nOutput ONLY a single fenced code block tagged ```transactions-json (exactly that tag, no space). No explanation, no preamble, no text after the closing fence.\n\nThe JSON shape must be exactly:\n\n```transactions-json\n{\n  "month": "YYYY-MM",\n  "importedAt": "ISO8601",\n  "transactions": [\n    {\n      "id": "txn-TIMESTAMP-INDEX",\n      "date": "YYYY-MM-DD",\n      "description": "MERCHANT NAME",\n      "amount": -12.34,\n      "category": "Exact Category Name",\n      "account": "ACCOUNT_NAME",\n      "notes": ""\n    }\n  ]\n}\n```\n\n## Rules — follow every one exactly\n\n1. amount: always a number. Money leaving the account is NEGATIVE. Income, refunds, and transfers in are POSITIVE.\n2. date: always YYYY-MM-DD.\n3. category: must be EXACTLY one of the 39 strings in the list below. No variations.\n4. id: "txn-" + Unix timestamp in ms + "-" + row index from 0. E.g. txn-1744704600000-0\n5. account: use the account name given in the user message.\n6. Include EVERY row — do not skip any.\n7. Output the COMPLETE JSON — never truncate or add "..." placeholders.\n8. Transfers between the user\'s own accounts listed below → "Transfer".\n9. Regular salary / BACS payroll → "Income - Salary".\n10. Pension deductions → "Savings - Pension".\n11. Investment platforms (Vanguard, Hargreaves Lansdown, etc.) → "Savings - Investment".\n12. ISA contributions → "Savings - ISA".\n13. "Flex" transactions (Monzo Flex credit card — descriptions often contain "flex" or "FLEX") — categorise by the actual purchase, not as a card payment. E.g. a Flex transaction at a restaurant → "Eating Out & Takeaways".\n14. When unsure, prefer a specific category over "Other".\n\n## Canonical categories — use ONLY these exact 39 strings\n\nIncome - Salary\nIncome - Freelance\nIncome - Other\nTransfer\nHousing - Mortgage / Rent\nHousing - Council Tax\nHousing - Water\nHousing - Energy\nHousing - Broadband\nHousing - Service Charge\nHousing - Building Insurance\nHousing - Contents Insurance\nHousing - Property Costs\nTransport - Public Transport\nTransport - EV Charging\nTransport - Vehicle Insurance\nTransport - Vehicle Tax & MOT\nTransport - Vehicle Service\nGroceries\nEating Out & Takeaways\nCoffee & Drinks\nSocialising\nPersonal Spend\nHealth - Gym\nHealth - Therapy & Counselling\nHealth - Medical\nSubscriptions - Streaming\nSubscriptions - Software\nSubscriptions - Other\nPets\nGifts\nClothing\nHolidays & Travel\nSavings - Sinking Fund\nSavings - Investment\nSavings - Pension\nSavings - ISA\nSavings - Emergency Fund\nOther'

function buildPrompt(rows, month, bankLabel, config) {
  const accounts = (config.accounts || []).join(', ')
  const lines = ['Date\tDescription\tAmount']
  for (const r of rows) lines.push(r.date + '\t' + r.description + '\t' + r.amount)
  const corrections = loadCorrections()
  const correctionSection = corrections.length > 0
    ? '\n\nLearned corrections — apply these exact mappings:\n' +
      corrections.map(function(c) { return '- "' + c.description + '" → ' + c.to + '  (not "' + c.from + '")' }).join('\n')
    : ''
  return 'Bank: ' + bankLabel + '\n' +
    'Account name: ' + bankLabel + '\n' +
    'Month: ' + month + '\n' +
    'My own accounts (transfers between these use category "Transfer"): ' + accounts +
    correctionSection + '\n\n' +
    'Process all ' + rows.length + ' transactions below. Use account name "' + bankLabel + '".\n\n' +
    lines.join('\n')
}

// ── HTTP helper (uses built-in https/http, no deps) ───────────────────────────
function httpRequest(url, options, body) {
  return new Promise(function(resolve, reject) {
    const parsed = new URL(url)
    const lib = parsed.protocol === 'https:' ? https : http
    const req = lib.request(url, options, function(res) {
      let data = ''
      res.on('data', function(chunk) { data += chunk })
      res.on('end', function() { resolve({ status: res.statusCode, body: data }) })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

// ── Ollama ────────────────────────────────────────────────────────────────────
async function pingOllama(base) {
  try {
    await httpRequest(base + '/api/tags', { method: 'GET' }, null)
  } catch (e) {
    die('Ollama is not running.\nStart it with:  ollama serve\nThen re-run nb-transactions.')
  }
}

async function callOllama(userMessage, config, chunkLabel, systemPrompt) {
  const base = config.ollamaUrl || 'http://localhost:11434'
  await pingOllama(base)
  log('Sending ' + chunkLabel + ' to Ollama (this may take 30-60s)...')

  const payload = JSON.stringify({
    model: config.model || 'qwen2.5:3b',
    stream: false,
    // num_ctx 4096 is ample for a single CSV chunk and roughly halves the KV cache
    // vs 8192 — the biggest speed/memory win on a low-RAM MacBook Air.
    options: { num_ctx: 4096, temperature: 0 },
    messages: [
      { role: 'system', content: systemPrompt || SYSTEM_PROMPT },
      { role: 'user',   content: userMessage },
    ],
  })

  let res
  try {
    res = await httpRequest(base + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, payload)
  } catch (e) {
    die('Could not reach Ollama: ' + e.message)
  }

  if (res.status === 404 || (res.status !== 200 && res.body.includes('not found'))) {
    die('Model "' + (config.model || 'qwen2.5:3b') + '" not found.\nRun: ollama pull ' + (config.model || 'qwen2.5:3b'))
  }
  if (res.status !== 200) die('Ollama returned HTTP ' + res.status + ': ' + res.body.slice(0, 200))

  const data = JSON.parse(res.body)
  return (data.message && data.message.content) || data.response || ''
}

// ── Parse / validate LLM output ───────────────────────────────────────────────
function extractJSON(responseText) {
  const match = responseText.match(/```transactions-json\s*([\s\S]*?)```/)
  if (match) {
    try { return JSON.parse(match[1].trim()) }
    catch (e) { throw new Error('LLM output is not valid JSON: ' + e.message + '\nExtracted:\n' + match[1].slice(0, 300)) }
  }
  const objMatch = responseText.match(/\{[\s\S]*\}/)
  if (objMatch) {
    try { return JSON.parse(objMatch[0]) } catch (_) {}
  }
  throw new Error('LLM did not output a transactions-json block.\nRaw response:\n' + responseText.slice(0, 400))
}

function validateOutput(json) {
  if (!json || typeof json !== 'object') return 'Not a valid JSON object.'
  if (typeof json.month !== 'string' || !/^\d{4}-\d{2}$/.test(json.month)) return 'Missing or invalid "month" field.'
  if (!Array.isArray(json.transactions)) return 'Missing "transactions" array.'
  const required = ['id', 'date', 'description', 'amount', 'category', 'account']
  for (let i = 0; i < json.transactions.length; i++) {
    const t = json.transactions[i]
    for (const k of required) {
      if (t[k] === undefined) return 'Transaction ' + i + ' missing field "' + k + '".'
    }
    if (typeof t.amount !== 'number' || !isFinite(t.amount)) {
      return 'Transaction ' + i + ': "amount" must be a finite number, got ' + JSON.stringify(t.amount)
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) {
      return 'Transaction ' + i + ': "date" must be YYYY-MM-DD, got "' + t.date + '"'
    }
    if (!CATEGORIES.includes(t.category)) {
      // Remap to Other and flag for user review in the app rather than failing
      t.notes = 'needs-review: ' + t.category
      t.category = 'Other'
    }
  }
  return null
}

// ── Merge + output ────────────────────────────────────────────────────────────
function mergeChunks(chunkResults, month) {
  const importedAt = new Date().toISOString()
  const ts = Date.now()
  let idx = 0
  const allTxns = []
  for (const chunk of chunkResults) {
    for (const t of chunk.transactions) {
      allTxns.push(Object.assign({}, t, { id: 'txn-' + ts + '-' + idx++ }))
    }
  }
  return { month: month, importedAt: importedAt, transactions: allTxns }
}

function printSummary(result) {
  const txns = result.transactions
  const fmt = function(n) { return '£' + Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
  const totalIn  = txns.filter(function(t) { return t.amount > 0 }).reduce(function(s,t) { return s + t.amount }, 0)
  const totalOut = txns.filter(function(t) { return t.amount < 0 }).reduce(function(s,t) { return s + t.amount }, 0)
  const catTotals = {}
  txns.forEach(function(t) { if (t.amount < 0) catTotals[t.category] = (catTotals[t.category] || 0) + Math.abs(t.amount) })
  const top5 = Object.entries(catTotals).sort(function(a,b) { return b[1]-a[1] }).slice(0, 5)
  log('')
  log('Transactions: ' + txns.length)
  log('Total in:     ' + fmt(totalIn))
  log('Total out:    ' + fmt(totalOut))
  if (top5.length) {
    log('Top categories:')
    top5.forEach(function(e) { log('  ' + e[0].padEnd(36) + ' ' + fmt(e[1])) })
  }
}

/// ── Process a single CSV — returns { [YYYY-MM]: chunkResults[] } ─────────────
async function processCsvFile(csvPath, bankLabel, bankKey, monthFilter, config, systemPrompt) {
  let csvText
  try { csvText = fs.readFileSync(csvPath, 'utf8') }
  catch (e) { die('File not found: ' + csvPath) }

  const raw = parseCSV(csvText)
  if (!raw.length) die('No rows found in CSV file.')
  const rows = normaliseRows(raw, bankKey)
  if (!rows.length) die('No valid transactions found after parsing. Try bank "generic" or check the file format.')

  const byMonth = groupByMonth(rows)
  const months = monthFilter ? [monthFilter] : Object.keys(byMonth).sort()

  if (monthFilter && !byMonth[monthFilter]) {
    die('No transactions for ' + monthFilter + ' in this CSV.\nMonths found: ' + Object.keys(byMonth).sort().join(', '))
  }

  log('Bank:    ' + bankLabel)
  log('Months:  ' + months.join(', ') + '  (' + rows.length + ' rows total)')

  const result = {}
  for (const month of months) {
    const monthRows = byMonth[month] || []
    const chunks = buildChunks(monthRows)
    log('')
    log(month + ':  ' + monthRows.length + ' rows' + (chunks.length > 1 ? ' (' + chunks.length + ' chunks)' : ''))

    const chunkResults = []
    for (let i = 0; i < chunks.length; i++) {
      const label = month + (chunks.length > 1 ? ' chunk ' + (i+1) + '/' + chunks.length : '')
      const userMsg = buildPrompt(chunks[i], month, bankLabel, config)

      let responseText
      try { responseText = await callOllama(userMsg, config, label, systemPrompt) }
      catch (e) { die(e.message) }

      let parsed
      // Retry once if the LLM didn't output a parseable JSON block
      try { parsed = extractJSON(responseText) }
      catch (e) {
        log('Parse failed: ' + e.message.split('\n')[0] + ' — retrying...')
        try { responseText = await callOllama(userMsg, config, label + ' retry', systemPrompt) }
        catch (e2) { die(e2.message) }
        try { parsed = extractJSON(responseText) }
        catch (e2) { die('Retry also failed.\n' + e2.message) }
      }

      // Validate — invalid categories are remapped to Other, structural errors fail here
      const err = validateOutput(parsed)
      if (err) die('Validation error for ' + label + ': ' + err)

      const flagged = parsed.transactions.filter(function(t) { return t.notes && t.notes.startsWith('needs-review:') }).length
      if (flagged) log('  ✓ ' + parsed.transactions.length + ' transactions (' + flagged + ' flagged for review)')
      else log('  ✓ ' + parsed.transactions.length + ' transactions categorised')
      chunkResults.push(parsed)
    }
    result[month] = chunkResults
  }

  return result
}

// ══════════════════════════════════════════════════════════════════════════════
//  Automatic bank sync — fetch from Starling/Monzo, categorise locally, push to app
// ══════════════════════════════════════════════════════════════════════════════

// ── Config read/write (safe: does not die if missing) ─────────────────────────
function configFilePath() {
  return path.join(os.homedir(), '.config', 'nb-transactions', 'config.json')
}
function loadConfigSafe() {
  try { return JSON.parse(fs.readFileSync(configFilePath(), 'utf8')) } catch (e) { return {} }
}
function saveConfigObj(obj) {
  const p = configFilePath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(obj, null, 2))
  try { fs.chmodSync(p, 0o600) } catch (e) {}
}

// Alias → path within the config object. Keeps CLI keys friendly.
const CONFIG_ALIASES = {
  synctoken:        ['syncToken'],
  appurl:           ['appUrl'],
  starlingpat:      ['starlingPat'],
  monzoclientid:    ['monzo', 'clientId'],
  monzoclientsecret:['monzo', 'clientSecret'],
  model:            ['model'],
  ollamaurl:        ['ollamaUrl'],
}

function runConfig(config) {
  const args = process.argv.slice(3)
  const sub = args[0]
  if (sub === 'set') {
    if (args.length < 3 || (args.length - 1) % 2 !== 0) {
      die('Usage: nb-transactions config set <key> <value> [<key> <value> ...]')
    }
    for (let i = 1; i < args.length; i += 2) {
      const key = args[i]
      const val = args[i + 1]
      const keyPath = CONFIG_ALIASES[key.toLowerCase()]
      if (!keyPath) die('Unknown config key "' + key + '".\nKnown keys: ' + Object.keys(CONFIG_ALIASES).join(', '))
      let node = config
      for (let j = 0; j < keyPath.length - 1; j++) {
        if (!node[keyPath[j]] || typeof node[keyPath[j]] !== 'object') node[keyPath[j]] = {}
        node = node[keyPath[j]]
      }
      node[keyPath[keyPath.length - 1]] = val
    }
    saveConfigObj(config)
    log('Config updated: ' + configFilePath())
    return Promise.resolve()
  }
  // `config` / `config get` → print current config with secrets redacted
  const red = JSON.parse(JSON.stringify(config))
  if (red.syncToken) red.syncToken = String(red.syncToken).slice(0, 12) + '…'
  if (red.starlingPat) red.starlingPat = '<set>'
  if (red.monzo && red.monzo.clientSecret) red.monzo.clientSecret = '<set>'
  if (red.monzo && red.monzo.refreshToken) red.monzo.refreshToken = '<set>'
  process.stdout.write(JSON.stringify(red, null, 2) + '\n')
  return Promise.resolve()
}

function requireSyncConfig(config) {
  if (!config.appUrl) die('Set your app URL first:\n  nb-transactions config set appUrl https://your-app.example.com')
  if (!config.syncToken) die('Set your sync token (create it in the app → Settings → Automatic Bank Sync):\n  nb-transactions config set syncToken <token>')
  if (!config.starlingPat && !(config.monzo && config.monzo.refreshToken)) {
    die('No banks connected yet.\n  Starling:  nb-transactions config set starlingPat <token>\n  Monzo:     nb-transactions connect-monzo')
  }
}

// ── Authenticated calls to the app API (Bearer sync token) ────────────────────
function apiBase(config) { return String(config.appUrl).replace(/\/$/, '') }

async function apiGet(config, pathQ) {
  const res = await httpRequest(apiBase(config) + pathQ, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + config.syncToken },
  }, null)
  if (res.status === 401) die('Sync token was rejected by the app.\nCreate a new one in Settings → Automatic Bank Sync, then:\n  nb-transactions config set syncToken <token>')
  if (res.status < 200 || res.status >= 300) throw new Error('GET ' + pathQ + ' → HTTP ' + res.status)
  return res.body ? JSON.parse(res.body) : null
}

async function apiPost(config, pathQ, bodyObj) {
  const body = JSON.stringify(bodyObj)
  const res = await httpRequest(apiBase(config) + pathQ, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + config.syncToken,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body)
  if (res.status === 401) die('Sync token was rejected by the app.\nCreate a new one in Settings → Automatic Bank Sync, then:\n  nb-transactions config set syncToken <token>')
  if (res.status < 200 || res.status >= 300) throw new Error('POST ' + pathQ + ' → HTTP ' + res.status + ': ' + res.body.slice(0, 200))
  return res.body ? JSON.parse(res.body) : null
}

// ── Fingerprint merge (ported from the app's src/utils — keep in sync) ────────
function fingerprint(t) {
  return t.date + '|' + t.amount + '|' + t.description + '|' + t.account
}
function mergeTransactions(incoming, existing) {
  const map = new Map()
  for (const t of existing) {
    const fp = fingerprint(t)
    if (!map.has(fp)) map.set(fp, [])
    map.get(fp).push(t)
  }
  const merged = []
  for (const t of incoming) {
    const bucket = map.get(fingerprint(t))
    if (bucket && bucket.length) {
      const ex = bucket.shift()
      // New import wins for everything except the user-curated category/notes.
      merged.push(Object.assign({}, t, { category: ex.category, notes: ex.notes }))
    } else {
      merged.push(t)
    }
  }
  // Existing transactions with no incoming match are preserved.
  for (const bucket of map.values()) for (const ex of bucket) merged.push(ex)
  return { merged }
}

// ── Starling client ───────────────────────────────────────────────────────────
async function starlingApi(pat, pathQ) {
  const res = await httpRequest('https://api.starlingbank.com' + pathQ, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + pat, 'Accept': 'application/json', 'User-Agent': 'nb-transactions' },
  }, null)
  if (res.status === 401 || res.status === 403) throw new Error('token rejected (HTTP ' + res.status + ') — check scopes/expiry')
  if (res.status < 200 || res.status >= 300) throw new Error('API HTTP ' + res.status + ': ' + res.body.slice(0, 160))
  return JSON.parse(res.body)
}

async function fetchStarling(config, since) {
  const pat = config.starlingPat
  const accts = await starlingApi(pat, '/api/v2/accounts')
  const account = (accts.accounts || [])[0]
  if (!account) throw new Error('no accounts returned')
  const uid = account.accountUid
  const catUid = account.defaultCategory
  const minTs = since.toISOString()
  const maxTs = new Date().toISOString()
  const feed = await starlingApi(pat,
    '/api/v2/feed/account/' + uid + '/category/' + catUid +
    '/transactions-between?minTransactionTimestamp=' + encodeURIComponent(minTs) +
    '&maxTransactionTimestamp=' + encodeURIComponent(maxTs))

  const rows = []
  for (const it of (feed.feedItems || [])) {
    if (it.status === 'DECLINED') continue
    const minor = (it.amount && it.amount.minorUnits) || 0
    const val = minor / 100
    const amount = it.direction === 'OUT' ? -val : val
    const desc = [it.counterPartyName, it.reference].filter(Boolean).join(' ').trim() || (it.spendingCategory || 'Starling')
    const date = (it.transactionTime || '').slice(0, 10)
    if (!date || !isFinite(amount)) continue
    rows.push({ date: date, description: desc, amount: amount, account: 'Starling' })
  }

  const spaces = {}
  try {
    const sp = await starlingApi(pat, '/api/v2/account/' + uid + '/spaces')
    for (const g of (sp.savingsGoals || [])) {
      if (g.name != null) spaces[g.name] = ((g.totalSaved && g.totalSaved.minorUnits) || 0) / 100
    }
    for (const s of (sp.spendingSpaces || [])) {
      if (s.name != null) spaces[s.name] = ((s.balance && s.balance.minorUnits) || 0) / 100
    }
  } catch (e) { log('  Starling spaces unavailable: ' + e.message) }

  return { rows: rows, spaces: spaces }
}

// ── Monzo client (OAuth) ──────────────────────────────────────────────────────
const MONZO_REDIRECT_URI = 'http://localhost:47000/callback'

async function monzoToken(params) {
  const body = Object.keys(params).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k])
  }).join('&')
  const res = await httpRequest('https://api.monzo.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  }, body)
  if (res.status < 200 || res.status >= 300) throw new Error('token exchange HTTP ' + res.status + ': ' + res.body.slice(0, 200))
  return JSON.parse(res.body)
}

async function monzoApi(accessToken, pathQ) {
  const res = await httpRequest('https://api.monzo.com' + pathQ, {
    method: 'GET', headers: { 'Authorization': 'Bearer ' + accessToken },
  }, null)
  if (res.status === 401) throw new Error('access denied — token expired, or access not yet approved in the Monzo app')
  if (res.status < 200 || res.status >= 300) throw new Error('API HTTP ' + res.status + ': ' + res.body.slice(0, 160))
  return JSON.parse(res.body)
}

async function fetchMonzo(config, since) {
  // Rotate the 30-hour access token using the stored refresh token (Monzo rotates both).
  const tok = await monzoToken({
    grant_type: 'refresh_token',
    client_id: config.monzo.clientId,
    client_secret: config.monzo.clientSecret,
    refresh_token: config.monzo.refreshToken,
  })
  config.monzo.accessToken = tok.access_token
  if (tok.refresh_token) config.monzo.refreshToken = tok.refresh_token
  saveConfigObj(config)
  const accessToken = tok.access_token

  const accts = await monzoApi(accessToken, '/accounts')
  const accounts = (accts.accounts || []).filter(function (a) { return !a.closed })
  if (!accounts.length) throw new Error('no open accounts')

  const rows = []
  const pots = {}
  const sinceIso = since.toISOString()
  for (const acct of accounts) {
    const txnRes = await monzoApi(accessToken,
      '/transactions?expand[]=merchant&account_id=' + encodeURIComponent(acct.id) + '&since=' + encodeURIComponent(sinceIso))
    for (const t of (txnRes.transactions || [])) {
      if (t.decline_reason) continue
      if (!t.amount) continue
      const amount = t.amount / 100   // minor units, already signed (debit negative)
      const desc = (t.merchant && t.merchant.name) || t.description || (t.counterparty && t.counterparty.name) || 'Monzo'
      const date = (t.created || '').slice(0, 10)
      if (!date || !isFinite(amount)) continue
      rows.push({ date: date, description: String(desc), amount: amount, account: 'Monzo' })
    }
    try {
      const potRes = await monzoApi(accessToken, '/pots?current_account_id=' + encodeURIComponent(acct.id))
      for (const p of (potRes.pots || [])) {
        if (p.deleted) continue
        if (p.name != null) pots[p.name] = (p.balance || 0) / 100
      }
    } catch (e) { /* pots are optional */ }
  }

  const lastAuthAt = config.monzo.lastAuthAt || null
  const reauthDueAt = lastAuthAt ? new Date(new Date(lastAuthAt).getTime() + 90 * 86400000).toISOString() : null
  return { rows: rows, pots: pots, lastAuthAt: lastAuthAt, reauthDueAt: reauthDueAt }
}

async function runConnectMonzo(config) {
  if (!config.monzo || !config.monzo.clientId || !config.monzo.clientSecret) {
    die('Monzo needs your own OAuth client first. Three steps:\n' +
        '\n' +
        '  1. Sign in at https://developers.monzo.com (magic link by email), then\n' +
        '     Clients -> New OAuth Client. Name/description can be anything.\n' +
        '\n' +
        '  2. Set these two fields exactly:\n' +
        '       Redirect URL:      ' + MONZO_REDIRECT_URI + '\n' +
        '       Confidentiality:   Confidential\n' +
        '     (Non-confidential returns no refresh token, so sync dies after ~30h,\n' +
        '      and it cannot be changed later — you would need a new client.)\n' +
        '\n' +
        '  3. Open the client, copy its Client ID and Client secret, then run:\n' +
        '       nb-transactions config set monzoClientId <client-id> monzoClientSecret <client-secret>\n' +
        '\n' +
        'Then run this command again.')
  }
  const crypto = require('crypto')
  const cp = require('child_process')
  const state = crypto.randomBytes(16).toString('hex')
  const authUrl = 'https://auth.monzo.com/?client_id=' + encodeURIComponent(config.monzo.clientId) +
    '&redirect_uri=' + encodeURIComponent(MONZO_REDIRECT_URI) +
    '&response_type=code&state=' + state

  const code = await new Promise(function (resolve, reject) {
    const server = http.createServer(function (req, res) {
      const u = new URL(req.url, MONZO_REDIRECT_URI)
      if (u.pathname !== '/callback') { res.writeHead(404); res.end(); return }
      const gotState = u.searchParams.get('state')
      const gotCode = u.searchParams.get('code')
      res.writeHead(200, { 'Content-Type': 'text/html' })
      if (gotState !== state || !gotCode) {
        res.end('<h2>Authorisation failed.</h2><p>Close this tab and run connect-monzo again.</p>')
        server.close(); reject(new Error('state mismatch or missing code')); return
      }
      res.end('<h2>Monzo connected ✓</h2><p>Now open the Monzo app on your phone and approve access, then return to the terminal. You can close this tab.</p>')
      server.close(); resolve(gotCode)
    })
    server.on('error', function (e) { reject(new Error('Could not start local callback server on :47000 — ' + e.message)) })
    server.listen(47000, function () {
      log('Opening your browser to authorise Monzo…')
      log('If it does not open, paste this into your browser:')
      log('  ' + authUrl)
      try { cp.exec('open "' + authUrl + '"') } catch (e) {}
    })
  })

  const tok = await monzoToken({
    grant_type: 'authorization_code',
    client_id: config.monzo.clientId,
    client_secret: config.monzo.clientSecret,
    redirect_uri: MONZO_REDIRECT_URI,
    code: code,
  })
  if (!tok.refresh_token) log('Warning: Monzo did not return a refresh token — make sure your OAuth client is "Confidential".')
  config.monzo.refreshToken = tok.refresh_token || config.monzo.refreshToken
  config.monzo.accessToken = tok.access_token
  config.monzo.lastAuthAt = new Date().toISOString()
  saveConfigObj(config)
  log('')
  log('Monzo connected — one thing left, and sync will not work without it:')
  log('')
  log('  Open the Monzo app on your phone. There is a notification asking to')
  log('  allow access to your data. Tap Approve.')
  log('')
  log('Until you do, every sync fails with "access denied". Then run:')
  log('  nb-transactions sync')
}

// ── Categorise already-normalised rows → { [YYYY-MM]: chunkResults[] } ─────────
async function categoriseNormalisedRows(rows, bankLabel, config, systemPrompt) {
  const byMonth = groupByMonth(rows)
  const result = {}
  for (const month of Object.keys(byMonth).sort()) {
    const chunks = buildChunks(byMonth[month])
    const chunkResults = []
    for (let i = 0; i < chunks.length; i++) {
      const label = bankLabel + ' ' + month + (chunks.length > 1 ? ' chunk ' + (i + 1) + '/' + chunks.length : '')
      const userMsg = buildPrompt(chunks[i], month, bankLabel, config)
      let responseText = await callOllama(userMsg, config, label, systemPrompt)
      let parsed
      try {
        parsed = extractJSON(responseText)
      } catch (e) {
        log('  Parse failed for ' + label + ' — retrying...')
        responseText = await callOllama(userMsg, config, label + ' retry', systemPrompt)
        parsed = extractJSON(responseText)
      }
      const err = validateOutput(parsed)
      if (err) throw new Error('Validation error for ' + label + ': ' + err)
      chunkResults.push(parsed)
    }
    result[month] = chunkResults
  }
  return result
}

// ── Map Starling Spaces / Monzo Pots → budget group "held" balances ───────────
function stripSpacePrefix(name) {
  return (name || '').replace(/^Space\s+\d+:\s*/i, '').trim()
}
async function updateHeldBalances(config, potBalances) {
  const budget = await apiGet(config, '/api/budget')
  if (!budget || !Array.isArray(budget.sections)) { log('  No budget found — skipping held balances.'); return 0 }
  const potMap = config.potMap || {}
  const byLower = {}
  for (const name of Object.keys(potBalances)) byLower[name.toLowerCase().trim()] = potBalances[name]

  let updated = 0
  for (const sec of budget.sections) {
    for (const g of (sec.groups || [])) {
      let bal = null
      const override = potMap[g.name]                                   // explicit: group name → pot/space name
      if (override && byLower[override.toLowerCase().trim()] != null) {
        bal = byLower[override.toLowerCase().trim()]
      } else {
        const disp = stripSpacePrefix(g.name).toLowerCase()             // "Space 1: Bills" → "bills"
        if (byLower[disp] != null) bal = byLower[disp]
        else if (byLower[String(g.name).toLowerCase().trim()] != null) bal = byLower[String(g.name).toLowerCase().trim()]
      }
      if (bal != null) { g.currentBalance = Math.round(bal * 100) / 100; updated++ }
    }
  }
  if (updated) { await apiPost(config, '/api/budget', budget); log('  Held balances updated for ' + updated + ' space(s).') }
  else log('  No spaces matched a budget group (name them to match, or set potMap).')
  return updated
}

// ── The sync command ──────────────────────────────────────────────────────────
async function runSync(config) {
  requireSyncConfig(config)
  const customMerchantRules = loadMerchantRules()
  const fullSystemPrompt = SYSTEM_PROMPT + '\n\n' + buildMerchantSection(customMerchantRules)
  const since = new Date(Date.now() - 90 * 86400000)   // rolling 90-day window; merge de-dups overlaps

  const status = { syncedAt: new Date().toISOString(), banks: {}, error: null }
  const potBalances = {}
  const monthChunks = {}
  function accumulate(byMonth) {
    for (const m of Object.keys(byMonth)) {
      if (!monthChunks[m]) monthChunks[m] = []
      monthChunks[m] = monthChunks[m].concat(byMonth[m])
    }
  }

  if (config.starlingPat) {
    try {
      log('Fetching Starling…')
      const out = await fetchStarling(config, since)
      log('  Starling: ' + out.rows.length + ' transactions, ' + Object.keys(out.spaces).length + ' space(s)')
      Object.assign(potBalances, out.spaces)
      accumulate(await categoriseNormalisedRows(out.rows, 'Starling', config, fullSystemPrompt))
      status.banks.starling = { connected: true, count: out.rows.length }
    } catch (e) {
      status.banks.starling = { connected: false }
      status.error = 'Starling: ' + e.message
      log('  Starling error: ' + e.message)
    }
  }

  if (config.monzo && config.monzo.refreshToken) {
    try {
      log('Fetching Monzo…')
      const out = await fetchMonzo(config, since)
      log('  Monzo: ' + out.rows.length + ' transactions, ' + Object.keys(out.pots).length + ' pot(s)')
      Object.assign(potBalances, out.pots)
      accumulate(await categoriseNormalisedRows(out.rows, 'Monzo', config, fullSystemPrompt))
      status.banks.monzo = { connected: true, count: out.rows.length, lastAuthAt: out.lastAuthAt, reauthDueAt: out.reauthDueAt }
    } catch (e) {
      status.banks.monzo = { connected: false }
      status.error = 'Monzo: ' + e.message
      log('  Monzo error: ' + e.message)
    }
  }

  const months = Object.keys(monthChunks).sort()
  for (const month of months) {
    const incoming = mergeChunks(monthChunks[month], month).transactions
    let existing = []
    try {
      const doc = await apiGet(config, '/api/transactions?month=' + month)
      existing = (doc && doc.transactions) || []
    } catch (e) { log('  Could not load existing ' + month + ': ' + e.message) }
    const merged = mergeTransactions(incoming, existing).merged
    await apiPost(config, '/api/transactions?month=' + month, {
      month: month, importedAt: new Date().toISOString(), transactions: merged, source: 'agent',
    })
    log('  ' + month + ': ' + merged.length + ' transactions saved')
  }

  if (Object.keys(potBalances).length) {
    try { await updateHeldBalances(config, potBalances) } catch (e) { log('  Held-balance update failed: ' + e.message) }
  }

  try { await apiPost(config, '/api/budget?resource=sync-status', status) } catch (e) { log('  Could not write status: ' + e.message) }

  if (status.error) { log(''); log('Sync finished with errors: ' + status.error) }
  else { log(''); log('Sync complete — ' + months.length + ' month(s) updated.') }
}

// ── Scheduling via launchd (macOS) ────────────────────────────────────────────
function launchAgentPath() {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.nb-transactions.sync.plist')
}
function syncLogPath() {
  return path.join(os.homedir(), '.local', 'state', 'nb-transactions', 'sync.log')
}

function runSchedule(config) {
  const cp = require('child_process')
  const action = process.argv[3]
  const plistPath = launchAgentPath()
  const logPath = syncLogPath()
  const scriptPath = process.argv[1]        // installed nb-transactions
  const nodePath = process.execPath         // exec node directly — launchd has a minimal PATH

  if (action === 'on') {
    fs.mkdirSync(path.dirname(logPath), { recursive: true })
    fs.mkdirSync(path.dirname(plistPath), { recursive: true })
    const plist =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
      '<plist version="1.0">\n<dict>\n' +
      '  <key>Label</key><string>com.nb-transactions.sync</string>\n' +
      '  <key>ProgramArguments</key>\n  <array>\n' +
      '    <string>' + nodePath + '</string>\n' +
      '    <string>' + scriptPath + '</string>\n' +
      '    <string>sync</string>\n' +
      '  </array>\n' +
      '  <key>RunAtLoad</key><true/>\n' +
      '  <key>StartInterval</key><integer>3600</integer>\n' +
      '  <key>StandardOutPath</key><string>' + logPath + '</string>\n' +
      '  <key>StandardErrorPath</key><string>' + logPath + '</string>\n' +
      '</dict>\n</plist>\n'
    fs.writeFileSync(plistPath, plist)
    try { cp.execSync('launchctl unload "' + plistPath + '" 2>/dev/null') } catch (e) {}
    cp.execSync('launchctl load "' + plistPath + '"')
    log('Automatic sync enabled — runs at login, then hourly (missed runs fire on wake).')
    log('Logs: ' + logPath)
    return Promise.resolve()
  }

  if (action === 'off') {
    try { cp.execSync('launchctl unload "' + plistPath + '" 2>/dev/null') } catch (e) {}
    try { fs.unlinkSync(plistPath) } catch (e) {}
    log('Automatic sync disabled.')
    return Promise.resolve()
  }

  log('Usage: nb-transactions schedule on|off')
  log('Currently: ' + (fs.existsSync(plistPath) ? 'enabled (' + plistPath + ')' : 'disabled'))
  return Promise.resolve()
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const { csvPath, bankLabel, bankKey, month: argMonth, dryRun, appendMode } = parseArgs(process.argv)
  const config = loadConfig()
  const customMerchantRules = loadMerchantRules()
  const merchantSection = buildMerchantSection(customMerchantRules)
  const fullSystemPrompt = SYSTEM_PROMPT + '\n\n' + merchantSection
  if (customMerchantRules.length > 0) {
    log('Loaded ' + customMerchantRules.length + ' custom merchant rule(s) from merchant-rules.json')
  }
  log('Using ' + PRE_SEEDED_MERCHANT_RULES.length + ' pre-seeded merchant rules')

  if (dryRun) {
    let csvText
    try { csvText = fs.readFileSync(csvPath, 'utf8') }
    catch (e) { die('File not found: ' + csvPath) }
    const raw = parseCSV(csvText)
    const rows = normaliseRows(raw, bankKey)
    const byMonth = groupByMonth(rows)
    const months = argMonth ? [argMonth] : Object.keys(byMonth).sort()
    const firstMonth = months[0]
    const firstChunks = buildChunks(byMonth[firstMonth] || [])
    process.stdout.write('\n--- DRY RUN: System prompt ---\n\n' + fullSystemPrompt + '\n')
    process.stdout.write('\n--- DRY RUN: User message for ' + firstMonth + ' chunk 1 ---\n\n' + buildPrompt(firstChunks[0] || [], firstMonth, bankLabel, config) + '\n\n')
    log('Dry run complete. No output file written.')
    return
  }

  // allMonthData accumulates chunkResults per month across all bank CSVs.
  // We save each month's file immediately after merging so progress is never lost.
  const allMonthData = {}
  const savedFiles = new Set()

  function saveMonth(month) {
    const result = mergeChunks(allMonthData[month], month)
    const outFile = path.join(os.homedir(), 'Downloads', 'transactions-' + month + '.json')

    // --append: if this month's file already exists and hasn't been written this session,
    // load its transactions and combine them with the new ones
    if (appendMode && !savedFiles.has(outFile)) {
      try {
        const existing = JSON.parse(fs.readFileSync(outFile, 'utf8'))
        if (Array.isArray(existing.transactions) && existing.transactions.length) {
          log('  → Merging with existing ' + existing.transactions.length + ' transactions for ' + month)
          const ts = Date.now()
          const combined = existing.transactions.concat(result.transactions)
          combined.forEach(function(t, i) { t.id = 'txn-' + ts + '-' + i })
          result.transactions = combined
        }
      } catch (e) { /* no existing file — write fresh */ }
    }

    fs.writeFileSync(outFile, JSON.stringify(result, null, 2))
    if (!savedFiles.has(outFile)) {
      log('  → Saved: ' + outFile)
      savedFiles.add(outFile)
    } else {
      log('  → Updated: ' + outFile)
    }
  }

  function mergeIntoAndSave(csvResult) {
    for (const month of Object.keys(csvResult).sort()) {
      if (!allMonthData[month]) allMonthData[month] = []
      allMonthData[month] = allMonthData[month].concat(csvResult[month])
      saveMonth(month)
    }
  }

  mergeIntoAndSave(await processCsvFile(csvPath, bankLabel, bankKey, argMonth, config, fullSystemPrompt))

  // Ask if the user has more bank CSVs to add
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr })

  while (true) {
    process.stderr.write('\n')
    const ans = await askUser(rl, '  Add another bank CSV? (y/n): ')
    if (ans.trim().toLowerCase() !== 'y') break

    const nextPath = expandPath((await askUser(rl, '  CSV file path: ')).trim())
    const nextBank = (await askUser(rl, '  Bank name (e.g. Starling, Monzo, HSBC): ')).trim()
    if (!nextPath || !nextBank) { log('Skipping — enter both a file path and a bank name.'); continue }

    mergeIntoAndSave(await processCsvFile(nextPath, nextBank, nextBank.toLowerCase(), null, config, fullSystemPrompt))
  }

  rl.close()

  const outFiles = Array.from(savedFiles).sort()
  log('')
  if (outFiles.length > 1) {
    log('Done. ' + outFiles.length + ' files saved — import each one separately in the app.')
  } else {
    log('Done. Import this file via the Import JSON button in the NeuroBank app.')
  }
  log('')
  process.stdout.write(outFiles.join('\n') + '\n')
}

// ── Entry point: dispatch subcommands, else fall back to the CSV import flow ──
const SUBCOMMANDS = { sync: runSync, 'connect-monzo': runConnectMonzo, config: runConfig, schedule: runSchedule }
;(function dispatch() {
  const cmd = process.argv[2]
  const fail = function (e) { process.stderr.write('\nError: ' + e.message + '\n'); process.exit(1) }
  if (SUBCOMMANDS[cmd]) {
    const cfg = cmd === 'config' ? loadConfigSafe() : loadConfig()
    Promise.resolve().then(function () { return SUBCOMMANDS[cmd](cfg) }).catch(fail)
  } else {
    main().catch(function (e) { process.stderr.write('\nUnexpected error: ' + e.message + '\n'); process.exit(1) })
  }
})()
PROCESSOREOF

chmod +x "$PROCESSOR"
ok "nb-transactions installed"

# ── 8. PATH ───────────────────────────────────────────────────────────────────
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  warn "$BIN_DIR is not on your PATH — adding it now..."
  for rc in "$HOME/.zshrc" "$HOME/.bash_profile"; do
    # Create .zshrc if it doesn't exist (common on fresh Macs)
    if [ -f "$rc" ] || [[ "$rc" == "$HOME/.zshrc" ]]; then
      printf '\n# Added by nb-transactions installer\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$rc"
    fi
  done
  export PATH="$HOME/.local/bin:$PATH"
  warn "Run 'source ~/.zshrc' or open a new terminal window after install."
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  All done!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Before your first run, edit your account names:"
echo "    $CONFIG_FILE"
echo ""
echo "  Replace [\"Starling\", \"Monzo\"] with the names of your actual bank"
echo "  accounts (used to detect transfers between your own accounts)."
echo ""
echo "  ── Each month ─────────────────────────────────────────────────"
echo ""
echo "  1. Export CSVs from each of your banks"
echo "  2. Run (using your first bank as a starting point):"
echo "       nb-transactions ~/Downloads/yourfile.csv Starling"
echo ""
echo "  3. When prompted, enter y to add more bank CSVs one by one."
echo "     Enter n when you have no more CSVs to add."
echo ""
echo "  4. A combined .json is saved to ~/Downloads/ — import it via"
echo "     the Import JSON button in the app."
echo ""
echo "  Supported banks:  starling  monzo  hsbc  nationwide  halifax  barclays  revolut"
echo ""
echo "  Note: Ollama must be running before use.  Start it with:  ollama serve"
echo ""
