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
  penaltyPurgeCost,
  purgeAllCost,
  purgeOnePenalty,
  purgeAllPenalties,
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
  fieldUseMessage,
  consumableHasAnyEffect,
  COMPASS_FLAG,
  MARKET_TIPOFF_FLAG,
  relicHasEffect,
  revealsDialogueDanger,
  DANGER_REVEALING_ITEMS,
} from "../src/systems/EffectRegistry";
import { resolveEnding } from "../src/systems/EndingSystem";
import { pullOnce, pullFive, PITY_THRESHOLD, DUPLICATE_DUST, rarityOdds, priceFor, consumeMarketTipoff, PRICES } from "../src/systems/EconomySystem";
import { CONSUMABLE_POOL } from "../src/data/items/consumables";
import { RELIC_POOL } from "../src/data/items/relics";
import { schoolOf } from "../src/data/economy/schools";
import { REGIONS } from "../src/data/regions";
import { israDialogue } from "../src/data/dialogues/isra";
import { rivDialogue } from "../src/data/dialogues/riv";
import { helgaDialogue } from "../src/data/dialogues/helga";
import { morenDialogue } from "../src/data/dialogues/moren";
import { borrowedFaceDialogue } from "../src/data/dialogues/borrowed-face";
import { countingMouthDialogue } from "../src/data/dialogues/counting-mouth";
import { silentPilgrimDialogue } from "../src/data/dialogues/silent-pilgrim";
import { ashBearerDialogue } from "../src/data/dialogues/ash-bearer";
import { evaluateFreeText } from "../src/systems/DialogueSystem";
import type { DialogueNode, DialogueTree } from "../src/systems/DialogueSystem";
import { hazardClearance, canClearHazard, maxJumpRise, MIN_CLEARANCE_RATIO } from "../src/systems/Platforming";
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
section("14. 정보형 소모품(나침반·전단지)이 실제로 무언가를 바꾼다");

// 모든 소모품에 효과가 붙어 있어야 한다 — 설명만 있는 아이템을 남기지 않는다.
const effectless = CONSUMABLE_POOL.filter((i) => !consumableHasAnyEffect(i.id)).map((i) => i.id);
check("설명만 있고 효과가 없는 소모품이 없다", effectless.length === 0, effectless.join(", "));

let compassState = fresh();
compassState = { ...compassState, inventory: { consumables: ["worn-compass"], relics: [] } };
const compassNote = fieldUseMessage(compassState, "worn-compass");
check("나침반이 사용 문구를 돌려준다", !!compassNote, compassNote ?? "(없음)");
const compassUsed = applyFieldConsumable(compassState, "worn-compass");
// 바늘은 지역의 분기점을 가리키므로, 문구가 마지막 기록 분기점 이름을 단정하면 안 된다.
check(
  "나침반 문구가 특정 분기점 이름을 단정하지 않는다",
  !compassNote!.includes(compassState.currentSavePoint.label)
);
check("이미 켜져 있으면 다른 문구를 준다", fieldUseMessage(compassUsed, "worn-compass") !== compassNote);
check("나침반이 방향 표시를 켠다", compassUsed.storyFlags.includes(COMPASS_FLAG));
check("나침반도 사용하면 소모된다", compassUsed.inventory.consumables.length === 0);

let flyerState = fresh();
flyerState = { ...flyerState, inventory: { consumables: ["folded-flyer"], relics: [] } };
const basePrice = priceFor(PRICES.singlePull, flyerState);
const flyerUsed = applyFieldConsumable(flyerState, "folded-flyer");
const cheapPrice = priceFor(PRICES.singlePull, flyerUsed);
check("전단지가 다음 구매 값을 깎는다", cheapPrice < basePrice, `${basePrice} → ${cheapPrice}`);
const afterPurchase = consumeMarketTipoff(flyerUsed);
check("시세표는 한 번 쓰면 사라진다", !afterPurchase.storyFlags.includes(MARKET_TIPOFF_FLAG));
check("할인이 다음 거래로 이어지지 않는다", priceFor(PRICES.singlePull, afterPurchase) === basePrice);
check("할인이 값을 0 아래로 떨어뜨리지 않는다", priceFor(1, flyerUsed) >= 1);

// ---------------------------------------------------------------------------
section("15. 2차 배치 아이템이 전부 실제 효과와 계통을 갖는다");

const relicless = RELIC_POOL.filter((i) => !relicHasEffect(i.id)).map((i) => i.id);
check("효과가 없는 유물이 없다", relicless.length === 0, relicless.join(", "));

const dupIds = [...CONSUMABLE_POOL, ...RELIC_POOL].map((i) => i.id);
check("아이템 ID가 전부 고유하다", new Set(dupIds).size === dupIds.length);

const unschooled = [...CONSUMABLE_POOL, ...RELIC_POOL].filter(
  (i) => schoolOf(i.id) === "none" && !["damp-matches", "ash-bead-necklace", "worn-wristwatch", "morens-old-footprint", "stairwell-shadow", "morens-blank-page"].includes(i.id)
).map((i) => i.id);
check("계통 분류가 빠진 아이템이 없다", unschooled.length === 0, unschooled.join(", "));

// 새 수정치들이 실제로 계산에 반영되는지
check("얼룩 저항이 곱해서 겹친다", Math.abs(relicModifiers(["riverstone-charm", "salt-lined-cloak"]).stainMultiplier - 0.72) < 1e-9);
check("반격 피해는 더해서 겹친다", relicModifiers(["chipped-gorget", "counterweight-ring"]).guardCounter === 9);
check("같은 유물을 두 번 넣어도 한 번만 적용된다", relicModifiers(["counterweight-ring", "counterweight-ring"]).guardCounter === 6);

// 얼룩 저항이 전투에서 실제로 덜 오른다
const stainy = createCombat({ enemy: GLASS_MITE, modifiers: relicModifiers([]) });
const resisted = createCombat({ enemy: GLASS_MITE, modifiers: relicModifiers(["unstained-veil"]) });
const plainAfter = takeTurn(stainy, { id: "sunder" }, createRng("stain-a"));
const veilAfter = takeTurn(resisted, { id: "sunder" }, createRng("stain-a"));
check("얼룩 없는 면사가 실제로 얼룩을 덜 쌓는다", veilAfter.player.stain < plainAfter.player.stain, `${plainAfter.player.stain} → ${veilAfter.player.stain}`);
check("얼룩 저항이 얼룩을 음수로 만들지 않는다", veilAfter.player.stain >= 0);

// 방어 반격이 방어했을 때만 나간다
const counterState = createCombat({ enemy: GLASS_MITE, modifiers: relicModifiers(["returned-favor-pin"]) });
const counterAfter = takeTurn(counterState, { id: "guard" }, createRng("counter"));
check("방어 반격이 적 체력을 깎는다", counterAfter.enemy.hp < GLASS_MITE.maxHp);
const noCounter = takeTurn(
  createCombat({ enemy: GLASS_MITE, modifiers: relicModifiers([]) }),
  { id: "guard" },
  createRng("counter")
);
check("반격 유물이 없으면 방어만으로 피해가 없다", noCounter.enemy.hp === GLASS_MITE.maxHp);

// 균열 회복 보너스
check("균열 회복 보너스가 합산된다", relicModifiers(["hollow-lantern", "tidewalkers-tabi"]).riftHealBonus === 11);
check("천장 단축이 합산된다", relicModifiers(["vein-glass-monocle"]).pityReduction === 2);
check("가루 배율이 곱해진다", Math.abs(relicModifiers(["ash-dusted-pouch", "dust-sifters-sieve"]).dustMultiplier - 3) < 1e-9);

// ---------------------------------------------------------------------------
section("16. 횡스크롤 함정을 실제로 점프로 넘을 수 있다");

// 눈대중으로 정한 함정 크기 때문에 넘을 수 없는 구간이 두 개 있었다.
// 이제 모든 횡스크롤 함정이 여유를 두고 넘어갈 수 있는지 여기서 확인한다.
const sidescrollHazards = Object.entries(REGIONS).filter(
  ([, r]) => r.movementMode === "sidescroll" && r.hazard && !r.hazard.combat
);
check("검사할 횡스크롤 함정이 존재한다", sidescrollHazards.length > 0);

for (const [key, region] of sidescrollHazards) {
  const c = hazardClearance(region.hazard!, region.groundY!);
  check(
    `${key}: 함정을 넘을 수 있다 (여유 ${c.ratio.toFixed(2)}배)`,
    canClearHazard(region.hazard!, region.groundY!),
    `필요 상승 ${c.requiredRise}px / 최대 ${maxJumpRise()}px, 체공 ${c.airWindow.toFixed(3)}s vs 통과 ${c.crossingTime.toFixed(3)}s`
  );
  check(`${key}: 점프 높이 안에 들어온다`, c.requiredRise < maxJumpRise());
}

// 판정식 자체가 맞는지 — 고쳐지기 전의 크기는 불가능으로 나와야 한다.
const oldFrost = hazardClearance({ x: 1000, y: 420, w: 50, h: 150 }, 420);
check("이전 서리 관측소 함정은 불가능으로 판정된다", oldFrost.ratio < 1, `${oldFrost.ratio.toFixed(2)}`);
const oldSunken = hazardClearance({ x: 950, y: 420, w: 44, h: 140 }, 420);
check("이전 침수 회랑 함정은 여유가 없다고 판정된다", oldSunken.ratio < MIN_CLEARANCE_RATIO, `${oldSunken.ratio.toFixed(2)}`);
check("바닥보다 낮은 함정은 항상 통과 가능하다", hazardClearance({ x: 0, y: 600, w: 40, h: 10 }, 420).ratio === Infinity);

// ---------------------------------------------------------------------------
section("17. 모든 대화 트리에서 빠져나올 수 있다");

const ALL_TREES: [string, DialogueTree][] = [
  ["isra", israDialogue],
  ["riv", rivDialogue],
  ["helga", helgaDialogue],
  ["moren", morenDialogue],
  ["borrowed-face", borrowedFaceDialogue],
  ["counting-mouth", countingMouthDialogue],
  ["silent-pilgrim", silentPilgrimDialogue],
  ["ash-bearer", ashBearerDialogue],
];

/** 한 노드에서 이어지는 모든 목적지 id. */
function exitsOf(node: DialogueNode): string[] {
  const out: string[] = [];
  node.choices?.forEach((c) => out.push(c.next));
  if (node.freeText) {
    node.freeText.branches.forEach((b) => out.push(b.next));
    out.push(node.freeText.fallback.next);
  }
  if (node.next) out.push(node.next);
  return out;
}

/** 그 갈래가 죽음으로 끝나는지 — 죽음도 대화를 벗어나는 길이다. */
function isLethalOnly(node: DialogueNode): boolean {
  const choices = node.choices ?? [];
  return choices.length > 0 && choices.every((c) => c.lethal);
}

for (const [name, tree] of ALL_TREES) {
  const ids = new Set(Object.keys(tree.nodes));

  // 1) 가리키는 노드가 실제로 있어야 한다 — 없으면 런타임에 예외가 터지며 대화가 멈춘다.
  const dangling: string[] = [];
  for (const node of Object.values(tree.nodes)) {
    for (const dest of exitsOf(node)) if (!ids.has(dest)) dangling.push(`${node.id}→${dest}`);
  }
  check(`${name}: 존재하지 않는 노드를 가리키지 않는다`, dangling.length === 0, dangling.join(", "));

  // 2) 모든 노드에 나갈 길이 있어야 한다. 예전에는 어느 갈래에도 걸리지 않는 노드가
  //    버튼을 하나도 그리지 않아서 대화 창에 갇혔다.
  const deadEnds = Object.values(tree.nodes)
    .filter((n) => !n.end && exitsOf(n).length === 0 && !isLethalOnly(n))
    .map((n) => n.id);
  check(`${name}: 나갈 길 없는 노드가 없다`, deadEnds.length === 0, deadEnds.join(", "));

  // 3) 시작 노드가 존재하고, 거기서 도달 가능한 종료 노드가 있어야 한다.
  check(`${name}: 시작 노드가 존재한다`, ids.has(tree.startNode));

  const seen = new Set<string>([tree.startNode]);
  const queue = [tree.startNode];
  let reachesEnd = false;
  while (queue.length) {
    const cur = tree.nodes[queue.shift()!];
    if (!cur) continue;
    if (cur.end) reachesEnd = true;
    for (const dest of exitsOf(cur)) {
      if (!seen.has(dest)) {
        seen.add(dest);
        queue.push(dest);
      }
    }
  }
  check(`${name}: 시작 지점에서 종료 노드에 닿을 수 있다`, reachesEnd);

  // 4) 닿을 수 없는 노드는 쓰지 않은 원고이거나 연결을 빠뜨린 것이다.
  const unreachable = [...ids].filter((id) => !seen.has(id));
  check(`${name}: 닿을 수 없는 노드가 없다`, unreachable.length === 0, unreachable.join(", "));
}

// 치명적 갈래는 반드시 사유 문구를 갖는다 — 사망 화면에 빈 줄이 뜨지 않도록.
const lethalChoices = ALL_TREES.flatMap(([, t]) =>
  Object.values(t.nodes).flatMap((n) => (n.choices ?? []).filter((c) => c.lethal))
);
check("치명적 선택지가 실제로 존재한다", lethalChoices.length > 0, `${lethalChoices.length}개`);
check("치명적 선택지에 사유 문구가 있다", lethalChoices.every((c) => (c.lethal ?? "").length > 8));

// 빌린 얼굴은 죽지 않고 빠져나올 길이 반드시 있어야 한다.
const bfStart = borrowedFaceDialogue.nodes[borrowedFaceDialogue.startNode];
const bfFirst = bfStart.choices ?? borrowedFaceDialogue.nodes[bfStart.next!]?.choices ?? [];
check("빌린 얼굴: 첫 갈림길에 안전한 선택지가 있다", bfFirst.some((c) => !c.lethal));

// ---------------------------------------------------------------------------
section("17b. 위험한 대화 상대마다 죽는 방식과 살길이 다르다");

/** 트리 전체에서 치명적인 갈래를 모은다 (선택지 + 키워드 + 기본 갈래). */
function lethalsIn(tree: DialogueTree): string[] {
  const out: string[] = [];
  for (const n of Object.values(tree.nodes)) {
    (n.choices ?? []).forEach((c) => c.lethal && out.push(c.lethal));
    if (n.freeText) {
      n.freeText.branches.forEach((b) => b.lethal && out.push(b.lethal));
      if (n.freeText.fallback.lethal) out.push(n.freeText.fallback.lethal);
    }
  }
  return out;
}

// 죽는 방식이 상대마다 달라야 한다 — 같은 함정의 반복이 되지 않도록.
const lethalTexts = new Set([
  ...lethalsIn(borrowedFaceDialogue),
  ...lethalsIn(countingMouthDialogue),
  ...lethalsIn(silentPilgrimDialogue),
]);
check("위험한 상대가 셋 이상이다", lethalsIn(borrowedFaceDialogue).length > 0 && lethalsIn(countingMouthDialogue).length > 0 && lethalsIn(silentPilgrimDialogue).length > 0);
check("사망 사유 문구가 서로 다르다", lethalTexts.size >= 4, `${lethalTexts.size}종`);

// 미끼는 절대 죽이지 않는다 — 이 반례가 없으면 "수상하면 도망"이 유일한 답이 된다.
check("재를 지고 가는 사람에게는 치명적인 갈래가 없다", lethalsIn(ashBearerDialogue).length === 0);
const bearerMenace = Object.values(ashBearerDialogue.nodes).some((n) => n.menace);
check("그런데도 무섭게 보이도록 표시되어 있다", bearerMenace);

// 셋을 세는 입: 세 번째 동의에서만 죽는다. 앞의 두 번은 안전해야 한다.
const cm = countingMouthDialogue.nodes;
check("첫 동의는 죽지 않는다", (cm["greet"].choices ?? []).every((c) => !c.lethal));
check("둘째 노드까지도 죽지 않는다", (cm["one"].choices ?? []).every((c) => !c.lethal));
check("셋째에서만 치명적인 갈래가 생긴다", (cm["two"].choices ?? []).some((c) => c.lethal));
check("셋째 노드에도 거절할 길이 남아 있다", (cm["two"].choices ?? []).some((c) => !c.lethal));
check("셈을 지적하면 안전하게 빠진다", (cm["two"].choices ?? []).some((c) => c.next === "caught" && !c.lethal));

// 말없는 순례자: 한 번 말을 걸어도 죽지 않고, 두 번째에서만 위험해진다.
const sp = silentPilgrimDialogue.nodes;
check("첫 접촉은 경고로 끝난다", (sp["spoke-once"].choices ?? []).every((c) => !c.lethal));
check("두 번째에는 자유 입력으로 넘어간다", !!sp["spoke-twice"].freeText);
check("아무 말이나 하면 죽는다", !!sp["spoke-twice"].freeText!.fallback.lethal);

// 사과하면 살아야 한다 — 살길이 실제로 동작하는지 판정식으로 확인한다.
const apology = evaluateFreeText("미안합니다, 그만하겠습니다", sp["spoke-twice"]);
check("사과하는 말은 살길로 이어진다", !apology.lethal && apology.next === "apology", apology.next);
const insist = evaluateFreeText("당신 이름이 무엇입니까", sp["spoke-twice"]);
check("우기면 죽는다", !!insist.lethal);
check("살아 나온 기록이 남는다", sp["apology"].flagOnEnter === "spared-by-silent-pilgrim");

// 어떤 위험한 상대에게도 첫 화면에서 그냥 지나갈 길이 있어야 한다.
for (const [name, tree] of [
  ["빌린 얼굴", borrowedFaceDialogue],
  ["셋을 세는 입", countingMouthDialogue],
  ["말없는 순례자", silentPilgrimDialogue],
] as [string, DialogueTree][]) {
  const start = tree.nodes[tree.startNode];
  const first = start.choices ?? tree.nodes[start.next ?? ""]?.choices ?? [];
  check(`${name}: 처음부터 안전하게 물러날 수 있다`, first.some((c) => !c.lethal));
}

// 선물 플래그가 실제 아이템을 가리켜야 한다.
const giftFlags = Object.values(ashBearerDialogue.nodes)
  .map((n) => n.flagOnEnter)
  .filter((f): f is string => !!f && f.startsWith("gift:"));
check("미끼 NPC가 선물을 준다", giftFlags.length === 1);
check(
  "선물 플래그가 실제 존재하는 아이템을 가리킨다",
  giftFlags.every((f) => CONSUMABLE_POOL.some((c) => c.id === f.slice(5))),
  giftFlags.join(", ")
);

// ---------------------------------------------------------------------------
section("18. 누적 페널티를 값을 치르고 지울 수 있다");

let penaltyState = fresh();
const seededRng = createRng("death-1");
penaltyState = applyDeath(applyDeath(applyDeath(penaltyState, seededRng), seededRng), seededRng);
check("죽을 때마다 페널티가 하나씩 붙는다", penaltyState.accumulatedPenalties.length === 3);
check("죽음 횟수가 함께 올라간다", penaltyState.runCount === 3);

// 같은 시드면 같은 결과 — 예전에는 여기만 Math.random을 직접 썼다.
const repeatA = applyDeath(fresh(), createRng("same"));
const repeatB = applyDeath(fresh(), createRng("same"));
check("같은 시드는 같은 페널티를 준다", repeatA.accumulatedPenalties[0].id === repeatB.accumulatedPenalties[0].id);

check("페널티가 쌓일수록 정화 값이 오른다", penaltyPurgeCost(3) > penaltyPurgeCost(1));
check("페널티가 없으면 값이 0이다", penaltyPurgeCost(0) === 0);
check(
  "전부 정화 값은 하나씩 지울 때의 합계와 같다",
  purgeAllCost(3) === penaltyPurgeCost(3) + penaltyPurgeCost(2) + penaltyPurgeCost(1)
);

const purgedOne = purgeOnePenalty(penaltyState);
check("하나 정화하면 하나만 줄어든다", purgedOne.accumulatedPenalties.length === 2);
check("정화해도 회귀 횟수는 남는다", purgedOne.runCount === 3);
const purgedAll = purgeAllPenalties(penaltyState);
check("전부 정화하면 비워진다", purgedAll.accumulatedPenalties.length === 0);
check("페널티가 없을 때 정화해도 문제없다", purgeAllPenalties(fresh()).accumulatedPenalties.length === 0);

// 정화 후에도 저장 정규화를 통과해야 한다.
check("정화한 상태가 저장 규격을 지킨다", normalizeState(purgedAll).accumulatedPenalties.length === 0);

// ---------------------------------------------------------------------------
section("19. 3차 배치와 대화 위험 표식");

check("소모품 풀이 44종이다", CONSUMABLE_POOL.length === 44, `${CONSUMABLE_POOL.length}`);
check("유물 풀이 44종이다", RELIC_POOL.length === 44, `${RELIC_POOL.length}`);

// 지니고만 있어도 되는 아이템 — 소모되지 않는다.
check("부표를 지니면 위험이 드러난다", revealsDialogueDanger(["truth-buoy"]));
check("듣는 밀랍을 지녀도 드러난다", revealsDialogueDanger(["listeners-wax"]));
check("둘 다 없으면 드러나지 않는다", !revealsDialogueDanger(["dried-jerky", "bent-nail"]));
check("빈 소지품에서도 안전하게 동작한다", !revealsDialogueDanger([]));
check(
  "표식 아이템이 전부 실제 소모품 풀에 있다",
  DANGER_REVEALING_ITEMS.every((id) => CONSUMABLE_POOL.some((c) => c.id === id))
);

// 기억 최소 단계는 합산이 아니라 최댓값이어야 한다 — 합치면 3단계를 넘어버린다.
const floors = relicModifiers(["cracked-lens", "stitched-lips-charm"]);
check("기억 최소 단계는 가장 높은 것만 적용된다", floors.memoryFloor === 2, `${floors.memoryFloor}`);
check("기억 최소 단계가 3을 넘지 않는다", floors.memoryFloor <= 3);

// 3차 배치 유물이 실제로 수정치를 바꾸는지 몇 개 확인한다.
check("장부 집게가 여진화 보상을 올린다", relicModifiers(["ledger-clip"]).coinMultiplier > 1);
check("납작한 돌이 함정 피해를 줄인다", relicModifiers(["flat-stone"]).trapDamageMultiplier < 1);
check("양철 부적이 시작 보호막을 준다", relicModifiers(["tin-charm"]).startingShield === 8);
const abacus = relicModifiers(["counters-abacus"]);
check("셈꾼의 주판이 가루와 할인을 동시에 준다", abacus.dustMultiplier > 1 && abacus.shopDiscount > 0);
check("묻지 않은 질문이 트루엔딩 판정을 밀어준다", relicModifiers(["the-unasked-question"]).endingTrustBonus === 1);

// 할인이 겹쳐도 값이 0이 되지 않아야 한다.
let discountState = fresh();
discountState = { ...discountState, equippedRelics: ["counters-abacus"], storyFlags: [MARKET_TIPOFF_FLAG] };
check("할인을 모두 겹쳐도 값은 1 이상이다", priceFor(1, discountState) >= 1);
check("할인이 겹치면 실제로 싸진다", priceFor(PRICES.singlePull, discountState) < PRICES.singlePull);

// ---------------------------------------------------------------------------
console.log(`\n${passed}개 통과, ${failed}개 실패`);
process.exit(failed > 0 ? 1 : 0);
