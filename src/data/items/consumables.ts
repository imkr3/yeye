import type { ConsumableItem } from "../../systems/GachaSystem";

/**
 * 소모품 풀 — 1차 배치 20종. 여기 계속 추가해나간다.
 * 전부 이 프로젝트 세계관(여진화 경제, 균열, 서약, 얼룩, 각 지역)에 맞춰 새로 지은 오리지널 아이템.
 */
export const CONSUMABLE_POOL: ConsumableItem[] = [
  // --- C ---
  { id: "dried-jerky", name: "마른 육포", rarity: "C", flavor: "질기지만 씹을수록 든든하다.", effect: "체력을 소량 회복한다." },
  { id: "damp-matches", name: "눅눅한 성냥", rarity: "C", flavor: "세 번에 한 번은 붙는다.", effect: "어두운 구간에서 잠깐 시야를 밝힌다." },
  { id: "worn-compass", name: "낡은 나침반", rarity: "C", flavor: "바늘이 가리키는 건 자석이 아니라 다음 분기점이다.", effect: "가장 가까운 분기점 방향을 표시한다." },
  { id: "ash-bead-necklace", name: "여진 방울 목걸이", rarity: "C", flavor: "은은하게 빛나는 잔재 방울.", effect: "야간 구간에서 시야를 소폭 넓힌다." },
  { id: "half-full-canteen", name: "반쯤 남은 물통", rarity: "C", flavor: "그래도 반이나 남았다.", effect: "체력을 소량 회복하고 갈증 상태를 해제한다." },
  { id: "folded-flyer", name: "접힌 전단지", rarity: "C", flavor: "재의 시장 상인들이 뿌린 오늘의 시세표.", effect: "여진화 시세 정보를 잠깐 보여준다." },
  { id: "dull-flint", name: "무딘 부싯돌", rarity: "C", flavor: "불이 붙기까지 한참 걸린다.", effect: "모닥불을 피워 임시 휴식 지점을 만든다." },
  { id: "moldy-map-scrap", name: "곰팡이 슨 지도 조각", rarity: "C", flavor: "구석이 다 찢어져 알아보기 힘들다.", effect: "근처 균열 입구 위치를 흐릿하게 표시한다." },

  // --- UC ---
  { id: "vow-ghostwrite", name: "서약의 대필", rarity: "UC", flavor: "대필한 서약도 서약은 서약이다.", effect: "이번 서약 위반 페널티를 1회 경감한다." },
  { id: "stain-suppressant", name: "얼룩 억제 연고", rarity: "UC", flavor: "발라도 얼룩은 사라지지 않는다. 잠잠해질 뿐.", effect: "다음 판정에서 얼룩 발동 확률을 낮춘다." },
  { id: "stairkeepers-mark", name: "계단지기의 표식", rarity: "UC", flavor: "모른이 몰래 남겨둔 흔적이라고들 한다.", effect: "끝없는 계단에서 함정 위치를 일시적으로 드러낸다." },
  { id: "ash-filter-bottle", name: "재의 여과병", rarity: "UC", flavor: "여진을 걸러내는 낡은 정수병.", effect: "여진 오염 피해를 1회 무효화한다." },
  { id: "translucent-key", name: "반투명 열쇠", rarity: "UC", flavor: "어떤 자물쇠에도 반쯤은 맞는다.", effect: "잠긴 문 하나를 강제로 연다." },

  // --- R ---
  { id: "warding-talisman", name: "액막이 종이부적", rarity: "R", flavor: "저주를 막는다지만, 정작 본인은 못 믿는 눈치다.", effect: "죽음 페널티 적용을 1회 완전히 방지한다." },
  { id: "rewound-hand", name: "되감긴 시침", rarity: "R", flavor: "시곗바늘이 아주 잠깐, 거꾸로 돈다.", effect: "세이브 포인트를 갱신하지 않은 채 같은 자리에서 한 번 더 기회를 얻는다." },
  { id: "truth-buoy", name: "거짓말 탐지 부표", rarity: "R", flavor: "물 위에 뜬 채로 진위를 가려낸다.", effect: "대화 상대 발언의 진실 여부를 3회까지 확인할 수 있다." },
  { id: "helgas-notebook-copy", name: "헬가의 실험 노트 사본", rarity: "R", flavor: "필체가 지나치게 꼼꼼하다.", effect: "서리 관측소의 함정을 전부 표시한다." },

  // --- SR ---
  { id: "overflow-shard", name: "대범람의 파편", rarity: "SR", flavor: "만지면 손끝이 저릿하다.", effect: "강력한 일격을 가하지만, 사용 후 며칠간 '불안정' 상태가 된다." },
  { id: "morens-stair-chart", name: "모른의 계단표", rarity: "SR", flavor: "몇 번째로 지나가는지까지 적혀 있다.", effect: "다음 균열의 적 패턴을 전부 미리 보여준다." },

  // --- SSR ---
  { id: "unnamed-invitation", name: "이름 없는 자의 초대장", rarity: "SSR", flavor: "받는 사람 이름 칸이 비어 있다. 당신 것이 맞다.", effect: "히든 루트로 즉시 이동한다." },

  // === 2차 배치 =============================================================
  // --- C ---
  { id: "cracked-whetstone", name: "금 간 숫돌", rarity: "C", flavor: "갈면 갈수록 저도 같이 닳는다.", effect: "한 번 반격당하지 않는 행동을 얻는다." },
  { id: "salt-wrapped-bandage", name: "소금 감은 붕대", rarity: "C", flavor: "쓰라린 만큼 잘 듣는다.", effect: "체력을 회복하고 얼룩을 조금 씻어낸다." },
  { id: "riverbed-pebble", name: "강바닥 조약돌", rarity: "C", flavor: "오래 굴러 모서리가 하나도 없다.", effect: "얇은 보호막을 두른다." },
  { id: "tin-whistle", name: "양철 호루라기", rarity: "C", flavor: "소리가 크진 않은데 이상하게 멀리 간다.", effect: "적의 표식을 흩고 무너진 자세를 다시 세운다." },

  // --- UC ---
  { id: "anchor-chalk", name: "정박지 분필", rarity: "UC", flavor: "바닥에 원을 그리면 그 안은 잠시 안전하다.", effect: "균열 안에서 숨을 돌려 체력을 회복한다." },
  { id: "seconds-thief", name: "초를 훔친 자", rarity: "UC", flavor: "훔친 시간은 돌려줄 방법이 없다.", effect: "반격당하지 않는 행동을 두 번 얻는다." },
  { id: "vein-glass-lens", name: "유리맥 렌즈", rarity: "UC", flavor: "지하도 벽을 깎아 만든 조악한 렌즈.", effect: "적의 다음 수를 두 단계 더 읽는다." },

  // --- R ---
  { id: "helgas-coolant", name: "헬가의 냉각제", rarity: "R", flavor: "라벨에 사용량이 두 번 고쳐 적혀 있다.", effect: "범람을 즉시 가라앉히고 얼룩을 크게 줄인다." },
  { id: "rivs-ledger-page", name: "리브의 장부 한 장", rarity: "R", flavor: "찢어간 걸 알면서도 그는 아무 말 하지 않았다.", effect: "여진화를 얻는다." },

  // --- SR ---
  { id: "isras-spare-key", name: "이스라의 여벌 열쇠", rarity: "SR", flavor: "\"돌려줄 필요는 없어. 어차피 내 것도 아니었으니까.\"", effect: "균열의 현재 방을 건너뛰며 체력을 회복한다." },
  { id: "counterflow-vial", name: "역류 유리병", rarity: "SR", flavor: "안쪽에서 바깥으로 흐르는 물이 담겨 있다.", effect: "적에게 큰 피해를 주지만 얼룩이 크게 번진다." },

  // --- SSR ---
  { id: "morens-blank-page", name: "모른의 백지", rarity: "SSR", flavor: "아무것도 적혀 있지 않은 것이 이 장의 내용이다.", effect: "얼룩과 범람을 지우고 보호막과 완전한 예지를 얻는다." },
];
