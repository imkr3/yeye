/**
 * 브라우저 스모크 테스트.
 *
 * systems.test.ts는 순수 로직만 본다. 그래서 "버튼이 안 눌린다", "글자가 안 찍힌다"
 * 같은 문제는 절대 잡지 못한다 — 실제로 Phaser의 전역 키 캡처가 대화 입력창의
 * 스페이스와 'e'를 삼키고 있었는데도 노드 테스트는 전부 통과했다.
 * 그래서 진짜 브라우저에서 실제 마우스와 키보드로 눌러보는 층을 따로 둔다.
 *
 * 실행: npm run build && npm run test:browser
 * 크로미움 경로는 PW_CHROMIUM 환경변수로 덮어쓸 수 있다.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const PORT = Number(process.env.PORT_TEST ?? 4271);
const ROOT = new URL("../dist/", import.meta.url).pathname;
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};

let passed = 0;
let failed = 0;
function check(label, ok, detail = "") {
  if (ok) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

// dist를 그대로 서빙한다 (vite.config의 base와 같은 /yeye/ 아래).
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.startsWith("/yeye/")) p = p.slice("/yeye".length);
    if (p === "/" || p === "") p = "/index.html";
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ""));
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
);
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e).split("\n")[0]));

await page.goto(`http://localhost:${PORT}/yeye/`, { waitUntil: "networkidle" });
await page.waitForFunction(
  () => window.__UNBROKEN_VOW__?.scene?.getScene("RegionScene")?.player,
  null,
  { timeout: 20000 }
);
await page.waitForTimeout(700);

const G = "window.__UNBROKEN_VOW__";
const scenes = () => page.evaluate(`${G}.scene.getScenes(true).map(s => s.scene.key)`);
const dlg = () => page.evaluate(`(() => {
  const d = ${G}.scene.getScene("DialogueScene");
  if (!d || !d.scene.isActive()) return null;
  return { node: d.currentNodeId, options: (d.optionObjects||[]).filter(o => o.input).length };
})()`);

async function approach(index) {
  await page.evaluate(`(() => {
    const rs = ${G}.scene.getScene("RegionScene");
    const it = rs.interactables[${index}];
    rs.player.setPosition(it.x - 18, it.y);
  })()`);
  await page.waitForTimeout(260);
}

async function clickFirstOption() {
  const t = await page.evaluate(`(() => {
    const g = ${G};
    const d = g.scene.getScene("DialogueScene");
    const b = (d.optionObjects||[]).filter(o => o.input && o.type === "Text")[0];
    if (!b) return null;
    const r = g.canvas.getBoundingClientRect(), s = g.scale.displayScale;
    return { text: b.text, x: r.left + (b.x + b.width/2)/s.x, y: r.top + (b.y + b.height/2)/s.y };
  })()`);
  if (!t) return null;
  await page.mouse.click(t.x, t.y);
  await page.waitForTimeout(320);
  return t.text;
}

console.log("\n1. 부팅과 상호작용");
check("게임이 오류 없이 부팅된다", pageErrors.length === 0, pageErrors[0]);
const booted = await scenes();
check("지역 씬이 실행 중이다", booted.includes("RegionScene"), booted.join(","));
check("대화창은 아직 열려 있지 않다", (await dlg()) === null);

await approach(0);
check("가까이 가도 저절로 열리지 않는다", (await dlg()) === null);

await page.keyboard.press("KeyE");
await page.waitForTimeout(450);
const opened = await dlg();
check("E를 누르면 대화가 열린다", opened !== null, JSON.stringify(await scenes()));
check("지역 씬은 일시정지된다", !(await scenes()).includes("RegionScene"));

console.log("\n2. 선택지 버튼이 실제 마우스 클릭에 반응한다");
const n0 = (await dlg())?.node;
const clicked = await clickFirstOption();
const n1 = (await dlg())?.node;
check("버튼을 클릭하면 노드가 넘어간다", !!n1 && n1 !== n0, `${n0} -> ${n1} (${clicked})`);

console.log("\n3. 자유 입력 — 스페이스와 'e'가 실제로 입력된다");
await page.evaluate(`(() => {
  const d = ${G}.scene.getScene("DialogueScene");
  d.currentNodeId = "ask-feeling"; d.renderNode();
})()`);
await page.waitForTimeout(400);

const box = await page.evaluate(`(() => {
  const el = document.querySelector('input[type="text"]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width/2, y: r.y + r.height/2, visible: r.width > 0 && r.height > 0 };
})()`);
check("자유 입력창이 화면에 있다", !!box && box.visible);

await page.mouse.click(box.x, box.y);
await page.waitForTimeout(150);
check("입력창에 포커스가 간다", (await page.evaluate("document.activeElement?.tagName")) === "INPUT");

const SAMPLE = "test e space";
await page.keyboard.type(SAMPLE);
await page.waitForTimeout(250);
const typed = await page.evaluate(`document.querySelector('input[type="text"]').value`);
// Phaser의 키 캡처는 전역이라, 켜져 있으면 여기서 스페이스와 'e'가 통째로 사라진다.
check("입력한 그대로 찍힌다 (스페이스·e 포함)", typed === SAMPLE, `"${typed}"`);

const beforeSubmit = (await dlg())?.node;
await clickFirstOption(); // [ 전달 ]
const afterSubmit = (await dlg())?.node;
check("전달을 누르면 대화가 진행된다", afterSubmit !== beforeSubmit, `${beforeSubmit} -> ${afterSubmit}`);

console.log("\n4. 빠져나오기와 다시 열기");
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
check("Esc로 대화를 닫을 수 있다", (await dlg()) === null);
check("지역 씬이 다시 돌아온다", (await scenes()).includes("RegionScene"));
check("대화가 저절로 다시 열리지 않는다", (await dlg()) === null);

await page.waitForTimeout(300);
check("가만히 서 있어도 계속 닫혀 있다", (await dlg()) === null);

await page.keyboard.press("KeyE");
await page.waitForTimeout(450);
check("다시 E를 누르면 또 열린다", (await dlg()) !== null);

const capsAfter = await page.evaluate(`${G}.input.keyboard.preventDefault`);
check("대화를 닫은 뒤 키 캡처가 복구된다", capsAfter === true, String(capsAfter));

check("전 과정에서 페이지 오류가 없다", pageErrors.length === 0, pageErrors.join(" | "));

await browser.close();
server.close();

console.log(`\n${passed}개 통과, ${failed}개 실패`);
process.exit(failed > 0 ? 1 : 0);
