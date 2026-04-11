// Blank starting budget for new users — same structure, no personal data
export const emptyBudget = {
  income: { items: [] },
  sections: [
    { id: 'starling', name: '⭐ Starling Spaces', color: '#2E75B6', bgLight: '#DBEAFE', groups: [] },
    { id: 'current',  name: '💳 Current Account', color: '#C55A11', bgLight: '#FEF3C7', groups: [] },
    { id: 'monzo',    name: '💜 Monzo Spaces',    color: '#7030A0', bgLight: '#F3E8FF', groups: [] },
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
  // ── Existing budget structure ─────────────────────────────────────
  income: {
    items: [
      { id: 'inc-1', name: 'Net Monthly Salary', monthly: 3747.30, notes: 'Take-home after tax, NI & pension' }
    ]
  },
  sections: [
    {
      id: 'starling', name: '⭐ Starling Spaces', color: '#2E75B6', bgLight: '#DBEAFE',
      groups: [
        { id: 'space-1', name: 'Space 1: Bills', items: [
          { id: 's1-1', name: 'House Energy', monthly: 120, notes: 'Electricity & gas inc. EV home charging' },
          { id: 's1-2', name: 'Mobile Phone', monthly: 10, notes: '' },
          { id: 's1-3', name: 'TV License', monthly: 15, notes: '' },
          { id: 's1-4', name: 'Thames Water', monthly: 38, notes: '⚠️ Rising to £66 from April' },
          { id: 's1-5', name: 'Broadband', monthly: 33, notes: '' },
          { id: 's1-6', name: 'Council Tax', monthly: 191, notes: '25% single person discount. ~£195-200 from April.' }
        ]},
        { id: 'space-2', name: 'Space 2: Mortgage', items: [
          { id: 's2-1', name: 'Mortgage Payment', monthly: 1119.62, notes: 'Halifax 3.59% fixed until Jan 2028. Balance £243,131.' }
        ]},
        { id: 'space-3', name: 'Space 3: Public Charging', items: [
          { id: 's3-1', name: 'Public EV Charging', monthly: 50, notes: '' }
        ]},
        { id: 'space-4', name: 'Space 4: Gifts', items: [
          { id: 's4-1', name: 'Gifts', monthly: 20, notes: 'Birthday & Christmas gifts' }
        ]},
        { id: 'space-5', name: 'Space 5: 40th Stroudies', items: [
          { id: 's5-1', name: '40th Stroudies Fund', monthly: 11, notes: '£2.50/week × 4.33' }
        ]},
        { id: 'space-6', name: 'Space 6: Groceries', items: [
          { id: 's6-1', name: 'Groceries', monthly: 350, notes: 'Food & household items' }
        ]},
        { id: 'space-7', name: 'Space 7: Counselling', items: [
          { id: 's7-1', name: 'Counselling / Therapy', monthly: 120, notes: 'Essential mental health support' }
        ]},
        { id: 'space-8', name: 'Space 8: Gym', items: [
          { id: 's8-1', name: 'Gym Membership', monthly: 67, notes: '' }
        ]},
        { id: 'space-9', name: 'Space 9: Work Travel', items: [
          { id: 's9-1', name: 'Work Travel (Train)', monthly: 142.89, notes: '£16.50 return × 2 days/week × 4.33' }
        ]},
        { id: 'space-10', name: 'Space 10: Cleaner', items: [
          { id: 's10-1', name: 'Cleaner', monthly: 37, notes: '' }
        ]},
        { id: 'space-11', name: 'Space 11: Van Conversion', items: [
          { id: 's11-1', name: 'Van Conversion Materials', monthly: 150, notes: 'Ends ~August 2026' }
        ]},
        { id: 'space-12', name: 'Space 12: 🐱 Cat (Lucy)', items: [
          { id: 's12-1', name: 'Cat Insurance', monthly: 10, notes: '£118.15/year' },
          { id: 's12-2', name: 'Cat Food (Dry)', monthly: 30, notes: '' },
          { id: 's12-3', name: 'Cat Litter', monthly: 22, notes: '' },
          { id: 's12-4', name: 'Vet Buffer', monthly: 15, notes: 'Annual booster + excess fund' }
        ]}
      ]
    },
    {
      id: 'current', name: '💳 Current Account', color: '#C55A11', bgLight: '#FEF3C7',
      groups: [
        { id: 'ca-1', name: 'Discretionary', items: [
          { id: 'ca-1-1', name: 'Socialising & Personal Spend', monthly: 500, notes: 'Coffee, lunch, drinks, bits for yourself' }
        ]},
        { id: 'ca-2', name: 'Subscriptions', items: [
          { id: 'ca-2-1', name: 'iCloud', monthly: 1, notes: '' },
          { id: 'ca-2-2', name: 'Amazon Prime', monthly: 8.99, notes: '' },
          { id: 'ca-2-3', name: 'Spotify', monthly: 12.99, notes: '' }
        ]}
      ]
    },
    {
      id: 'monzo', name: '💜 Monzo Spaces', color: '#7030A0', bgLight: '#F3E8FF',
      groups: [
        { id: 'monzo-van', name: '🚐 Van Expenses', savingsType: 'annual', isSavings: true, items: [
          { id: 'm-v1', name: 'Van Insurance', monthly: 40.58, notes: '' },
          { id: 'm-v2', name: 'Van Residents Insurance', monthly: 10.42, notes: '' },
          { id: 'm-v3', name: 'Van Service & Tyres', monthly: 25, notes: '' },
          { id: 'm-v4', name: 'Van Road Tax', monthly: 29, notes: '' },
          { id: 'm-v5', name: 'Van MOT', monthly: 5, notes: '£60/year' }
        ]},
        { id: 'monzo-prop', name: '🏠 Property Expenses', savingsType: 'annual', isSavings: true, items: [
          { id: 'm-p1', name: 'Service Charge', monthly: 100, notes: 'Meudon Court' },
          { id: 'm-p2', name: 'Building Insurance', monthly: 73, notes: '' },
          { id: 'm-p3', name: 'Contents Insurance', monthly: 11, notes: '' },
          { id: 'm-p4', name: 'General Flat Costs', monthly: 40, notes: '' }
        ]},
        { id: 'monzo-inst', name: '🎻 Instrument Insurance', savingsType: 'annual', isSavings: true, items: [
          { id: 'm-i1', name: 'Viola Insurance', monthly: 10, notes: '' }
        ]},
        { id: 'monzo-goals', name: '🎯 Savings & Goals', savingsType: 'longterm', isSavings: true, items: [
          { id: 'm-g1', name: 'Holidays', monthly: 100, notes: 'Auto-linked to Holiday Planner' },
          { id: 'm-g2', name: 'Emergency Fund Top-Up', monthly: 40, notes: 'Buffer at £6,615' },
          { id: 'm-g3', name: 'Clothing', monthly: 40, notes: '' },
          { id: 'm-g4', name: 'Headphones', monthly: 10, notes: '' },
          { id: 'm-g5', name: 'Phone', monthly: 30, notes: '' },
          { id: 'm-g6', name: 'Mole Screening', monthly: 30, notes: '' },
          { id: 'm-g7', name: 'Macbook', monthly: 20, notes: 'Laptop replacement fund' }
        ]}
      ]
    }
  ],

  // ── Holidays ──────────────────────────────────────────────────────
  holidays: {
    trips: [
      {
        id: 'trip-agadir',
        destination: 'Agadir, Morocco 🇲🇦',
        status: 'booked',
        departureDate: '2026-02-05',
        returnDate: '2026-02-08',
        budget: {
          flights: { budgeted: 174, actual: 174 },
          accommodation: { budgeted: 106, actual: 106 },
          onGround: { budgeted: 60, actual: null }
        },
        totalBudget: 340,
        notes: 'With Olek. Car hire £18 booked. Breakfast-only hotel.',
        itineraryUrl: '',
        destinationOptions: []
      },
      {
        id: 'trip-vietnam',
        destination: 'Vietnam 🇻🇳',
        status: 'planned',
        departureDate: '2026-10-01',
        returnDate: '2026-10-16',
        budget: {
          flights: { budgeted: 500, actual: null },
          accommodation: { budgeted: 200, actual: null },
          onGround: { budgeted: 200, actual: null }
        },
        totalBudget: 900,
        notes: 'Solo. Book flights April (6 months out for best price). Hoi An, Halong Bay, rice terraces. Post-monsoon timing perfect.',
        itineraryUrl: '',
        destinationOptions: []
      }
    ]
  },

  // ── Settings (financial assumptions for forecasting) ───────────────
  settings: {
    name: 'Tim',
    currentAge: 38,
    retirementAge: 66,
    statePensionAge: 68,
    statePensionWeekly: 230.25,
    // Balances (update monthly)
    isaBalance: 86193,
    isaMonthlyContribution: 100,
    pensions: [
      { id: 'pension-1', name: 'Workplace Pension', balance: 10460, monthlyContribution: 537 },
    ],
    propertyValue: 455000,
    mortgageBalance: 243131,
    mortgageRate: 3.59,
    mortgageMonthlyPayment: 1119.62,
    mortgageEndDate: '2027-12-31',
    mortgageRateAfterRemortgage: 4.5,
    bufferBalance: 6615,
    // Known future events
    futureEvents: [
      { id: 'evt-van', label: 'Van conversion ends', date: '2026-08-01', monthlyImpact: 150, icon: '🚐' },
      { id: 'evt-payrise', label: 'Pay rise', date: '2026-08-01', monthlyImpact: 300, icon: '💰' },
    ],
    // Assumptions
    savingsRateTarget: 10,
    investmentGrowthRatePct: 5,
    propertyGrowthRatePct: 3,
    inflationPct: 2.5,
    // Goals (current balances for progress rings)
    goals: [
      { id: 'g-buffer', name: 'Emergency Buffer', target: 10000, current: 6615, monthly: 40, icon: '🛡️' },
      { id: 'g-phone', name: 'Phone', target: 800, current: 453, monthly: 30, icon: '📱' },
      { id: 'g-mole', name: 'Mole Screening', target: 350, current: 293, monthly: 30, icon: '🏥' },
      { id: 'g-headphones', name: 'Headphones', target: 300, current: 181, monthly: 10, icon: '🎧' },
      { id: 'g-macbook', name: 'Macbook', target: 1200, current: 63, monthly: 20, icon: '💻' },
      { id: 'g-stroudies', name: '40th Stroudies', target: 500, current: 425, monthly: 11, icon: '🎉' }
    ]
  },

  // ── Net worth snapshots (manual, monthly) ────────────────────────
  netWorth: {
    snapshots: [
      { date: '2026-02-01', isa: 86193, pension: 10460, propertyEquity: 211869, buffer: 6615, other: 3627, total: 318764 }
    ]
  }
}
