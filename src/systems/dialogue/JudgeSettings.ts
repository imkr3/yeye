/**
 * 대화 판정기 설정.
 *
 * 이 게임은 서버가 없는 정적 사이트다. 그래서 언어모델을 부르려면 키가 브라우저
 * 안에 있어야 하는데, 키를 저장소에 넣으면 사이트를 여는 누구나 그 키로 요금을
 * 쓸 수 있다. 그래서:
 *
 * - 저장소에는 어떤 키도 넣지 않는다. 공개 빌드의 기본값은 항상 오프라인 판정이다.
 * - 키는 플레이어가 직접 넣고, 그 사람의 브라우저(localStorage)에만 남는다.
 *   게임 저장 데이터와도 분리해서, 세이브를 공유해도 키가 딸려가지 않게 한다.
 * - 키를 브라우저에 두는 것 자체가 안전하지 않으므로(확장 프로그램 등이 읽을 수 있다),
 *   설정 화면에서 그 사실을 그대로 알린다. 더 안전한 길은 프록시 주소를 넣는 것이다.
 */

export type JudgeMode = "offline" | "claude";

export interface JudgeSettings {
  mode: JudgeMode;
  /** 플레이어 본인의 API 키 (BYOK). 비어 있으면 프록시를 쓰거나 오프라인으로 돈다. */
  apiKey: string;
  /** 키 없이 호출을 대신 처리해 주는 서버 주소. 있으면 이쪽을 우선한다. */
  proxyUrl: string;
  model: string;
}

const KEY = "unbroken-vow:judge";

export const DEFAULT_JUDGE_SETTINGS: JudgeSettings = {
  mode: "offline",
  apiKey: "",
  proxyUrl: "",
  model: "claude-opus-5",
};

/** 설정 화면에 그대로 보여줄 모델 후보. 뒤로 갈수록 빠르고 싸다. */
export const JUDGE_MODELS = [
  { id: "claude-opus-5", label: "Opus 5 — 가장 정확, 가장 느림" },
  { id: "claude-sonnet-5", label: "Sonnet 5 — 중간" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5 — 가장 빠름, 대화 판정에 무난" },
];

export function loadJudgeSettings(): JudgeSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_JUDGE_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<JudgeSettings>;
    return {
      mode: parsed.mode === "claude" ? "claude" : "offline",
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      proxyUrl: typeof parsed.proxyUrl === "string" ? parsed.proxyUrl : "",
      model:
        typeof parsed.model === "string" && JUDGE_MODELS.some((m) => m.id === parsed.model)
          ? parsed.model
          : DEFAULT_JUDGE_SETTINGS.model,
    };
  } catch {
    return { ...DEFAULT_JUDGE_SETTINGS };
  }
}

export function saveJudgeSettings(next: JudgeSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 저장 못 해도 이번 세션에서는 동작한다. */
  }
}

/** 실제로 언어모델을 부를 수 있는 상태인지. */
export function judgeIsLive(s: JudgeSettings): boolean {
  return s.mode === "claude" && (s.apiKey.trim().length > 0 || s.proxyUrl.trim().length > 0);
}
