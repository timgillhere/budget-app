// Blank starting budget for new users — same structure, no personal data
export const emptyBudget = {
  income: { items: [] },
  sections: [
    { id: 'savings', name: '🏦 Savings Account', color: '#2E75B6', bgLight: '#DBEAFE', groups: [] },
    { id: 'current', name: '💳 Current Account',  color: '#C55A11', bgLight: '#FEF3C7', groups: [] },
    { id: 'goals',   name: '🎯 Goals & Pots',     color: '#7030A0', bgLight: '#F3E8FF', groups: [] },
  ],
  holidays: { trips: [] },
  settings: {
    name: '',
    currentAge: 30, retirementAge: 66, statePensionAge: 68, statePensionWeekly: 221.20,
    isaBalance: 0, isaMonthlyContribution: 0,
    pensions: [],
    savingsRateTarget: 10,
    propertyValue: 0, mortgageBalance: 0, mortgageRate: 0,
    mortgageMonthlyPayment: 0, mortgageEndDate: '', mortgageRateAfterRemortgage: 0,
    bufferBalance: 0,
    futureEvents: [],
    investmentGrowthRatePct: 5, propertyGrowthRatePct: 3, inflationPct: 2.5,
    goals: [],
    onboardingComplete: false
  },
  netWorth: { snapshots: [] }
}

export const defaultBudget = {
  // ── Example budget for a typical household ────────────────────────
  income: {
    items: [
      { id: 'inc-1', name: 'Monthly Take-Home Pay', monthly: 2800, notes: 'Net salary after tax and NI' }
    ]
  },
  sections: [
    {
      id: 'savings', name: '🏦 Savings Account', color: '#2E75B6', bgLight: '#DBEAFE',
      groups: [
        { id: 'space-1', name: 'Bills', items: [
          { id: 's1-1', name: 'Rent / Mortgage', monthly: 950, notes: '' },
          { id: 's1-2', name: 'Energy', monthly: 100, notes: 'Gas & electricity' },
          { id: 's1-3', name: 'Water', monthly: 35, notes: '' },
          { id: 's1-4', name: 'Broadband', monthly: 30, notes: '' },
          { id: 's1-5', name: 'Council Tax', monthly: 130, notes: '' },
          { id: 's1-6', name: 'Mobile Phone', monthly: 15, notes: '' }
        ]},
        { id: 'space-2', name: 'Groceries', items: [
          { id: 's2-1', name: 'Supermarket', monthly: 300, notes: 'Food & household items' }
        ]},
        { id: 'space-3', name: 'Transport', items: [
          { id: 's3-1', name: 'Fuel', monthly: 80, notes: '' },
          { id: 's3-2', name: 'Car Insurance', monthly: 50, notes: '' },
          { id: 's3-3', name: 'Public Transport', monthly: 40, notes: '' }
        ]},
        { id: 'space-4', name: 'Gifts', items: [
          { id: 's4-1', name: 'Birthdays & Christmas', monthly: 20, notes: '' }
        ]},
        { id: 'space-5', name: 'Health & Wellbeing', items: [
          { id: 's5-1', name: 'Gym', monthly: 30, notes: '' },
          { id: 's5-2', name: 'Prescriptions', monthly: 10, notes: '' }
        ]}
      ]
    },
    {
      id: 'current', name: '💳 Current Account', color: '#C55A11', bgLight: '#FEF3C7',
      groups: [
        { id: 'ca-1', name: 'Discretionary', items: [
          { id: 'ca-1-1', name: 'Eating out & takeaways', monthly: 80, notes: '' },
          { id: 'ca-1-2', name: 'Social & hobbies', monthly: 100, notes: 'Drinks, events, activities' }
        ]},
        { id: 'ca-2', name: 'Subscriptions', items: [
          { id: 'ca-2-1', name: 'Streaming (Netflix, Spotify…)', monthly: 20, notes: '' },
          { id: 'ca-2-2', name: 'Cloud storage', monthly: 3, notes: '' }
        ]}
      ]
    },
    {
      id: 'goals', name: '🎯 Goals & Pots', color: '#7030A0', bgLight: '#F3E8FF',
      groups: [
        { id: 'goals-emergency', name: '🛡️ Emergency Fund', savingsType: 'annual', isSavings: true, items: [
          { id: 'g-e1', name: 'Emergency fund top-up', monthly: 50, notes: 'Target: 3 months of expenses' }
        ]},
        { id: 'goals-holiday', name: '✈️ Holiday Fund', savingsType: 'annual', isSavings: true, items: [
          { id: 'g-h1', name: 'Holidays', monthly: 100, notes: 'Auto-linked to Holiday Planner' }
        ]},
        { id: 'goals-bigpurchases', name: '🛍️ Big Purchases', savingsType: 'annual', isSavings: true, items: [
          { id: 'g-b1', name: 'New laptop', monthly: 20, notes: '' },
          { id: 'g-b2', name: 'Clothing', monthly: 30, notes: '' }
        ]}
      ]
    }
  ],

  // ── Holidays ──────────────────────────────────────────────────────
  holidays: {
    trips: [
      {
        id: 'trip-citybreak',
        destination: 'Weekend City Break',
        status: 'planned',
        departureDate: '2026-05-10',
        returnDate: '2026-05-12',
        budget: {
          flights: { budgeted: 100, actual: null },
          accommodation: { budgeted: 150, actual: null },
          onGround: { budgeted: 80, actual: null }
        },
        totalBudget: 330,
        notes: 'Short weekend away',
        itineraryUrl: '',
        destinationOptions: []
      },
      {
        id: 'trip-summer',
        destination: 'Summer Holiday',
        status: 'planned',
        departureDate: '2026-08-01',
        returnDate: '2026-08-14',
        budget: {
          flights: { budgeted: 300, actual: null },
          accommodation: { budgeted: 600, actual: null },
          onGround: { budgeted: 400, actual: null }
        },
        totalBudget: 1300,
        notes: 'Two-week summer break',
        itineraryUrl: '',
        destinationOptions: []
      }
    ]
  },

  // ── Settings (financial assumptions for forecasting) ───────────────
  settings: {
    name: 'Alex',
    currentAge: 30,
    retirementAge: 66,
    statePensionAge: 68,
    statePensionWeekly: 221.20,
    isaBalance: 5000,
    isaMonthlyContribution: 100,
    pensions: [
      { id: 'pension-1', name: 'Workplace Pension', balance: 8000, monthlyContribution: 200 },
    ],
    propertyValue: 0,
    mortgageBalance: 0,
    mortgageRate: 0,
    mortgageMonthlyPayment: 0,
    mortgageEndDate: '',
    mortgageRateAfterRemortgage: 0,
    bufferBalance: 2000,
    futureEvents: [],
    savingsRateTarget: 10,
    investmentGrowthRatePct: 5,
    propertyGrowthRatePct: 3,
    inflationPct: 2.5,
    goals: [
      { id: 'g-buffer', name: 'Emergency Buffer', target: 8000, current: 2000, monthly: 50, icon: '🛡️' },
      { id: 'g-holiday', name: 'Holiday Fund', target: 1500, current: 600, monthly: 100, icon: '✈️' },
      { id: 'g-laptop', name: 'New Laptop', target: 1000, current: 200, monthly: 20, icon: '💻' }
    ]
  },

  // ── Net worth snapshots (manual, monthly) ────────────────────────
  netWorth: {
    snapshots: [
      { date: '2026-04-01', isa: 5000, pension: 8000, propertyEquity: 0, buffer: 2000, other: 0, total: 15000 }
    ]
  }
}
