// Legacy group IDs treated as savings. Kept for backward-compat with old JSON that has no savingsType.
const ANNUAL_FUND_IDS   = ['monzo-van', 'monzo-prop', 'monzo-inst']
const LONGTERM_FUND_IDS = ['monzo-goals']

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
 * True savings = pension (pre-tax) + ISA + long-term pots + unallocated surplus
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
  let longtermSavings = 0
  let budgetedSpending = 0

  budget.sections.forEach(sec => {
    sec.groups.forEach(g => {
      const groupType = resolveSavingsType(g)
      if (groupType) {
        // Entire group is savings — split by type
        const groupTotal = g.items.reduce((s, i) => s + i.monthly, 0)
        if (groupType === 'annual') annualFunds += groupTotal
        else longtermSavings += groupTotal
      } else {
        // Check item-level savingsType / legacy isSavings
        g.items.forEach(item => {
          const itemType = resolveSavingsType(item)
          if (itemType === 'annual')   annualFunds += item.monthly
          else if (itemType === 'longterm') longtermSavings += item.monthly
          else budgetedSpending += item.monthly
        })
      }
    })
  })

  const budgetedSavings = annualFunds + longtermSavings   // kept for backward compat
  const totalExpenses = budgetedSavings + budgetedSpending
  const surplus = totalIncome - totalExpenses

  // True savings: annual funds are excluded (they're predictable costs, not wealth building)
  const totalSavings = pensionContribution + isaContribution + longtermSavings + surplus

  const grossIncome = totalIncome + pensionContribution

  const savingsRate = grossIncome > 0 ? (totalSavings / grossIncome) * 100 : 0

  return {
    totalIncome,        // take-home pay
    grossIncome,        // take-home + pension
    totalExpenses,      // all budget groups combined
    budgetedSpending,   // non-savings groups only
    budgetedSavings,    // annualFunds + longtermSavings (backward compat)
    annualFunds,        // annual sinking funds — excluded from savings rate
    longtermSavings,    // long-term savings pots — counted in savings rate
    isaContribution,    // from settings.isaMonthlyContribution
    pensionContribution,// from settings.pensionMonthlyContribution (pre-tax)
    surplus,            // take-home minus all budgeted groups
    totalSavings,       // pension + ISA + long-term pots + surplus
    savingsRate,        // totalSavings / grossIncome * 100
  }
}
