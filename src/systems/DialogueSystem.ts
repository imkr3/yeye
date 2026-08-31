/**
 * 대화 시스템 — 선택지 기반 분기 + 신뢰가 걸린 순간의 자유 대사 입력.
 * 설계 문서 11번 섹션 참고.
 *
 * 자유 입력은 실제 언어모델 없이, 노드에 정의된 키워드 태그와 대조해
 * 가장 먼저 일치하는 분기로 이동한다. evaluateFreeText만 교체하면
 * 나중에 실제 LLM 판정으로 바꿔 끼울 수 있도록 분리해둔다.
 */

export interface DialogueChoice {
  label: string;
  next: string;
  trustDelta?: number;
  /** 엔딩 판정 등에 쓰이는 스토리 플래그. */
  flag?: string;
}

export interface FreeTextBranch {
  /** 이 중 하나라도 입력에 포함되면 이 분기로 이동 */
  keywords: string[];
  next: string;
  trustDelta?: number;
  flag?: string;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  line: string;
  /** 선택지형 노드 */
  choices?: DialogueChoice[];
  /** 자유 입력형 노드 */
  freeText?: {
    prompt: string;
    branches: FreeTextBranch[];
    fallback: { next: string; trustDelta?: number; flag?: string };
  };
  /** 분기 없이 다음으로 자동 진행 (대사 나열용) */
  next?: string;
  /** 대화 종료 노드 */
  end?: boolean;
}

export interface DialogueTree {
  npcId: string;
  /** 대화 UI에 표시할 계통색 문장. 비주얼 디렉션(08번 섹션) 팔레트 참고. */
  crestColor: number;
  /** 문장 모양 — render/silhouettes.ts의 CrestShape과 동일한 값을 문자열로 둔다. */
  crestShape: "dual-ring" | "leaf" | "diamond" | "triangle" | "zigzag";
  startNode: string;
  nodes: Record<string, DialogueNode>;
}

export function getNode(tree: DialogueTree, nodeId: string): DialogueNode {
  const node = tree.nodes[nodeId];
  if (!node) throw new Error(`대화 노드를 찾을 수 없습니다: ${nodeId}`);
  return node;
}

/**
 * 자유 입력 텍스트를 노드의 키워드 분기와 대조한다.
 * 나중에 실제 언어모델 판정으로 교체할 자리 — 시그니처만 유지하면 된다.
 */
export function evaluateFreeText(
  input: string,
  node: DialogueNode
): { next: string; trustDelta?: number; flag?: string } {
  if (!node.freeText) throw new Error("자유 입력 노드가 아닙니다.");
  const normalized = input.trim().toLowerCase();

  for (const branch of node.freeText.branches) {
    if (branch.keywords.some((k) => normalized.includes(k.toLowerCase()))) {
      return { next: branch.next, trustDelta: branch.trustDelta, flag: branch.flag };
    }
  }
  return node.freeText.fallback;
}
