export type PricingWeights = {
  time: number;
  demand: number;
  inventory: number;
};

export type PricingRules = {
  time?: {
    withinSevenDaysAdjustment?: number;
    withinOneDayAdjustment?: number;
  };
  demand?: {
    recentBookingThreshold?: number;
    adjustment?: number;
  };
  inventory?: {
    lowInventoryThreshold?: number;
    adjustment?: number;
  };
};

export type PricingInput = {
  basePrice: number;
  floorPrice: number;
  ceilingPrice: number;
  eventDate: Date;
  totalTickets: number;
  bookedTickets: number;
  recentBookingsCount: number;
  now?: Date;
  weights?: Partial<PricingWeights>;
  rules?: PricingRules;
};

export type PriceAdjustment = {
  rule: "time" | "demand" | "inventory";
  label: string;
  rawAdjustment: number;
  weight: number;
  weightedAdjustment: number;
};

export type PriceBreakdown = {
  basePrice: number;
  floorPrice: number;
  ceilingPrice: number;
  finalPrice: number;
  unclampedPrice: number;
  totalWeightedAdjustment: number;
  adjustments: PriceAdjustment[];
};

type ResolvedPricingRules = {
  time: {
    withinSevenDaysAdjustment: number;
    withinOneDayAdjustment: number;
  };
  demand: {
    recentBookingThreshold: number;
    adjustment: number;
  };
  inventory: {
    lowInventoryThreshold: number;
    adjustment: number;
  };
};

const defaultRules: ResolvedPricingRules = {
  time: {
    withinSevenDaysAdjustment: 0.2,
    withinOneDayAdjustment: 0.5,
  },
  demand: {
    recentBookingThreshold: 10,
    adjustment: 0.15,
  },
  inventory: {
    lowInventoryThreshold: 0.2,
    adjustment: 0.25,
  },
};

const defaultWeights: PricingWeights = {
  time: 1,
  demand: 1,
  inventory: 1,
};

export function weightsFromEnv(env: NodeJS.ProcessEnv): PricingWeights {
  return {
    time: parseWeight(env.TIME_RULE_WEIGHT),
    demand: parseWeight(env.DEMAND_RULE_WEIGHT),
    inventory: parseWeight(env.INVENTORY_RULE_WEIGHT),
  };
}

export function calculateTimeAdjustment(
  eventDate: Date,
  now = new Date(),
  rules: PricingRules["time"] = defaultRules.time,
): { adjustment: number; label: string } {
  const millisecondsUntilEvent = eventDate.getTime() - now.getTime();
  const daysUntilEvent = millisecondsUntilEvent / (1000 * 60 * 60 * 24);

  if (daysUntilEvent <= 1) {
    return {
      adjustment:
        rules?.withinOneDayAdjustment ??
        defaultRules.time.withinOneDayAdjustment,
      label: "Event is within 1 day",
    };
  }

  if (daysUntilEvent <= 7) {
    return {
      adjustment:
        rules?.withinSevenDaysAdjustment ??
        defaultRules.time.withinSevenDaysAdjustment,
      label: "Event is within 7 days",
    };
  }

  return { adjustment: 0, label: "Event is 30+ days away" };
}

export function calculateDemandAdjustment(
  recentBookingsCount: number,
  rules: PricingRules["demand"] = defaultRules.demand,
): { adjustment: number; label: string } {
  const threshold =
    rules?.recentBookingThreshold ?? defaultRules.demand.recentBookingThreshold;

  if (recentBookingsCount > threshold) {
    return {
      adjustment: rules?.adjustment ?? defaultRules.demand.adjustment,
      label: `${recentBookingsCount} bookings in the last hour`,
    };
  }

  return { adjustment: 0, label: "Demand is steady" };
}

export function calculateInventoryAdjustment(
  totalTickets: number,
  bookedTickets: number,
  rules: PricingRules["inventory"] = defaultRules.inventory,
): { adjustment: number; label: string } {
  if (totalTickets <= 0) {
    return { adjustment: 0, label: "No inventory configured" };
  }

  const remainingRatio = Math.max(totalTickets - bookedTickets, 0) / totalTickets;
  const threshold =
    rules?.lowInventoryThreshold ??
    defaultRules.inventory.lowInventoryThreshold;

  if (remainingRatio < threshold) {
    return {
      adjustment: rules?.adjustment ?? defaultRules.inventory.adjustment,
      label: `${Math.round(remainingRatio * 100)}% tickets remaining`,
    };
  }

  return { adjustment: 0, label: "Inventory is healthy" };
}

export function calculatePrice(input: PricingInput): PriceBreakdown {
  const weights = { ...defaultWeights, ...input.weights };
  const rules = {
    time: { ...defaultRules.time, ...input.rules?.time },
    demand: { ...defaultRules.demand, ...input.rules?.demand },
    inventory: { ...defaultRules.inventory, ...input.rules?.inventory },
  };

  const time = calculateTimeAdjustment(input.eventDate, input.now, rules.time);
  const demand = calculateDemandAdjustment(
    input.recentBookingsCount,
    rules.demand,
  );
  const inventory = calculateInventoryAdjustment(
    input.totalTickets,
    input.bookedTickets,
    rules.inventory,
  );

  const adjustments: PriceAdjustment[] = [
    toPriceAdjustment("time", time.label, time.adjustment, weights.time),
    toPriceAdjustment("demand", demand.label, demand.adjustment, weights.demand),
    toPriceAdjustment(
      "inventory",
      inventory.label,
      inventory.adjustment,
      weights.inventory,
    ),
  ];

  const totalWeightedAdjustment = adjustments.reduce(
    (total, adjustment) => total + adjustment.weightedAdjustment,
    0,
  );
  const unclampedPrice = input.basePrice * (1 + totalWeightedAdjustment);
  const finalPrice = clamp(
    roundMoney(unclampedPrice),
    input.floorPrice,
    input.ceilingPrice,
  );

  return {
    basePrice: input.basePrice,
    floorPrice: input.floorPrice,
    ceilingPrice: input.ceilingPrice,
    finalPrice,
    unclampedPrice: roundMoney(unclampedPrice),
    totalWeightedAdjustment,
    adjustments,
  };
}

function toPriceAdjustment(
  rule: PriceAdjustment["rule"],
  label: string,
  rawAdjustment: number,
  weight: number,
): PriceAdjustment {
  return {
    rule,
    label,
    rawAdjustment,
    weight,
    weightedAdjustment: rawAdjustment * weight,
  };
}

function clamp(value: number, floor: number, ceiling: number): number {
  return Math.min(Math.max(value, floor), ceiling);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseWeight(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 1;
}
