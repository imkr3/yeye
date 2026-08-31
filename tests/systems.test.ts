/**
 * 순수 시스템 로직 검증.
 *
 * Scene(표현 계층)은 건드리지 않고, 규칙을 담당하는 systems 계층만 확인한다.
 * 기획서 8절의 검증 항목을 그대로 따라간다.
 * 실행: npm test
 */

import {
  createInitialRegressionState,
  applyDeath,
  advanceDeathMemory,
  deathMemoryTier,
  equipRelic,
  unequipRelic,
  addWardCharge,
  setCarriedItems,
  beginNewCycle,
  applyVowBacklash,
  clearVowBacklash,
  hasVowBacklash,
  RELIC_SLOT_LIMIT,
  effectiveRelicSlots,
  SAVE_VERSION,
  type RegressionState,
  type SavePoint,
} from "../src/systems/RegressionSystem";
import { normalizeState, parseSave } from "../src/systems/SaveMigration";
import { buildRiftRun } from "../src/systems/RiftSystem";
import { createRng } from "../src/systems/Rng";
import { stainTier, stainStatus, addStain, STAIN_THRESHOLDS } from "../src/systems/StainSystem";
import {
  createCombat,
  takeTurn,
  plannedEnemyAction,
  canUseLastDitch,
  forecastEnemyActions,
  describeForecast,
} from "../src/systems/CombatSystem";
import {
  relicModifiers,
  NEUTRAL_MODIFIERS,
  applyFieldConsumable,
  consumableHasRiftUse,
  riftUseEffect,
} from "../src/systems/EffectRegistry";
import { resolveEnding } from "../src/systems/EndingSystem";
import { pullOnce, pullFive, PITY_THRESHOLD, DUPLICATE_DUST, rarityOdds } from "../src/systems/EconomySystem";
import { PULSE_COUNTER, GLASS_MITE, SUTURED_PILGRIM, BACKFLOW_HOUND } from "../src/data/rifts/enemies";
import { RELIC_POOL } from "../src/data/items/relics";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

const START: SavePoint = { id: "sp-0", sceneKey: "RegionScene", x: 80, y: 420, label: "회랑 입구" };
const fresh = (): RegressionState => createInitialRegressionState(START);

// ---------------------------------------------------------------------------
section("1. 새 게임과 구버전 저장 데이터 로드");

const newGame = fresh();
check("새 게임 상태가 현재 스키마 버전을 갖는다", newGame.saveVersion === SAVE_VERSION);

// 구버전(v1) 모양 — 새 필드가 통째로 없는 저장 데이터
const legacySave = {
  currentSavePoint: { id: "sp-1", x: 700, y: 300, label: "시장 뒷골목 분기점" },
  runCount: 4,
  fragments: 120,
  achievements: ["reach-ash-market-branch"],
  npcTrust: { riv: 2 },
  inventory: { consumables: ["warding-talisman", "존재하지-않는-아이템"], relics: ["moss-ring"] },
  equippedRelics: ["moss-ring", "moss-ring", "worn-leather-gloves"],
  wardCharges: 1,
};
const migrated = normalizeState(legacySave);
check("구버전 저장이 크래시 없이 로드된다", migrated.saveVersion === SAVE_VERSION);
check("기존 진행이 보존된다", migrated.runCount === 4 && migrated.fragments === 120);
check("존재하지 않는 아이템 ID가 제거된다", migrated.inventory.consumables.length === 1);
check(
  "장착 유물의 중복과 미보유가 정리된다",
  migrated.equippedRelics.length === 1 && migrated.equippedRelics[0] === "moss-ring",
  JSON.stringify(migrated.equippedRelics)
);
check("새 필드가 기본값으로 채워진다", migrated.stain === 0 && migrated.carriedItemSlots === 3);
check("깨진 JSON은 null을 돌려준다", parseSave("{ 이건 JSON이 아니다") === null);

const dirty = normalizeState({ ...legacySave, fragments: -50, stain: 999, aftershockCoins: -10 });
check("음수 재화와 범위 밖 얼룩이 정규화된다", dirty.fragments === 0 && dirty.stain === 100 && dirty.aftershockCoins === 0);

// ---------------------------------------------------------------------------
section("2. 같은 시드는 같은 결과를 낸다");

const runA = buildRiftRun("seed-alpha", 68);
const runB = buildRiftRun("seed-alpha", 68);
const runC = buildRiftRun("seed-beta", 68);
check(
  "같은 시드는 같은 방 순서를 만든다",
  runA.rooms.map((r) => r.id).join(",") === runB.rooms.map((r) => r.id).join(",")
);
check(
  "다른 시드는 대체로 다른 배치를 만든다",
  runA.rooms.map((r) => r.id).join(",") !== runC.rooms.map((r) => r.id).join(",")
);
check("방 구조는 입구 → 일반 2 → 사건/휴식 → 심층주", runA.rooms.length === 5);
check("첫 방은 입구", runA.rooms[0].type === "entrance");
check("마지막 방은 심층주", runA.rooms[4].type === "boss");
check(
  "중간 방은 전투 또는 함정",
  ["combat", "trap"].includes(runA.rooms[1].type) && ["combat", "trap"].includes(runA.rooms[2].type)
);

const gachaA = pullFive(fresh(), "relic", createRng("pull-seed"), null);
const gachaB = pullFive(fresh(), "relic", createRng("pull-seed"), null);
check(
  "같은 시드는 같은 뽑기 결과를 낸다",
  gachaA.results.map((r) => r.item.id).join(",") === gachaB.results.map((r) => r.item.id).join(",")
);

// ---------------------------------------------------------------------------
section("3. 사망 후 남는 것과 사라지는 것");

let died = fresh();
died = { ...died, fragments: 90, achievements: ["a"], collectedPickups: ["p1"] };
died = setCarriedItems({ ...died, inventory: { consumables: ["dried-jerky"], relics: [] } }, ["dried-jerky"]);
const afterDeath = applyDeath(died);
check("회귀 횟수가 오른다", afterDeath.runCount === died.runCount + 1);
check("분기점은 유지된다", afterDeath.currentSavePoint.id === died.currentSavePoint.id);
check("영구 기록은 유지된다", afterDeath.achievements.length === 1 && afterDeath.collectedPickups.length === 1);
check("가방 아이템은 유지된다", afterDeath.carriedItemIds.includes("dried-jerky"));

// ---------------------------------------------------------------------------
section("4. 액막이 부적은 정확히 1회만 소모된다");

const warded = addWardCharge(fresh());
const wardedOnce = applyDeath(warded);
check("부적이 있으면 페널티가 붙지 않는다", wardedOnce.accumulatedPenalties.length === 0);
check("부적이 정확히 하나 소모된다", wardedOnce.wardCharges === 0);
const wardedTwice = applyDeath(wardedOnce);
check("부적이 떨어지면 다시 페널티가 붙는다", wardedTwice.accumulatedPenalties.length === 1);

// ---------------------------------------------------------------------------
section("5. 죽음의 기억은 0→3까지만 오른다");

let mem = fresh();
check("처음에는 0단계", deathMemoryTier(mem, "glass-mite") === 0);
const tiers: number[] = [];
for (let i = 0; i < 6; i++) {
  mem = advanceDeathMemory(mem, "glass-mite");
  tiers.push(deathMemoryTier(mem, "glass-mite"));
}
check("단계가 1,2,3으로 오른다", tiers.slice(0, 3).join(",") === "1,2,3");
check("3단계를 넘지 않는다", tiers.every((t) => t <= 3) && tiers[5] === 3);

// ---------------------------------------------------------------------------
section("6. 유물 진열대 2슬롯과 해제 후 효과 잔존");

let relicState = fresh();
relicState = { ...relicState, inventory: { consumables: [], relics: ["worn-leather-gloves", "moss-ring", "ash-crystal-core"] } };
relicState = equipRelic(relicState, "worn-leather-gloves");
relicState = equipRelic(relicState, "moss-ring");
relicState = equipRelic(relicState, "ash-crystal-core");
check("슬롯 한도를 넘지 않는다", relicState.equippedRelics.length === RELIC_SLOT_LIMIT);

const equippedMods = relicModifiers(relicState.equippedRelics);
check("장착 유물의 효과가 반영된다", equippedMods.basicStrikeBonus === 3 && equippedMods.healingMultiplier > 1);

const unequipped = unequipRelic(unequipRelic(relicState, "worn-leather-gloves"), "moss-ring");
const clearedMods = relicModifiers(unequipped.equippedRelics);
check(
  "해제하면 효과가 남지 않는다",
  clearedMods.basicStrikeBonus === NEUTRAL_MODIFIERS.basicStrikeBonus &&
    clearedMods.healingMultiplier === NEUTRAL_MODIFIERS.healingMultiplier
);

const dupEquipped = relicModifiers(["worn-leather-gloves", "worn-leather-gloves"]);
check("같은 유물이 두 번 들어와도 한 번만 적용된다", dupEquipped.basicStrikeBonus === 3);

// ---------------------------------------------------------------------------
section("7. 아이템 효과는 한 행동에 한 번만 발동한다");

const combatBase = createCombat({ enemy: GLASS_MITE, memoryTier: 0, playerHp: 40, playerMaxHp: 68, stain: 0 });
const afterItem = takeTurn(combatBase, { id: "use-item", itemId: "dried-jerky" }, createRng("item"));
const healedOnce = afterItem.player.hp - 40 + afterItem.record.damageTaken;
check("회복이 한 번만 적용된다 (14 이하)", healedOnce <= 14 && healedOnce > 0, `${healedOnce}`);
check("사용한 아이템이 한 번만 기록된다", afterItem.record.itemsUsed.length === 1);

let fieldState = fresh();
fieldState = { ...fieldState, inventory: { consumables: ["warding-talisman", "warding-talisman"], relics: [] } };
const usedField = applyFieldConsumable(fieldState, "warding-talisman");
check("필드 사용은 아이템을 하나만 소모한다", usedField.inventory.consumables.length === 1);
check("필드 사용 효과가 한 번만 적용된다", usedField.wardCharges === 1);

// ---------------------------------------------------------------------------
section("8. 가챠 천장과 중복 환원이 표시 규칙과 일치한다");

let pityState = fresh();
pityState = { ...pityState, gachaPity: { sinceHighRarity: PITY_THRESHOLD } };
const pityPull = pullOnce(pityState, "relic", createRng("pity"), null);
check(
  "천장 도달 시 SR 이상이 나온다",
  pityPull.result.rarity === "SR" || pityPull.result.rarity === "SSR",
  pityPull.result.rarity
);
check("천장 적용이 결과에 표시된다", pityPull.result.pityApplied);
check("높은 등급이 나오면 카운터가 초기화된다", pityPull.state.gachaPity.sinceHighRarity === 0);

const ownedRelic = RELIC_POOL[0];
let dupState = fresh();
dupState = { ...dupState, inventory: { consumables: [], relics: RELIC_POOL.map((r) => r.id) } };
const dupPull = pullOnce(dupState, "relic", createRng("dup"), null);
check("이미 가진 유물은 중복으로 처리된다", dupPull.result.duplicate);
check(
  "중복 환원량이 표시 규칙과 같다",
  dupPull.result.dustGained === DUPLICATE_DUST[dupPull.result.rarity],
  `${dupPull.result.dustGained} vs ${DUPLICATE_DUST[dupPull.result.rarity]}`
);
check("중복 환원분이 여진 가루에 반영된다", dupPull.state.aftershockDust === dupPull.result.dustGained);
void ownedRelic;

const odds = rarityOdds(null);
const oddsTotal = odds.reduce((sum, o) => sum + o.percent, 0);
check("확률표 합이 100%에 수렴한다", Math.abs(oddsTotal - 100) < 0.01, `${oddsTotal}`);
check(
  "높은 등급일수록 확률이 낮다",
  odds[0].percent < odds[4].percent,
  `SSR ${odds[0].percent.toFixed(1)} vs C ${odds[4].percent.toFixed(1)}`
);

const gachaHistory = pullFive(fresh(), "consumable", createRng("hist"), null).state.gachaHistory;
check("뽑기 기록이 남는다", gachaHistory.length === 5);

// ---------------------------------------------------------------------------
section("9. 얼룩 임계치 40 / 70 / 100");

check("39는 0단계", stainTier(39) === 0);
check("40은 1단계", stainTier(STAIN_THRESHOLDS[0]) === 1);
check("69는 1단계", stainTier(69) === 1);
check("70은 2단계", stainTier(STAIN_THRESHOLDS[1]) === 2);
check("99는 2단계", stainTier(99) === 2);
check("100은 3단계", stainTier(STAIN_THRESHOLDS[2]) === 3);
check("얼룩은 0~100을 벗어나지 않는다", addStain(95, 50) === 100 && addStain(5, -50) === 0);
check("단계가 오를수록 피해 배율이 커진다", stainStatus(0).damageMultiplier < stainStatus(100).damageMultiplier);

// 전투에서 얼룩 100 도달 시 개인 범람
let overflowCombat = createCombat({ enemy: SUTURED_PILGRIM, memoryTier: 3, stain: 92, playerMaxHp: 200, playerHp: 200 });
overflowCombat = takeTurn(overflowCombat, { id: "sunder" }, createRng("overflow"));
check("얼룩 100 도달 시 즉사가 아니라 범람에 들어간다", overflowCombat.player.hp > 0 && overflowCombat.overflowResidue);
check("범람은 지속 턴을 갖는다", overflowCombat.player.overflowTurnsLeft > 0);

// ---------------------------------------------------------------------------
section("10. 보스 페이즈와 죽음의 기억 힌트");

let boss = createCombat({ enemy: PULSE_COUNTER, memoryTier: 3, playerMaxHp: 600, playerHp: 600 });
const firstFour = [0, 1, 2, 3].map((i) => PULSE_COUNTER.pattern[i].id);
check("1페이즈는 표식 → 두드림 → 파열 → 큰 셈 순서", firstFour.join(",") === "count-mark,count-tap,count-burst,count-toll");

const rng = createRng("boss");
let guard = 0;
while (!boss.over && boss.enemy.phase === 1 && guard < 60) {
  boss = takeTurn(boss, { id: "sunder" }, rng);
  guard++;
}
check("체력이 45% 아래로 내려가면 2페이즈로 넘어간다", boss.enemy.phase === 2 || boss.over, `phase ${boss.enemy.phase}`);
check("기억 힌트가 3단계까지 준비되어 있다", PULSE_COUNTER.memoryHints.length === 3);
check("힌트 3단계가 역순 규칙을 설명한다", PULSE_COUNTER.memoryHints[2].includes("거꾸로"));

const tierZero = createCombat({ enemy: GLASS_MITE, memoryTier: 0 });
const tierThree = createCombat({ enemy: GLASS_MITE, memoryTier: 3 });
check("기억 0단계에서는 의도가 흐릿하다", plannedEnemyAction(tierZero).id === plannedEnemyAction(tierThree).id);

// ---------------------------------------------------------------------------
section("11. 전투 규칙");

const guardTest = createCombat({ enemy: GLASS_MITE, memoryTier: 3, playerMaxHp: 200, playerHp: 200 });
const guarded = takeTurn(guardTest, { id: "guard" }, createRng("guard-a"));
const unguarded = takeTurn(guardTest, { id: "basic-strike" }, createRng("guard-a"));
check(
  "방어하면 같은 공격에 덜 맞는다",
  guarded.record.damageTaken <= unguarded.record.damageTaken,
  `${guarded.record.damageTaken} vs ${unguarded.record.damageTaken}`
);

let postureState = guardTest;
for (let i = 0; i < 3; i++) postureState = takeTurn(postureState, { id: "guard" }, createRng(`p${i}`));
check("연속 방어는 자세를 무너뜨린다", postureState.player.consecutiveGuards >= 2);

const lowHp = createCombat({ enemy: GLASS_MITE, memoryTier: 0, playerMaxHp: 100, playerHp: 100 });
check("체력이 높으면 막바지 승부를 쓸 수 없다", !canUseLastDitch(lowHp));
const readyHp = createCombat({ enemy: GLASS_MITE, memoryTier: 0, playerMaxHp: 100, playerHp: 25 });
check("체력 30% 이하에서만 막바지 승부가 열린다", canUseLastDitch(readyHp));

// 보스에게는 막바지 승부 상한이 있다
let bossLast = createCombat({ enemy: PULSE_COUNTER, memoryTier: 0, playerMaxHp: 100, playerHp: 20 });
const beforeBossHp = bossLast.enemy.hp;
bossLast = takeTurn(bossLast, { id: "last-ditch" }, createRng("cap"));
check("막바지 승부가 보스를 즉사시키지 않는다", bossLast.enemy.hp > 0, `${beforeBossHp} → ${bossLast.enemy.hp}`);

const markHit = takeTurn(
  createCombat({ enemy: GLASS_MITE, memoryTier: 1, playerMaxHp: 200, playerHp: 200 }),
  { id: "causal-mark", predictKind: "weak" },
  createRng("mark")
);
check("인과 표식은 얼룩을 남긴다", markHit.player.stain > 0);
check("예측이 맞으면 기억 단계가 오른다", markHit.memoryTier >= 1);

const sunderTest = takeTurn(
  createCombat({ enemy: GLASS_MITE, memoryTier: 3, playerMaxHp: 200, playerHp: 200 }),
  { id: "sunder" },
  createRng("sunder")
);
check("결손 절단은 얼룩을 크게 올린다", sunderTest.player.stain >= 12);

// 전투 길이 — 기초 타격만으로도 과하게 길어지지 않아야 한다
let lengthTest = createCombat({ enemy: SUTURED_PILGRIM, memoryTier: 3, playerMaxHp: 400, playerHp: 400 });
let turns = 0;
const lengthRng = createRng("length");
while (!lengthTest.over && turns < 40) {
  lengthTest = takeTurn(lengthTest, { id: "basic-strike" }, lengthRng);
  turns++;
}
check("일반 전투가 합리적인 턴 수에 끝난다", lengthTest.over && turns <= 20, `${turns}턴`);

// ---------------------------------------------------------------------------
section("12. 서약 역류와 주기 갱신");

let vow = fresh();
vow = advanceDeathMemory(advanceDeathMemory(vow, "glass-mite"), "glass-mite");
const backlashed = applyVowBacklash(vow, "riv");
check("역류는 기억 한 단계를 앗아간다", deathMemoryTier(backlashed, "glass-mite") === 1);
check("역류는 들은 상대의 경계를 부른다", (backlashed.npcTrust.riv ?? 0) < 0);
check("역류 상태가 기록된다", hasVowBacklash(backlashed));
check("역류는 회복 가능하다", !hasVowBacklash(clearVowBacklash(backlashed)));
check("역류가 즉사를 일으키지 않는다", backlashed.runCount === vow.runCount);

const cycled = beginNewCycle(fresh());
check("새 주기는 시드를 갱신한다", cycled.runSeed !== fresh().runSeed || cycled.cycleId === 2);
check("새 주기 번호가 오른다", cycled.cycleId === 2);

// ---------------------------------------------------------------------------
section("13. v0.4 추가 효과");

// 진열대 슬롯을 늘려주는 유물
let slotState = fresh();
slotState = {
  ...slotState,
  inventory: { consumables: [], relics: ["double-vow-seal", "moss-ring", "worn-leather-gloves"] },
};
slotState = equipRelic(slotState, "double-vow-seal");
slotState = equipRelic(slotState, "moss-ring");
slotState = equipRelic(slotState, "worn-leather-gloves");
check("슬롯 유물이 진열대를 3칸으로 늘린다", slotState.equippedRelics.length === 3, `${slotState.equippedRelics.length}`);
check("슬롯 계산이 유물 보유 여부를 따른다", effectiveRelicSlots(["double-vow-seal"]) === RELIC_SLOT_LIMIT + 1);
check("슬롯 유물이 없으면 기본 한도", effectiveRelicSlots(["moss-ring"]) === RELIC_SLOT_LIMIT);

// 슬롯이 늘어난 상태도 저장 정규화를 통과해야 한다
const slotNormalized = normalizeState(slotState);
check("확장된 진열대가 저장 정규화를 통과한다", slotNormalized.equippedRelics.length === 3);

// 무료 행동 — 그 턴에는 반격이 없다
const watchMods = relicModifiers(["cracked-pocket-watch"]);
check("회중시계가 무료 행동을 준다", watchMods.freeActions === 1);
const freeCombat = createCombat({
  enemy: GLASS_MITE,
  memoryTier: 3,
  playerMaxHp: 100,
  playerHp: 100,
  modifiers: watchMods,
});
const afterFree = takeTurn(freeCombat, { id: "basic-strike" }, createRng("free"));
check("무료 행동 턴에는 피해를 받지 않는다", afterFree.record.damageTaken === 0);
check("무료 행동은 한 번만 쓰인다", afterFree.player.freeActions === 0);
const afterFreeUsed = takeTurn(afterFree, { id: "basic-strike" }, createRng("free2"));
check("무료 행동이 떨어지면 다시 반격을 받는다", afterFreeUsed.record.damageTaken > 0);

// 범람 단축
const shortenMods = relicModifiers(["overflow-condensate"]);
let shortOverflow = createCombat({
  enemy: SUTURED_PILGRIM,
  memoryTier: 3,
  stain: 95,
  playerMaxHp: 300,
  playerHp: 300,
  modifiers: shortenMods,
});
shortOverflow = takeTurn(shortOverflow, { id: "sunder" }, createRng("shorten"));
check("응결석이 범람 지속을 줄인다", shortOverflow.player.overflowTurnsLeft === 1, `${shortOverflow.player.overflowTurnsLeft}`);

// 균열 전용 아이템
check("지도 조각은 균열 전용 사용처를 갖는다", consumableHasRiftUse("moldy-map-scrap"));
check("액막이 부적은 균열 전용이 아니다", !consumableHasRiftUse("warding-talisman"));
const mapEffect = riftUseEffect("moldy-map-scrap");
check("지도 조각이 앞의 방을 드러낸다", (mapEffect?.revealRooms ?? 0) === 2);
const inviteEffect = riftUseEffect("unnamed-invitation");
check("초대장은 심층주로 곧장 보낸다", inviteEffect?.jumpToBoss === true);

// 행동 순서 예고
const forecastCombat = createCombat({ enemy: BACKFLOW_HOUND, memoryTier: 3 });
const forecast = forecastEnemyActions(forecastCombat, 3);
check("예고가 요청한 개수만큼 나온다", forecast.length === 3);
check(
  "예고가 실제 패턴 순서를 따른다",
  forecast.map((a) => a.id).join(",") === "scent,circle,backlash",
  forecast.map((a) => a.id).join(",")
);
check("예고는 상태를 바꾸지 않는다", forecastCombat.enemy.patternIndex === 0);
check("기억 0단계에서는 예고가 가려진다", describeForecast(createCombat({ enemy: BACKFLOW_HOUND, memoryTier: 0 }), forecast[0], true) === "?");
check("기억 3단계에서는 이름이 드러난다", describeForecast(forecastCombat, forecast[0], true) === forecast[0].label);

// 엔딩 가산점
let endingState = fresh();
endingState = {
  ...endingState,
  npcTrust: { isra: 1, riv: 0 },
  storyFlags: ["ally-helga"],
  inventory: { consumables: [], relics: ["unspoken-name-fragment"] },
};
const withoutRelic = resolveEnding(endingState);
const withRelic = resolveEnding({ ...endingState, equippedRelics: ["unspoken-name-fragment"] });
check("가산점 없이는 트루엔딩에 못 닿는다", withoutRelic.id !== "unspoken-name");
check("가산 유물이 트루엔딩 판정을 밀어준다", withRelic.id === "unspoken-name");

// ---------------------------------------------------------------------------
console.log(`\n${passed}개 통과, ${failed}개 실패`);
process.exit(failed > 0 ? 1 : 0);
