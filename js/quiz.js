/* ============================================================
 *  js/quiz.js —— 练一练（分类抽题 / 计时 / 答题卡 / 错题归档）
 * ============================================================ */
(function () {
    'use strict';
    const CHEM = window.CHEM;
    const UI = CHEM.ui;
    const esc = CHEM.util.esc;

    const LETTERS = ['A', 'B', 'C', 'D'];
    const LEVEL_STYLE = { '易': 'tag-ok', '中': '', '难': 'tag-err' };

    function freshState() {
        return { pool: [], index: 0, score: 0, answers: [], startAt: 0, timer: null, running: false, locked: false };
    }

    CHEM.pages.practice = function () {
        const rows = CHEM.DB.questions;
        if (!rows.length) { UI.panel('📝 练一练', '', UI.note('未加载题库，请检查 问题.txt', 'err')); return; }

        const types = Array.from(new Set(rows.map(q => q.type)));
        const levels = Array.from(new Set(rows.map(q => q.level || '易')));
        const st = CHEM.state.quizCfg = CHEM.state.quizCfg || { type: '全部', level: '全部', count: 10 };
        const wrongN = CHEM.wrongList().length;

        UI.panel('📝 练一练', `· 题库 ${rows.length} 题 ·`,
            `<div class="field">
                <label>类别</label>
                <select id="qzType">
                    <option value="全部">全部（${rows.length}）</option>
                    ${types.map(t => `<option value="${esc(t)}" ${t === st.type ? 'selected' : ''}>${esc(t)}（${rows.filter(q => q.type === t).length}）</option>`).join('')}
                </select>
                <label>难度</label>
                <select id="qzLevel">
                    <option value="全部">全部</option>
                    ${levels.map(l => `<option value="${esc(l)}" ${l === st.level ? 'selected' : ''}>${esc(l)}</option>`).join('')}
                </select>
                <label>题数</label>
                <input type="number" id="qzCount" value="${st.count}" min="1" max="50" style="width:80px;">
                <button class="btn btn-primary" onclick="CHEM.startPractice()">开始练习</button>
                <button class="btn" onclick="CHEM.resetPractice()">重置</button>
             </div>
             <div class="field" style="margin-bottom:6px;">
                <span class="tag">错题本 ${wrongN} 题</span>
                ${wrongN ? `<button class="btn btn-sm" onclick="CHEM.practiceWrong()">重做错题</button>
                            <button class="btn btn-sm" onclick="CHEM.go('database')">查看错题本</button>` : ''}
             </div>
             <div id="quizArea"><div class="muted" style="text-align:center;padding:36px 0;">选择类别与题数后点「开始练习」，题目随机抽取。</div></div>`);

        CHEM.quizState = freshState();
    };

    CHEM.startPractice = function (customPool) {
        const cfg = {
            type: document.getElementById('qzType') ? document.getElementById('qzType').value : '全部',
            level: document.getElementById('qzLevel') ? document.getElementById('qzLevel').value : '全部',
            count: document.getElementById('qzCount') ? parseInt(document.getElementById('qzCount').value, 10) || 10 : 10
        };
        CHEM.state.quizCfg = cfg;

        let pool = customPool || CHEM.DB.questions;
        if (!customPool) {
            if (cfg.type !== '全部') pool = pool.filter(q => q.type === cfg.type);
            if (cfg.level !== '全部') pool = pool.filter(q => (q.level || '易') === cfg.level);
        }
        if (!pool.length) { CHEM.toast('该条件下没有题目'); return; }

        const shuffled = pool.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const s = CHEM.quizState = freshState();
        s.pool = shuffled.slice(0, Math.min(cfg.count, shuffled.length));
        s.startAt = Date.now();
        s.running = true;

        if (s.timer) clearInterval(s.timer);
        s.timer = setInterval(() => {
            const el = document.getElementById('qzTimer');
            if (el) el.textContent = fmtTime(Date.now() - s.startAt);
        }, 500);

        renderQuestion();
    };

    CHEM.practiceWrong = function () {
        const wrong = CHEM.wrongList();
        if (!wrong.length) { CHEM.toast('错题本是空的'); return; }
        CHEM.pages.practice();
        setTimeout(() => CHEM.startPractice(wrong), 0);
    };

    function fmtTime(ms) {
        const s = Math.floor(ms / 1000);
        return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }

    function renderQuestion() {
        const s = CHEM.quizState;
        const area = document.getElementById('quizArea');
        if (!area) return;

        if (s.index >= s.pool.length) { renderResult(); return; }

        const q = s.pool[s.index];
        s.locked = false;
        const pct = (s.index / s.pool.length * 100).toFixed(1);

        let h = `<div class="progress-bar"><div style="width:${pct}%"></div></div>
            <div class="field" style="margin-bottom:8px;">
                <span class="gold" style="font-weight:700;">第 ${s.index + 1} / ${s.pool.length} 题</span>
                <span class="tag">${esc(q.type || '')}</span>
                <span class="tag ${LEVEL_STYLE[q.level] || ''}">${esc(q.level || '易')}</span>
                <span class="muted" style="margin-left:auto;">得分 <b class="gold">${s.score}</b>　用时 <b id="qzTimer">${fmtTime(Date.now() - s.startAt)}</b></span>
            </div>
            <div style="font-size:1.08rem;color:#f5d98a;line-height:1.8;margin:10px 0 14px;">${esc(q.question)}</div>
            <div id="qzOpts">
                ${LETTERS.map(L => `<button class="opt" data-l="${L}" onclick="CHEM.answer('${L}')"><b>${L}.</b> ${esc(q[L] || '')}</button>`).join('')}
            </div>
            <div id="qzFb" style="min-height:30px;margin-top:10px;"></div>`;
        area.innerHTML = h;
    }

    CHEM.answer = function (L) {
        const s = CHEM.quizState;
        if (!s || s.locked || s.index >= s.pool.length) return;
        s.locked = true;
        const q = s.pool[s.index];
        const correct = (q.answer || '').trim().toUpperCase() === L;
        const opts = document.querySelectorAll('#qzOpts .opt');
        opts.forEach(el => {
            el.classList.add('disabled');
            const l = el.dataset.l;
            if (l === (q.answer || '').trim().toUpperCase()) el.classList.add('correct');
            if (l === L && !correct) el.classList.add('wrong');
        });
        if (correct) s.score++;
        else CHEM.wrongAdd(q);
        s.answers.push({ q, picked: L, correct });

        const fb = document.getElementById('qzFb');
        fb.innerHTML = correct
            ? `<div class="note ok"><b>✓ 正确</b>　${esc(q.explain || '')}</div>
               <button class="btn btn-primary btn-sm" onclick="CHEM.nextQ()">下一题 →</button>`
            : `<div class="note err"><b>✗ 答错了</b>　正确答案 <b>${esc(q.answer)}</b>　${esc(q.explain || '')}</div>
               <button class="btn btn-primary btn-sm" onclick="CHEM.nextQ()">下一题 →</button>`;

        /* 自动进入下一题 */
        clearTimeout(s._adv);
        s._adv = setTimeout(() => { CHEM.nextQ(); }, 1600);
    };

    CHEM.nextQ = function () {
        const s = CHEM.quizState;
        if (!s) return;
        clearTimeout(s._adv);
        s.index++;
        renderQuestion();
    };

    function renderResult() {
        const s = CHEM.quizState;
        if (s.timer) { clearInterval(s.timer); s.timer = null; }
        s.running = false;
        const area = document.getElementById('quizArea');
        if (!area) return;
        const total = s.pool.length;
        const pct = total ? (s.score / total * 100) : 0;
        const wrong = s.answers.filter(a => !a.correct);
        const grade = pct >= 90 ? '炉火纯青' : pct >= 75 ? '渐入佳境' : pct >= 60 ? '尚可，再练' : '需从头温习';

        let h = `<div class="progress-bar"><div style="width:100%"></div></div>
            <div style="text-align:center;padding:10px 0 4px;">
                <div style="font-family:'Ma Shan Zheng',cursive;font-size:1.8rem;color:#eace9f;letter-spacing:4px;">${grade}</div>
                <div style="font-size:1.6rem;color:#f5d98a;font-weight:700;margin-top:6px;">${s.score} / ${total}　<span style="font-size:1rem;">（${pct.toFixed(1)}%）</span></div>
                <div class="muted" style="font-size:.85rem;margin-top:4px;">用时 ${fmtTime(Date.now() - s.startAt)}</div>
            </div>
            <div class="field" style="justify-content:center;margin:12px 0;">
                <button class="btn btn-primary" onclick="CHEM.startPractice()">再来一组</button>
                ${wrong.length ? `<button class="btn" onclick="CHEM.retryWrong()">重做本组错题（${wrong.length}）</button>` : ''}
                <button class="btn btn-ghost" onclick="CHEM.pages.practice()">重新设置</button>
            </div>`;

        if (wrong.length) {
            h += `<div class="divider"></div><div class="gold" style="font-size:.95rem;">本组错题</div><div class="list" style="margin-top:8px;">`;
            wrong.forEach((a, i) => {
                h += `<div class="item">
                    <div class="item-head"><span class="tag tag-err">${i + 1}</span>
                        <span style="font-size:.95rem;">${esc(a.q.question)}</span></div>
                    <div class="item-desc">你的选择 <span class="err-text">${a.picked}</span>　正确答案 <span class="ok-text">${esc(a.q.answer)}</span><br>${esc(a.q.explain || '')}</div>
                </div>`;
            });
            h += `</div>`;
        }
        area.innerHTML = h;
    }

    CHEM.retryWrong = function () {
        const s = CHEM.quizState;
        const wrong = s.answers.filter(a => !a.correct).map(a => a.q);
        if (!wrong.length) { CHEM.toast('本组没有错题'); return; }
        document.getElementById('qzCount').value = wrong.length;
        CHEM.startPractice(wrong);
    };

    CHEM.resetPractice = function () {
        const s = CHEM.quizState;
        if (s && s.timer) clearInterval(s.timer);
        CHEM.pages.practice();
    };
})();
