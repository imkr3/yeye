/**
 * 전투 밸런스 시뮬레이터.
 *
 * 감으로 수치를 만지면 어긋난다. 순수 전투 엔진을 그대로 돌려서 적마다
 * 승률·소요 턴·남은 체력을 뽑고, 그 숫자를 보고 고친다.
 *
 * 실행: npm run balance
 */
import { createCombat, takeTurn, forecastEnemyActions, canUseLastDitch, type CombatState, type PlayerAction } from "../src/systems/CombatSystem";
import { RIFT_ENEMIES, type EnemyDef } from "../src/data/rifts/enemies";
import { createRng } from "../src/systems/Rng";
import { NEUTRAL_MODIFIERS } from "../src/systems/EffectRegistry";
import { PLAYER_BASE } from "../src/data/combat/balance";

type Policy = (c: CombatState) => PlayerAction;

/** 처음 만난 사람 — 계속 때리기만 한다. 하한선 측정용. */
const naive: Policy = () => ({ id: "basic-strike" });

/**
 * 기본을 아는 사람 — 강공격에만 막는다.
 * 폭발(detonate)에는 방어가 거의 듣지 않고(설계상 의도), 방어 무시(guardbreak)에는
 * 아예 소용이 없다. 거기에 막는 것은 나쁜 밸런스가 아니라 나쁜 플레이라서,
 * 측정 정책에서 빼야 게임 수치를 제대로 잰다.
 */
const guarded: Policy = (c) => {
  const next = forecastEnemyActions(c, 1)[0];
  if (next && next.kind === "strong") return { id: "guard" };
  return { id: "basic-strike" };
};

/** 익숙한 사람 — 연공까지 쓴다. 상한선 측정용. */
const skilled: Policy = (c) => {
  const next = forecastEnemyActions(c, 1)[0];
  if (canUseLastDitch(c) && c.enemy.hp <= c.enemy.def.maxHp * 0.25) return { id: "last-ditch" };
  if (next && next.kind === "strong") return { id: "guard" };
  if (c.enemy.weakenTurns === 0 && c.turn % 5 === 0) return { id: "read-flow" };
  if (c.enemy.bleedTurns === 0 && c.player.stain < 45) return { id: "vein-open" };
  if (c.player.stain < 70) return { id: "chain-strike" };
  return { id: "basic-strike" };
};

/**
 * 패턴을 외운 사람 — 기억 힌트가 알려주는 대로 표식 뒤의 폭발까지 막는다.
 * "조심스럽게 두는 것"이 정말 손해인지, 아니면 내 기준 정책이 나빴던 것인지 가른다.
 */
const patternAware: Policy = (c) => {
  const next = forecastEnemyActions(c, 1)[0];
  if (!next) return { id: "basic-strike" };
  if (next.kind === "strong") return { id: "guard" };
  if (next.kind === "detonate" && c.enemy.markedPlayer) return { id: "guard" };
  return { id: "basic-strike" };
};

const POLICIES: [string, Policy][] = [
  ["패턴", patternAware],
  ["초보", naive],
  ["보통", guarded],
  ["숙련", skilled],
];

const RUNS = 400;
const TURN_CAP = 60;

interface Result {
  wins: number;
  turns: number[];
  hpLeft: number[];
  stain: number[];
  timeouts: number;
}

function simulate(enemy: EnemyDef, policy: Policy, memoryTier: number, allies: string[]): Result {
  const res: Result = { wins: 0, turns: [], hpLeft: [], stain: [], timeouts: 0 };
  for (let i = 0; i < RUNS; i++) {
    const rng = createRng(`sim:${enemy.id}:${i}`);
    let c = createCombat({
      enemy,
      memoryTier,
      playerMaxHp: PLAYER_BASE.maxHp,
      modifiers: NEUTRAL_MODIFIERS,
      allies,
    });
    let guardCount = 0;
    while (!c.over && c.turn < TURN_CAP) {
      const action = policy(c);
      // 연속 방어 페널티를 감안해, 정책이 방어만 반복하지 않도록 살짝 제어한다.
      if (action.id === "guard") {
        guardCount++;
        if (guardCount > 2) c = takeTurn(c, { id: "basic-strike" }, rng);
        else c = takeTurn(c, action, rng);
      } else {
        guardCount = 0;
        c = takeTurn(c, action, rng);
      }
    }
    if (c.over && c.result === "win") {
      res.wins++;
      res.turns.push(c.turn);
      res.hpLeft.push(c.player.hp);
      res.stain.push(c.player.stain);
    } else if (!c.over) {
      res.timeouts++;
    }
  }
  return res;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (n: number) => `${((n / RUNS) * 100).toFixed(0)}%`;

/** 왜 지는지 보려면 수치가 필요하다 — 서로 몇 턴 만에 죽이는지. */
function diagnose(enemy: EnemyDef, policy: Policy, memoryTier: number) {
  let dealtTotal = 0;
  let takenTotal = 0;
  let survived = 0;
  const N = 200;
  for (let i = 0; i < N; i++) {
    const rng = createRng(`diag:${enemy.id}:${i}`);
    let c = createCombat({ enemy, memoryTier, playerMaxHp: PLAYER_BASE.maxHp, modifiers: NEUTRAL_MODIFIERS });
    let guardCount = 0;
    while (!c.over && c.turn < TURN_CAP) {
      const a = policy(c);
      if (a.id === "guard") { guardCount++; c = takeTurn(c, guardCount > 2 ? { id: "basic-strike" } : a, rng); }
      else { guardCount = 0; c = takeTurn(c, a, rng); }
    }
    dealtTotal += c.record.damageDealt;
    takenTotal += c.record.damageTaken;
    survived += c.turn;
  }
  const turns = survived / N;
  return {
    playerDps: dealtTotal / survived,
    enemyDps: takenTotal / survived,
    turnsToKill: enemy.maxHp / (dealtTotal / survived),
    turnsToDie: PLAYER_BASE.maxHp / (takenTotal / survived),
    turns,
  };
}

const order = ["glass-mite", "threshold-biter", "sutured-pilgrim", "twice-turning-needle", "backflow-hound", "salt-weeper", "stain-midwife", "anchorage-drowned", "stairwell-wreckage", "pulse-counter", "miscount"];

const args = process.argv.slice(2);
if (args.includes("--diag")) {
  console.log(`\n진단 (플레이어 체력 ${PLAYER_BASE.maxHp}, 기억 2, '숙련' 정책)\n`);
  console.log("적".padEnd(22) + "내 초당피해  적 초당피해  죽이는데   죽는데   여유");
  console.log("-".repeat(74));
  for (const id of order) {
    const e = RIFT_ENEMIES[id];
    if (!e) continue;
    const d = diagnose(e, skilled, 2);
    const margin = d.turnsToDie / d.turnsToKill;
    console.log(
      `${e.name}(${e.maxHp})`.padEnd(22) +
        `${d.playerDps.toFixed(1)}`.padEnd(13) +
        `${d.enemyDps.toFixed(1)}`.padEnd(13) +
        `${d.turnsToKill.toFixed(1)}턴`.padEnd(11) +
        `${d.turnsToDie.toFixed(1)}턴`.padEnd(9) +
        `${margin.toFixed(2)}x`
    );
  }
  console.log("\n여유 1.0 미만 = 이길 수 없음\n");
  process.exit(0);
}
const withAllies = args.includes("--allies");
const allies = withAllies ? ["isra", "riv"] : [];

console.log(
  `\n전투 밸런스 (${RUNS}회/조합, 기억 단계 2${withAllies ? ", 동료 이스라+리브" : ", 동료 없음"})\n`
);
console.log("적".padEnd(22) + POLICIES.map(([n]) => `${n} 승률/턴/남은체력`.padEnd(24)).join(""));
console.log("-".repeat(22 + 24 * POLICIES.length));

for (const id of order) {
  const enemy = RIFT_ENEMIES[id];
  if (!enemy) continue;
  let row = `${enemy.name}(${enemy.maxHp})`.padEnd(22);
  for (const [, policy] of POLICIES) {
    const r = simulate(enemy, policy, 2, allies);
    const cell = `${pct(r.wins)} / ${avg(r.turns).toFixed(1)}t / ${avg(r.hpLeft).toFixed(0)}hp`;
    row += cell.padEnd(24);
  }
  console.log(row);
}
console.log("");
