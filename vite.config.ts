import { defineConfig } from "vite";

// GitHub Pages(프로젝트 페이지)는 https://<user>.github.io/<repo>/ 경로로 서빙되므로,
// 에셋 경로가 그 하위 경로를 기준으로 잡히도록 base를 저장소 이름으로 맞춘다.
export default defineConfig({
  base: "/yeye/",
});
