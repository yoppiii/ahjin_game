export async function createGame({ canvas, assets }) {
  const ctx = canvas.getContext("2d");
  const images = {
    girl: await loadImage(assets.girl),
    boy: await loadImage(assets.boy),
  };

  let gender = "girl";
  let layoutMode = "intro"; // intro | main

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  window.addEventListener("resize", resize);

  function setGender(g) {
    gender = g;
    draw();
  }

  function setLayoutMode(mode) {
    layoutMode = mode;
    draw();
  }

  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const img = images[gender];
    if (!img) return;

    // ✅ 크기는 항상 동일 (요구사항 1)
    const targetH = h * 0.62;
    const scale = targetH / img.height;
    const dw = img.width * scale;
    const dh = img.height * scale;

    // ✅ 메인에서는 하단 UI 때문에 "위치만" 조금 올림
    const bottomReserved = (layoutMode === "main") ? 150 : 90;

    const x = (w - dw) / 2;
    const y = h - dh - bottomReserved;

    ctx.drawImage(img, x, y, dw, dh);
  }

  resize();

  return {
    setGender,
    setLayoutMode,
    redraw: draw,
    destroy() {
      window.removeEventListener("resize", resize);
    }
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지 로드 실패: " + src));
    img.src = src;
  });
}