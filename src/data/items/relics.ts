import type { RelicItem } from "../../systems/GachaSystem";

/**
 * 유물 풀 — 1차 배치 20종. 진열대에 걸면 영구 패시브를 얻는다.
 * 전부 이 프로젝트 세계관에 맞춰 새로 지은 오리지널 유물.
 */
export const RELIC_POOL: RelicItem[] = [
  // --- C ---
  { id: "worn-wristwatch", name: "낡은 손목시계", rarity: "C", flavor: "시간은 안 맞지만 째깍거리는 소리는 위안이 된다.", trait: "이동 속도가 소폭 증가한다." },
  { id: "worn-leather-gloves", name: "닳은 가죽 장갑", rarity: "C", flavor: "손에 익어 이제는 벗기 싫다.", trait: "기초 타격 피해가 소폭 증가한다." },
  { id: "waterproof-boots", name: "물빠짐 방지 부츠", rarity: "C", flavor: "밑창에 물이끼가 잔뜩 붙어 있다.", trait: "침수 지역에서 이동 페널티를 받지 않는다." },

  // --- UC ---
  { id: "isras-glass-bead", name: "이스라의 유리구슬", rarity: "UC", flavor: "안에서 작은 물방울이 계속 맴돈다.", trait: "죽음의 기억 지속시간이 소폭 늘어난다." },
  { id: "rivs-calculator", name: "리브의 계산기", rarity: "UC", flavor: "리브 칸이 쓰던 것과 똑같이 생겼다.", trait: "여진화 거래 시 가격이 소폭 할인된다." },
  { id: "frost-rimmed-lens", name: "서리 낀 렌즈", rarity: "UC", flavor: "닦아도 자꾸 다시 서리가 낀다.", trait: "서리 관측소 함정 감지 범위가 넓어진다." },

  // --- R ---
  { id: "stained-diary", name: "얼룩진 일기장", rarity: "R", flavor: "페이지마다 같은 문장이 반복해서 적혀 있다.", trait: "얼룩이 발동할 때 파편을 추가로 얻는다." },
  { id: "second-save", name: "두 번째 세이브", rarity: "R", flavor: "세계가 실수로 두 번 저장한 흔적.", trait: "분기점을 갱신할 때 보상이 소폭 늘어난다." },
  { id: "helgas-broken-staff-shard", name: "헬가의 부러진 지팡이 조각", rarity: "R", flavor: "부러진 단면에서 아직도 냉기가 새어 나온다.", trait: "성(聖) 계통 스킬의 위력이 증가한다." },
  { id: "corroded-atlas", name: "부식된 지도첩", rarity: "R", flavor: "펼칠 때마다 페이지가 조금씩 바스러진다.", trait: "미탐사 지역이 지도에 표시된다." },
  { id: "cracked-pocket-watch", name: "갈라진 회중시계", rarity: "R", flavor: "금 간 유리 너머로 초침이 거꾸로 도는 것처럼 보인다.", trait: "전투 중 1회 추가 행동을 얻는다." },

  // --- SR ---
  { id: "overflow-condensate", name: "대범람의 응결석", rarity: "SR", flavor: "만지면 서늘하다 못해 아프다.", trait: "범람 상태의 지속시간이 짧아진다." },
  { id: "morens-old-footprint", name: "모른의 낡은 발자국", rarity: "SR", flavor: "돌바닥에 새겨진 채 지워지지 않는다.", trait: "끝없는 계단 균열의 파밍 보상이 늘어난다." },
  { id: "ash-crystal-core", name: "여진 결정핵", rarity: "SR", flavor: "쪼개면 안에서 옅은 빛이 새어 나온다.", trait: "여진화 획득량이 늘어난다." },
  { id: "silent-seal-shard", name: "침묵의 인장 조각", rarity: "SR", flavor: "리브 칸이 절대 팔지 않는 물건 중 하나.", trait: "리브 칸과의 신뢰 획득량이 늘어난다." },
  { id: "moss-ring", name: "이끼 낀 반지", rarity: "SR", flavor: "낀 채로 오래 두면 반지가 아니라 반지 모양의 이끼가 된다.", trait: "생(生) 계통 회복량이 증가한다." },

  // --- SSR ---
  { id: "unspoken-name-fragment", name: "말하지 않은 이름의 조각", rarity: "SSR", flavor: "이름 대신 침묵이 새겨져 있다.", trait: "숨겨진 결말로 향하는 신뢰 판정에 소폭 가산된다." },
  { id: "double-vow-seal", name: "서약의 이중 인장", rarity: "SSR", flavor: "세계가 한 사람에게 두 번 거래를 허락하는 일은 드물다.", trait: "서약을 하나 더 맺을 수 있게 된다." },
  { id: "residue-necklace", name: "잔재의 목걸이", rarity: "SSR", flavor: "목에 걸면 균열 안쪽 공기가 조금 옅어진 것처럼 느껴진다.", trait: "심도 3 이상 균열의 환로를 미리 이용할 수 있다." },
  { id: "stairwell-shadow", name: "계단의 그림자", rarity: "SSR", flavor: "모른조차 이 그림자의 정체는 모른다고 했다.", trait: "죽음의 기억이 첫 방문에도 발동한다." },
];
