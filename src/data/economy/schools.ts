/**
 * 아이템의 계통 분류.
 *
 * 아이템 파일의 ID를 건드리지 않기 위해, 계통은 여기서 따로 매핑한다.
 * 여진 가루로 특정 계통의 출현 가중치를 올릴 때 이 표를 참조한다.
 */

export type School = "life" | "ruin" | "bond" | "sanctity" | "none";

export const SCHOOL_LABEL: Record<School, string> = {
  life: "생(生)",
  ruin: "멸(滅)",
  bond: "연(緣)",
  sanctity: "성(聖)",
  none: "무계통",
};

export const SCHOOL_COLOR: Record<School, number> = {
  life: 0x4c6e5c,
  ruin: 0x7c1f2b,
  bond: 0x3d4a7c,
  sanctity: 0xa8873a,
  none: 0x8c8168,
};

const ITEM_SCHOOLS: Record<string, School> = {
  // 소모품
  "dried-jerky": "life",
  "half-full-canteen": "life",
  "damp-matches": "none",
  "worn-compass": "bond",
  "ash-bead-necklace": "none",
  "folded-flyer": "bond",
  "dull-flint": "life",
  "moldy-map-scrap": "bond",
  "vow-ghostwrite": "sanctity",
  "stain-suppressant": "life",
  "stairkeepers-mark": "bond",
  "ash-filter-bottle": "sanctity",
  "translucent-key": "bond",
  "warding-talisman": "sanctity",
  "rewound-hand": "bond",
  "truth-buoy": "bond",
  "helgas-notebook-copy": "sanctity",
  "overflow-shard": "ruin",
  "morens-stair-chart": "bond",
  "unnamed-invitation": "sanctity",
  // 유물
  "worn-wristwatch": "none",
  "worn-leather-gloves": "ruin",
  "waterproof-boots": "life",
  "isras-glass-bead": "life",
  "rivs-calculator": "bond",
  "frost-rimmed-lens": "sanctity",
  "stained-diary": "ruin",
  "second-save": "bond",
  "helgas-broken-staff-shard": "sanctity",
  "corroded-atlas": "bond",
  "cracked-pocket-watch": "bond",
  "overflow-condensate": "ruin",
  "morens-old-footprint": "none",
  "ash-crystal-core": "ruin",
  "silent-seal-shard": "bond",
  "moss-ring": "life",
  "unspoken-name-fragment": "sanctity",
  "double-vow-seal": "sanctity",
  "residue-necklace": "ruin",
  "stairwell-shadow": "none",
};

export function schoolOf(itemId: string): School {
  return ITEM_SCHOOLS[itemId] ?? "none";
}
