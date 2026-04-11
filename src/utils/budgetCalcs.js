// Group IDs that are treated as savings/sinking funds rather than spending.
// group.isSavings === true is also respected for any user-added groups.
const SAVINGS_GROUP_IDS = ['monzo-van', 'monzo-prop', 'monzo-inst', 'monzo-goals']

export function stripPrefix(name) {
  return (name || '').replace(/^Space\s+\d+:\s*/i, '').trim()
}

export function isSavingsGroup(group) {
  return group.isSavings === true || SAVINGS_GROUP_IDS.includes(group.id)
}

/**
 * Calculates a complete budget summary including true savings rate.
 *
 * Savings = pension (pre-tax) + ISA + savings groups + unallocated surplus
 * Gross income = take-home + pension (pension on both sides keeps the % honest)
 */
export function calcBudgetSummary(budget) {
  const settings = budget.settings || {}
  const isaContribution = settings.isaMonthlyContribution || 0
  const pensionContribution = settings.pensionMonthlyContribution || 0

  const totalIncome = budget.income.items.reduce((s, i) => s + i.monthly, 0)

  let budgetedSavings = 0
  let budgetedSpending = 0

  budget.sections.forEach(sec => {
    sec.groups.forEach(g => {
      if (isSavingsGroup(g)) {
        // Entire group is savings
        budgetedSavings += g.items.reduce((s, i) => s + i.monthly, 0)
      } else {
        // Check item-level isSavings flag
        g.items.forEach(item => {
          if (item.isSavings) {
            budgetedSavings += item.monthly
          } else {
            budgetedSpending += item.monthly
          }
        })
      }
    })
  })

  const totalExpenses = budgetedSavings + budgetedSpending
  const surplus = totalIncome - totalExpenses

  // True savings includes pension (pre-tax), ISA, budgeted savings groups, and any remaining surplus
  const totalSavings = pensionContribution + isaContribution + budgetedSavings + surplus

  // Gross income = take-home + pension so pension is on both sides
  const grossIncome = totalIncome + pensionContribution

  const savingsRate = grossIncome > 0 ? (totalSavings / grossIncome) * 100 : 0

  return {
    totalIncome,        // take-home pay
    grossIncome,        // take-home + pension
    totalExpenses,      // all budget groups combined
    budgetedSpending,   // non-savings groups only
    budgetedSavings,    // savings groups only (van, property, instrument, goals)
    isaContribution,    // from settings.isaMonthlyContribution
    pensionContribution,// from settings.pensionMonthlyContribution (pre-tax)
    surplus,            // take-home minus all budgeted groups
    totalSavings,       // pension + ISA + savings groups + surplus
    savingsRate,        // totalSavings / grossIncome * 100
  }
}
