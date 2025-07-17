
export const getTierLimits = (tier) => {
  switch (tier) {
    case 'TIER_1':
      return { dailyLimit: 50000, maxBalance: 300000 };
    case 'TIER_2':
      return { dailyLimit: 200000, maxBalance: 500000 };
    case 'TIER_3':
      return { dailyLimit: 5000000, maxBalance: Infinity };
    default:
      return { dailyLimit: 0, maxBalance: 0 };
  }
};
