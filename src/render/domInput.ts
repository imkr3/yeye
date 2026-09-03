import Phaser from "phaser";

/**
 * 캔버스 위에 정확히 얹히는 HTML 입력창.
 *
 * Phaser의 DOM 컨테이너를 쓰지 않는 이유: Phaser는 컨테이너를 캔버스의
 * marginLeft/marginTop을 복사해 맞추는데, 컨테이너가 position:absolute라
 * 캔버스가 레터박스로 가운데 정렬되면 둘이 어긋난다. 실제로 입력창이 제자리보다
 * 한참 아래로 내려가 버튼과 겹쳤다.
 *
 * 한글 조합(IME) 때문에 진짜 <input>은 반드시 필요하므로, 게임 좌표에서 직접
 * 계산해 body에 붙이고 크기 변화마다 다시 맞춘다.
 */
export interface DomInputOptions {
  x: number;
  y: number;
  w: number;
  h?: number;
  placeholder?: string;
  password?: boolean;
  value?: string;
  maxLength?: number;
  onEnter?: () => void;
}

export class CanvasDomInput {
  readonly el: HTMLInputElement;
  private layout: { x: number; y: number; w: number; h: number };
  private reposition = () => this.apply();

  constructor(private scene: Phaser.Scene, opts: DomInputOptions) {
    const el = document.createElement("input");
    el.type = opts.password ? "password" : "text";
    el.placeholder = opts.placeholder ?? "";
    el.value = opts.value ?? "";
    el.maxLength = opts.maxLength ?? 200;
    el.autocomplete = "off";
    el.spellcheck = false;
    el.style.padding = "6px 10px";
    el.style.background = "#1e1a13";
    el.style.color = "#ece3ce";
    el.style.border = "1px solid #3a3225";
    el.style.fontFamily = "monospace";
    el.style.boxSizing = "border-box";
    document.body.appendChild(el);
    this.el = el;

    this.layout = { x: opts.x, y: opts.y, w: opts.w, h: opts.h ?? 34 };
    this.apply();

    /*
     * Phaser의 키보드 캡처는 전역이다 — 캡처 목록에 있는 키코드면 이벤트 대상이
     * <input> 안이라도 preventDefault를 부른다. 방향키·Shift·Space가 그 목록에
     * 있어서, 꺼주지 않으면 스페이스가 아예 타이핑되지 않는다.
     */
    const keyboard = scene.input.keyboard;
    el.addEventListener("focus", () => keyboard?.disableGlobalCapture());
    el.addEventListener("blur", () => keyboard?.enableGlobalCapture());
    if (opts.onEnter) {
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") opts.onEnter!();
      });
    }

    scene.scale.on(Phaser.Scale.Events.RESIZE, this.reposition);
    window.addEventListener("resize", this.reposition);
  }

  get value(): string {
    return this.el.value;
  }

  private apply() {
    const cv = this.scene.game.canvas.getBoundingClientRect();
    const s = this.scene.scale.displayScale; // 게임 좌표 / 화면 좌표
    const el = this.el;
    el.style.position = "fixed";
    el.style.left = `${cv.left + this.layout.x / s.x}px`;
    el.style.top = `${cv.top + this.layout.y / s.y}px`;
    el.style.width = `${this.layout.w / s.x}px`;
    el.style.height = `${this.layout.h / s.y}px`;
    el.style.fontSize = `${13 / s.y}px`;
  }

  destroy() {
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.reposition);
    window.removeEventListener("resize", this.reposition);
    this.scene.input?.keyboard?.enableGlobalCapture();
    this.el.remove();
  }
}
