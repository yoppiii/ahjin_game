export async function enterMainScene({ root, onNavigate }) {
  // root는 #mainUIRoot
  root.innerHTML = `
    <div id="leftPanel" class="clickable" style="${panelStyle()}">
      <div style="display:flex; gap:10px; margin-bottom:10px;">
        <div class="clickable" data-action="homeparty" style="${boxStyle('flex:1; height:44px;')}">홈파티</div>
        <div class="clickable" data-action="friend" style="${boxStyle('width:56px; height:44px;')}">친구</div>
      </div>

      <div class="clickable" data-action="tokiTV" style="${boxStyle('width:100%; height:44px; margin-bottom:10px;')}">토끼TV</div>
      <div class="clickable" data-action="country" style="${boxStyle('width:100%; height:34px; margin-bottom:10px; font-size:13px;')}">전국</div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
        <div class="clickable" data-action="here" style="${boxStyle('height:52px;')}">이곳</div>
        <div class="clickable" data-action="game" style="${boxStyle('height:52px;')}">게임</div>
      </div>

      <div style="display:flex; gap:10px; font-size:12px; padding-left:6px;">
        <span class="clickable" data-action="settings">설정!</span>
        <span class="clickable" data-action="phone">전화기</span>
        <span class="clickable" data-action="boss">대장벌</span>
      </div>
    </div>

    <div id="topRight" style="${topRightStyle()}">
      <div id="coins" class="clickable" style="${coinsStyle()}">
        <span style="font-weight:1000;">b</span>
        <span style="letter-spacing:2px;">0000</span>
      </div>

      <div style="display:flex; gap:14px; align-items:center;">
        ${swatch("이벤트")}
        ${swatch("지도")}
        ${swatch("주기")}
      </div>
    </div>

    <div id="leftIcons" style="${leftIconsStyle()}">
      <div class="clickable" data-action="home" style="${circleStyle()}">⌂</div>
      <div class="clickable" data-action="talk" style="${circleStyle()}">톡</div>
    </div>

    <div id="bottomBar" class="clickable" style="${bottomBarStyle()}">
      ${navItem("shopping", "쇼핑")}
      ${navItem("couple", "커플")}
      ${navItem("green", "초록")}
      ${navItem("tangum", "탄검")}
    </div>

    <div id="broadcastBubble" class="clickable" style="${bubbleStyle()}">방송</div>
  `;

  // 이벤트 위임(메인 UI의 클릭 처리)
  const onClick = (e) => {
    const el = e.target.closest("[data-action], [data-nav]");
    if (!el) return;

    const action = el.dataset.action;
    const nav = el.dataset.nav;

    if (action) onNavigate?.(action);
    if (nav) onNavigate?.(nav);
  };

  root.addEventListener("click", onClick);

  return {
    destroy() {
      root.removeEventListener("click", onClick);
      // root.innerHTML은 index에서 비워줌
    }
  };
}

/* === 스타일 문자열 헬퍼 === */
function panelStyle() {
  return [
    "position:absolute",
    "left:18px",
    "top:70px",
    "width:42%",
    "height:34%",
    "border:2px solid #111",
    "border-radius:22px",
    "background:#fff",
    "padding:14px",
    "box-sizing:border-box",
    "pointer-events:auto",
  ].join(";");
}
function boxStyle(extra) {
  return [
    "border:2px solid #111",
    "border-radius:14px",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "font-weight:900",
    "background:#fff",
    "box-sizing:border-box",
    extra || "",
  ].join(";");
}
function topRightStyle() {
  return [
    "position:absolute",
    "right:18px",
    "top:18px",
    "width:40%",
    "display:flex",
    "flex-direction:column",
    "gap:12px",
    "align-items:flex-end",
    "pointer-events:auto",
  ].join(";");
}
function coinsStyle() {
  return [
    "width:72%",
    "height:44px",
    "border:2px solid #111",
    "border-radius:14px",
    "display:flex",
    "align-items:center",
    "justify-content:space-between",
    "padding:0 12px",
    "box-sizing:border-box",
    "font-weight:900",
    "background:#fff",
  ].join(";");
}
function swatch(label) {
  return `
    <div class="clickable" data-action="${label}" style="text-align:center; font-size:12px; font-weight:800;">
      <div style="width:44px; height:44px; border:2px solid #111; border-radius:14px; background:#fff; margin:0 auto 6px auto; box-sizing:border-box;"></div>
      ${label}
    </div>
  `;
}
function leftIconsStyle() {
  return [
    "position:absolute",
    "left:18px",
    "top:54%",
    "transform:translateY(-50%)",
    "display:flex",
    "flex-direction:column",
    "gap:14px",
    "pointer-events:auto",
  ].join(";");
}
function circleStyle() {
  return [
    "width:54px",
    "height:54px",
    "border:2px solid #111",
    "border-radius:50%",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "font-weight:1000",
    "background:#fff",
    "user-select:none",
  ].join(";");
}
function bottomBarStyle() {
  return [
    "position:absolute",
    "left:50%",
    "bottom:22px",
    "transform:translateX(-50%)",
    "width:86%",
    "height:72px",
    "border:2px solid #111",
    "border-radius:40px",
    "display:flex",
    "align-items:center",
    "justify-content:space-around",
    "background:#fff",
    "box-sizing:border-box",
    "padding:0 14px",
    "pointer-events:auto",
  ].join(";");
}
function navItem(key, label) {
  return `
    <div class="clickable" data-nav="${key}" style="${[
      "width:58px",
      "height:58px",
      "border:2px solid #111",
      "border-radius:50%",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "font-weight:1000",
      "background:#fff",
      "user-select:none",
      "box-sizing:border-box",
    ].join(";")}">${label}</div>
  `;
}
function bubbleStyle() {
  return [
    "position:absolute",
    "right:92px",
    "top:62%",
    "transform:translateY(-50%)",
    "width:34%",
    "height:18%",
    "border:2px solid #111",
    "border-radius:26px",
    "background:#fff",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "font-size:34px",
    "font-weight:1000",
    "pointer-events:auto",
    "user-select:none",
  ].join(";");
}