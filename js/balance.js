/* ============================================================
 *  js/balance.js —— 化学式配平（配平 / 校验 / 分步诊断）
 * ============================================================ */
(function () {
    'use strict';
    const CHEM = window.CHEM;
    const UI = CHEM.ui;
    const esc = CHEM.util.esc, fmt = CHEM.util.fmt, gcd = CHEM.util.gcd;

    const EXAMPLES = [
        ['高锰酸钾与双氧水', 'KMnO4 + H2O2 + H2SO4 -> MnSO4 + K2SO4 + O2 + H2O'],
        ['黄铁矿焙烧', 'FeS2 + O2 -> Fe2O3 + SO2'],
        ['铜与稀硝酸', 'Cu + HNO3 -> Cu(NO3)2 + NO + H2O'],
        ['离子方程式', 'Cr2O7^2- + Fe2+ + H+ -> Cr3+ + Fe3+ + H2O'],
        ['水合物分解', 'CuSO4·5H2O -> CuSO4 + H2O'],
        ['丁烷燃烧', 'C4H10 + O2 -> CO2 + H2O'],
        ['黑火药', 'C + KNO3 + S -> K2S + N2 + CO2'],
        ['高锰酸钾受热', 'KMnO4 -> K2MnO4 + MnO2 + O2']
    ];

    CHEM.pages.balance = function () {
        UI.panel('⚡ 化学式配平', '· 元素守恒 + 电荷守恒 ·',
            `<div class="note">
                用 <b>+</b> 连接物质，<b>→</b> 或 <b>=</b> 表示箭头。支持：
                水合物 <b>CuSO4·5H2O</b>、括号嵌套 <b>Ca3(PO4)2</b>、离子电荷 <b>MnO4-</b> / <b>SO4^2-</b> / <b>Fe3+</b>、
                全角符号与上下标。写成 <b>CH2=CH2</b> 的双键不会被误认为箭头。
             </div>
             <div class="chip-row" style="margin-bottom:10px;">
                ${EXAMPLES.map(([n, e]) => `<span class="chip" onclick="CHEM.balExample('${e.replace(/'/g, "\\'")}')">${n}</span>`).join('')}
             </div>
             ${UI.formulaToolbar('balInput')}
             <div class="field">
                <label>方程式</label>
                <input type="text" id="balInput" placeholder="如 FeS2 + O2 -> Fe2O3 + SO2" style="flex:3;min-width:240px;">
             </div>
             <div class="field">
                <button class="btn btn-primary" onclick="CHEM.doBalance()">⚡ 配平</button>
                <button class="btn" onclick="CHEM.doVerify()">✓ 校验已有系数</button>
                <button class="btn btn-ghost" onclick="CHEM.balClear()">清空</button>
                <span class="muted" style="font-size:.8rem;">按 Enter 直接配平</span>
             </div>
             <div class="output" id="balOut"><span class="muted">输入方程式后点击配平</span></div>`);
        const input = document.getElementById('balInput');
        if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') CHEM.doBalance(); });
        CHEM.doBalanceLast = null;
    };

    CHEM.balExample = function (eq) {
        document.getElementById('balInput').value = eq;
        CHEM.doBalance();
    };
    CHEM.balClear = function () {
        document.getElementById('balInput').value = '';
        document.getElementById('balOut').innerHTML = '<span class="muted">已清空</span>';
        CHEM.doBalanceLast = null;
    };

    /* ---------- 配平 ---------- */
    CHEM.doBalance = function () {
        const input = document.getElementById('balInput').value.trim();
        const out = document.getElementById('balOut');
        if (!input) { out.innerHTML = '<span class="warn-text">请输入方程式</span>'; return; }
        let r;
        try {
            r = CHEM.balance(input);
        } catch (e) {
            out.innerHTML = `<div class="note err"><b>配平失败</b><br>${esc(e.message)}</div>
                <div class="muted" style="font-size:.85rem;margin-top:8px;">
                常见原因：元素符号大小写写错（如 NA 应为 Na）、物质漏写、括号不成对、箭头缺失。
                离子电荷可写作 MnO4- 或 SO4^2-。</div>`;
            return;
        }
        CHEM.doBalanceLast = r;

        let h = `<div class="note ok"><b>配平成功</b></div>`;
        h += `<div class="mono" style="font-size:1.25rem;color:#f5d98a;line-height:1.9;padding:6px 0 10px;">${r.text}</div>`;
        h += `<div class="field" style="gap:8px;">
                <span class="tag tag-gold">反应物系数 ${r.rCoef.join(' : ')}</span>
                <span class="tag tag-gold">生成物系数 ${r.pCoef.join(' : ')}</span>
                <span class="tag">${esc(r.type)}</span>
                <button class="btn btn-sm" onclick="CHEM.copyBalance()">复制</button>
                <button class="btn btn-sm" onclick="CHEM.starBalance()">☆ 收藏</button>
              </div>`;

        /* 守恒校验表 */
        h += `<div class="divider"></div><div class="gold" style="font-size:.95rem;">元素守恒检验</div>
            <div class="tbl-wrap"><table class="tbl"><thead><tr><th>元素</th><th>左侧原子数</th><th>右侧原子数</th><th>结论</th></tr></thead><tbody>`;
        r.checks.forEach(c => {
            h += `<tr><td>${c.el}</td><td class="num">${c.left}</td><td class="num">${c.right}</td>
                  <td>${c.ok ? '<span class="ok-text">✓ 守恒</span>' : '<span class="err-text">✗ 不守恒</span>'}</td></tr>`;
        });
        if (r.charge.has) {
            h += `<tr><td>电荷</td><td class="num">${r.charge.left > 0 ? '+' : ''}${r.charge.left}</td>
                  <td class="num">${r.charge.right > 0 ? '+' : ''}${r.charge.right}</td>
                  <td>${r.charge.ok ? '<span class="ok-text">✓ 守恒</span>' : '<span class="err-text">✗ 不守恒</span>'}</td></tr>`;
        }
        h += `</tbody></table></div>`;

        /* 摩尔质量与质量比 */
        if (r.masses && r.masses.length && isFinite(r.massLeft)) {
            h += `<div class="divider"></div><div class="gold" style="font-size:.95rem;">摩尔质量与质量守恒</div>
                <div class="tbl-wrap"><table class="tbl"><thead><tr><th>物质</th><th>系数</th><th>摩尔质量</th><th>质量</th></tr></thead><tbody>`;
            r.masses.forEach(m => {
                h += `<tr><td>${m.side === 'L' ? '反应物' : '生成物'} ${CHEM.pretty(m.formula)}</td>
                      <td class="num">${m.coef}</td><td class="num">${fmt(m.mass, 2)}</td><td class="num">${fmt(m.total, 2)}</td></tr>`;
            });
            h += `</tbody></table></div>
                <div class="muted" style="font-size:.85rem;margin-top:6px;">
                  反应物总质量 ${fmt(r.massLeft, 2)} ／ 生成物总质量 ${fmt(r.massRight, 2)}
                  （按各物种 1 mol 计，主要用于核对质量守恒与估算投料比）
                </div>`;
        }

        /* 多解提示 */
        if (r.alternatives && r.alternatives.length > 1) {
            h += `<div class="divider"></div><div class="gold" style="font-size:.95rem;">其他数学上可行的系数组合</div>
                <div class="muted" style="font-size:.82rem;margin:4px 0 8px;">仅靠元素守恒无法唯一确定时，需结合反应机理判断；下表列出全部可行解。</div>`;
            r.alternatives.forEach((a, i) => {
                h += `<div class="item" style="border-left-color:${i === 0 ? '#7ac77a' : '#5a3f22'}">
                        <span class="mono" style="color:${i === 0 ? '#c8e6a0' : '#d4c09a'};">${a.text}</span>
                      </div>`;
            });
        }

        r.warnings.forEach(w => { h += `<div class="note warn">${esc(w)}</div>`; });
        out.innerHTML = h;
    };

    CHEM.copyBalance = function () {
        const r = CHEM.doBalanceLast;
        if (!r) return;
        const txt = r.text;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(txt).then(() => CHEM.toast('已复制到剪贴板')).catch(() => CHEM.toast('复制失败'));
        } else {
            CHEM.toast('该浏览器不支持自动复制');
        }
    };

    CHEM.starBalance = function () {
        const r = CHEM.doBalanceLast;
        if (!r) return;
        const added = CHEM.favAdd({ cat: '方程式', title: r.text, sub: r.type, page: 'balance' });
        CHEM.toast(added ? '已加入收藏' : '已在收藏中');
    };

    /* ---------- 校验已有系数 ---------- */
    CHEM.doVerify = function () {
        const input = document.getElementById('balInput').value.trim();
        const out = document.getElementById('balOut');
        if (!input) { out.innerHTML = '<span class="warn-text">请输入方程式</span>'; return; }
        let parsed, r;
        try {
            parsed = CHEM.parseEquation(input);
            r = CHEM.balance(input);
        } catch (e) {
            out.innerHTML = `<div class="note err">${esc(e.message)}</div>`;
            return;
        }
        const given = parsed.reactants.concat(parsed.products).map(t => CHEM.leadingCoef(t).coef);
        const expected = r.rCoef.concat(r.pCoef);
        let g = 0;
        given.forEach(v => { g = gcd(g, v); });
        g = g || 1;
        const norm = given.map(v => v / g);
        const ok = norm.length === expected.length && norm.every((v, i) => v === expected[i]);

        let h = '';
        if (ok) {
            h += `<div class="note ok"><b>✓ 系数正确</b>：你写的系数与守恒解一致（成比例即可）。</div>`;
        } else {
            h += `<div class="note err"><b>✗ 系数不正确</b>：当前写法不满足元素/电荷守恒。</div>`;
            h += `${UI.kv([['你的系数', given.join(' : ')], ['正确系数', expected.join(' : ')]])}`;
        }
        h += `<div class="divider"></div><div class="gold">标准答案</div>
              <div class="mono" style="font-size:1.15rem;color:#f5d98a;padding:6px 0;">${r.text}</div>
              <div class="muted" style="font-size:.85rem;">反应类型判断：${esc(r.type)}</div>`;
        out.innerHTML = h;
    };

    /* ---------- 轻提示 ---------- */
    CHEM.toast = function (msg) {
        let el = document.getElementById('chemToast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'chemToast';
            el.style.cssText = 'position:fixed;left:50%;bottom:36px;transform:translateX(-50%);background:#3d2b18;border:1px solid #c9a86a;color:#eace9f;padding:8px 20px;border-radius:20px;font-size:.85rem;z-index:1000;box-shadow:0 8px 24px rgba(0,0,0,.6);transition:opacity .3s;';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.opacity = '1';
        clearTimeout(el._t);
        el._t = setTimeout(() => { el.style.opacity = '0'; }, 1600);
    };
})();
