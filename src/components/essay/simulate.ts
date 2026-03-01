export type SimParams = {
  devs: number;
  wip: number;
  debt: number;
  bugs: number;
  backlog: number;
};

export type SprintSnapshot = {
  sprint: number;
  wip: number;
  bugs: number;
  debt: number;
  backlog: number;
  velocity: number;
  shipped: number;
  totalShipped: number;
  bugGen: number;
  bugFixed: number;
  switchLoss: number;
  debtLoss: number;
};

/**
 * Run a forward simulation. Same math as the MDX sprintSim export,
 * but returns the full trajectory instead of a single scalar.
 */
export function simulate(
  params: SimParams,
  sprints = 20
): SprintSnapshot[] {
  const { devs } = params;
  let wip = params.wip;
  let debt = params.debt;
  let bugs = params.bugs;
  let backlog = params.backlog;
  let totalShipped = 0;

  const snapshots: SprintSnapshot[] = [];

  for (let sprint = 0; sprint < sprints; sprint++) {
    const baseVel = devs * 3;
    const perDev = wip / Math.max(1, devs);
    const switchLoss = Math.min(0.8, Math.max(0, (perDev - 2) * 0.2));
    const debtLoss = Math.min(0.9, debt * 0.05);
    const velocity = Math.max(0, baseVel * (1 - switchLoss) * (1 - debtLoss));

    const bugGen = wip * 0.05 * (1 + debt * 0.15);
    bugs = Math.max(0, bugs + bugGen);

    const bugFixed = Math.min(bugs, velocity * 0.4);
    const featureCapacity = velocity - bugFixed;
    const shipped = Math.min(wip, featureCapacity);

    bugs = Math.max(0, bugs - bugFixed);
    wip = Math.max(0, wip - shipped);
    totalShipped += shipped;

    const pull = Math.min(backlog, devs * 2);
    wip += pull;
    backlog = Math.max(0, backlog - pull);

    if (perDev > 3) debt = Math.min(18, debt + 0.5);

    snapshots.push({
      sprint,
      wip,
      bugs,
      debt,
      backlog,
      velocity,
      shipped,
      totalShipped,
      bugGen,
      bugFixed,
      switchLoss,
      debtLoss,
    });
  }

  return snapshots;
}
