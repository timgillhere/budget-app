import { isTransfer, INCOME_CATEGORIES, CATEGORY_TO_BUDGET_GROUP } from '../data/transactionCategories'

// Legacy group IDs treated as savings. Kept for backward-compat with old JSON that has no savingsType.
const ANNUAL_FUND_IDS   = ['monzo-van', 'monzo-prop', 'monzo-inst']
const LONGTERM_FUND_IDS = ['monzo-goals']

/**
 * Sums actual spend per transaction category for a month's transactions.
 * Spend = negative amounts only; transfers are excluded. Returns positive
 * numbers keyed by category, e.g. { Groceries: 287.4 }.
 */
export function spentByCategory(transactions) {
  const out = {}
  if (!transactions) return out
  transactions.forEach(t => {
    if (!t || t.amount >= 0 || isTransfer(t)) return
    out[t.category] = (out[t.category] || 0) + Math.abs(t.amount)
  })
  return out
}

/**
 * Rolls category spend up to budget group names via CATEGORY_TO_BUDGET_GROUP.
 * Income categories and unmapped categories are dropped. Returns positive
 * totals keyed by group name, e.g. { 'Space 6: Groceries': 287.4 }.
 */
export function spentByGroupName(transactions) {
  const out = {}
  for (const [cat, amount] of Object.entries(spentByCategory(transactions))) {
    if (INCOME_CATEGORIES.has(cat)) continue
    const groupName = CATEGORY_TO_BUDGET_GROUP[cat]
    if (!groupName) continue
    out[groupName] = (out[groupName] || 0) + amount
  }
  return out
}

export function stripPrefix(name) {
  return (name || '').replace(/^Space\s+\d+:\s*/i, '').trim()
}

// Returns 'annual', 'longterm', or null for a group/item
function resolveSavingsType(entity) {
  if (entity.savingsType) return entity.savingsType
  // Legacy ID-based detection (groups only)
  if (ANNUAL_FUND_IDS.includes(entity.id))   return 'annual'
  if (LONGTERM_FUND_IDS.includes(entity.id)) return 'longterm'
  // Legacy boolean flag
  if (entity.isSavings === true) return 'longterm'
  return null
}

// True for both annual funds and long-term savings (i.e. not counted as spending)
export function isSavingsGroup(group) {
  return resolveSavingsType(group) !== null
}

export function isAnnualFundGroup(group) {
  return resolveSavingsType(group) === 'annual'
}

export function isLongtermSavingsGroup(group) {
  return resolveSavingsType(group) === 'longterm'
}

/**
 * Calculates a complete budget summary including true savings rate.
 *
 * Annual funds (van, insurance etc.) are excluded from the savings rate —
 * they are predictable costs set aside, not genuine wealth accumulation.
 *
 * True savings = pension (pre-tax) + ISA + long-term pots (intentional savings only)
 * Gross income = take-home + pension (pension on both sides keeps the % honest)
 */
/**
 * Resolves the pensions array from settings, handling both the new `pensions`
 * array and the legacy `pensionBalance` / `pensionMonthlyContribution` fields.
 */
export function getPensionTotals(settings) {
  const s = settings || {}
  const pensions = s.pensions && s.pensions.length > 0
    ? s.pensions
    : (s.pensionBalance || s.pensionMonthlyContribution
        ? [{ id: 'pension-legacy', name: 'Pension', balance: s.pensionBalance || 0, monthlyContribution: s.pensionMonthlyContribution || 0 }]
        : [])
  return {
    pensions,
    pensionBalance: pensions.reduce((sum, p) => sum + (p.balance || 0), 0),
    pensionMonthlyContribution: pensions.reduce((sum, p) => sum + (p.monthlyContribution || 0), 0),
  }
}

export function calcBudgetSummary(budget) {
  const settings = budget.settings || {}
  const isaContribution = settings.isaMonthlyContribution || 0
  const { pensionMonthlyContribution: pensionContribution } = getPensionTotals(settings)

  const totalIncome = budget.income.items.reduce((s, i) => s + i.monthly, 0)

  let annualFunds = 0
  let budgetedSpending = 0

  budget.sections.forEach(sec => {
    sec.groups.forEach(g => {
      const groupType = resolveSavingsType(g)
      if (groupType === 'annual') {
        // Annual sinking fund — not counted as spending or savings rate
        const groupTotal = g.items.reduce((s, i) => s + i.monthly, 0)
        annualFunds += groupTotal
      } else {
        // All other groups (including legacy longterm) treated as spending
        g.items.forEach(item => {
          const itemType = resolveSavingsType(item)
          if (itemType === 'annual') annualFunds += item.monthly
          else budgetedSpending += item.monthly
        })
      }
    })
  })

  const budgetedSavings = annualFunds   // kept for backward compat
  const longtermSavings = 0             // no longer tracked via budget items
  const totalExpenses = annualFunds + budgetedSpending
  const surplus = totalIncome - totalExpenses

  // True savings: pension and ISA contributions from settings only
  const totalSavings = pensionContribution + isaContribution

  const grossIncome = totalIncome + pensionContribution

  const savingsRate = grossIncome > 0 ? (totalSavings / grossIncome) * 100 : 0

  return {
    totalIncome,        // take-home pay
    grossIncome,        // take-home + pension
    totalExpenses,      // all budget groups combined
    budgetedSpending,   // non-savings groups only
    budgetedSavings,    // annualFunds (backward compat)
    annualFunds,        // annual sinking funds — excluded from savings rate
    longtermSavings,    // always 0 — kept for backward compat
    isaContribution,    // from settings.isaMonthlyContribution
    pensionContribution,// from settings.pensionMonthlyContribution (pre-tax)
    surplus,            // take-home minus all budgeted groups
    totalSavings,       // pension + ISA (intentional savings only)
    savingsRate,        // totalSavings / grossIncome * 100
  }
}
