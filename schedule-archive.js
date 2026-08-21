/* =========================================================================
   試合日程・結果ページ（schedule.html）専用のスクリプト
   ・ホーム（index.html）の試合日程テーブルと同じ .scoreboard デザインを流用して、
     件数の上限なしに全件・日付順（1月→12月）で表示する
   ・大会名・対戦相手・会場のキーワード検索つき
   ・「今日」以降で最初に来る試合の行だけ、上の罫線を目立たせるのはホームと同じ
   ========================================================================= */
document.addEventListener('DOMContentLoaded', async () => {
  // ホーム（script.js）と同じく、Googleスプレッドシート連携があれば読み込む
  // （script.js側でも同じ読み込みを行っているが、Promiseは1回目の結果を
  //   使い回すだけなので二重に通信が走ることはない）
  if (typeof window.loadSheetsData === 'function') {
    await window.loadSheetsData();
  }

  // escapeHtml / renderNoteContent / parseDateValue / deriveSeason は common.js を使う
  const cfg = (typeof sheetsSyncConfig !== 'undefined') ? sheetsSyncConfig : {};
  const now = new Date();
  // 「今」が何年度かも自動計算する（script.jsと同じロジック：空欄・空白なら自動判定）
  const currentSeason = (cfg.currentSeason && String(cfg.currentSeason).trim())
    ? String(cfg.currentSeason).trim()
    : String(now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1);

  const body = document.getElementById('archiveScheduleBody');
  const empty = document.getElementById('archiveScheduleEmpty');
  if (!body) return;

  const scheduleSyncWarning = document.getElementById('scheduleSyncWarning');
  if (scheduleSyncWarning) scheduleSyncWarning.hidden = !(window.__scheduleSyncFailed && cfg.scheduleCsvUrl);

  const rawScheduleData = window.__syncedScheduleData || (typeof scheduleData !== 'undefined' ? scheduleData : []);
  const allSchedule = rawScheduleData
    .filter((s) => { const season = deriveSeason(s.date); return !season || season === currentSeason; })
    .sort((a, b) => (parseDateValue(a.date) ?? Infinity) - (parseDateValue(b.date) ?? Infinity)); // 1月→12月の順（日付不明は最後）

  if (allSchedule.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }

  // renderResult / renderOpponent は common.js を使う

  // 今日以降で最初に来る試合の行を探す（そこの上の罫線だけ目立たせる。ホームと同じ）
  const todayValue = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  let dividerIndex = -1;
  for (let i = 0; i < allSchedule.length; i++) {
    const v = parseDateValue(allSchedule[i].date);
    if (v !== null && v >= todayValue) { dividerIndex = i; break; }
  }

  body.innerHTML = allSchedule.map((row, i) => `
    <div class="scoreboard-row${i === dividerIndex && dividerIndex > 0 ? ' scoreboard-row--today' : ''}" role="row">
      <span role="cell" data-label="日付">${escapeHtml(row.date)}</span>
      <span role="cell" data-label="大会">${escapeHtml(row.competition)}</span>
      <span role="cell" data-label="対戦相手" class="opponent-cell">${renderOpponent(row)}</span>
      <span role="cell" data-label="結果">${renderResult(row.result)}</span>
    </div>
  `).join('');

  /* --- 「その他」シートの補足カード（Scheduleの「◯◯」） --- */
  const settings = window.__syncedSettings || {};
  const scheduleExtras = document.getElementById('pageScheduleExtras');
  if (scheduleExtras) {
    const extras = (settings.sectionExtras && settings.sectionExtras.schedule) || {};
    const labels = Object.keys(extras);
    scheduleExtras.innerHTML = labels.map((label) => {
      const item = extras[label];
      return `
        <div class="fact-card">
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(item.value)}${item.note ? `<br><span class="fact-note">${renderNoteContent(item.note)}</span>` : ''}</dd>
        </div>
      `;
    }).join('');
  }

  /* --- キーワード検索（大会名・対戦相手・会場など、カードに表示されている全文字から） --- */
  const cards = body.querySelectorAll('.scoreboard-row');
  const searchInput = document.getElementById('scheduleSearchInput');

  const applyFilters = () => {
    const query = (searchInput?.value || '').trim().toLowerCase();
    let visibleCount = 0;

    cards.forEach((card) => {
      const matches = !query || card.textContent.toLowerCase().includes(query);
      card.classList.toggle('is-hidden', !matches);
      if (matches) visibleCount += 1;
    });

    if (empty) empty.hidden = visibleCount !== 0;
  };

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }
});
