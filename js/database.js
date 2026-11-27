/* ============================================================
 *  js/database.js —— 数据库（统一检索 / 收藏夹 / 错题本 / 数据源）
 * ============================================================ */
(function () {
    'use strict';
    const CHEM = window.CHEM;
    const UI = CHEM.ui;
    const esc = CHEM.util.esc, store = CHEM.util.store;

    const PAGE = 80;

    /* ---------- 收藏夹 / 错题本 ---------- */
    CHEM.favList = function () { return store.get('fav', []); };
    CHEM.favAdd = function (item) {
        const list = CHEM.favList();
        const key = item.cat + '|' + item.title;
        if (list.some(x => (x.cat + '|' + x.title) === key)) return false;
        list.unshift({
            cat: item.cat, title: item.title, sub: item.sub || '',
            page: item.page || '', t: Date.now()
        });
        store.set('fav', list.slice(0, 400));
        return true;
    };
    CHEM.favRemove = function (i) {
        const list = CHEM.favList();
        list.splice(i, 1);
        store.set('fav', list);
        CHEM.pages.database();
    };
    /* 兼容旧接口 */
    CHEM.favClear = function () {
        if (!confirm('确定清空收藏夹吗？')) return;
        store.set('fav', []);
        CHEM.pages.database();
    };

    function isFav(cat, title) {
        return CHEM.favList().some(x => x.cat === cat && x.title === title);
    }

    /* ---------- 全站通用收藏按钮 ---------- */
    CHEM.favBtn = function (cat, title, sub, page) {
        const on = isFav(cat, title);
        return `<button type="button" class="fav-btn${on ? ' on' : ''}" data-fav="1"
            title="${on ? '已收藏，点击取消' : '加入收藏'}"
            data-fav-cat="${esc(cat)}" data-fav-title="${esc(title)}"
            data-fav-sub="${esc(sub || '')}" data-fav-page="${esc(page || '')}"
            onclick="event.stopPropagation();CHEM.favClick(this)">${on ? '★' : '☆'}</button>`;
    };

    CHEM.favClick = function (el) {
        const cat = el.getAttribute('data-fav-cat');
        const title = el.getAttribute('data-fav-title');
        if (!cat || !title) return;
        if (isFav(cat, title)) {
            const list = CHEM.favList();
            const idx = list.findIndex(x => x.cat === cat && x.title === title);
            if (idx >= 0) { list.splice(idx, 1); store.set('fav', list); }
            el.textContent = '☆';
            el.classList.remove('on');
            el.title = '加入收藏';
            CHEM.toast('已取消收藏');
        } else {
            CHEM.favAdd({
                cat: cat, title: title,
                sub: el.getAttribute('data-fav-sub') || '',
                page: el.getAttribute('data-fav-page') || ''
            });
            el.textContent = '★';
            el.classList.add('on');
            el.title = '已收藏，点击取消';
            CHEM.toast('已加入收藏');
        }
    };
    CHEM.wrongList = function () { return store.get('wrong', []); };
    CHEM.wrongAdd = function (q) {
        const list = CHEM.wrongList();
        if (list.some(x => x.question === q.question)) return false;
        list.unshift(Object.assign({}, q, { t: Date.now() }));
        store.set('wrong', list.slice(0, 300));
        return true;
    };
    CHEM.wrongRemove = function (i) {
        const list = CHEM.wrongList();
        list.splice(i, 1);
        store.set('wrong', list);
        CHEM.pages.database();
    };
    CHEM.wrongClear = function () {
        if (!confirm('确定清空全部错题吗？')) return;
        store.set('wrong', []);
        CHEM.pages.database();
    };

    /* ---------- 检索索引 ---------- */
    function buildRows() {
        const rows = [];
        const d = CHEM.DB;
        const push = (cat, title, sub, kw, page, detail, act, actLabel) => rows.push({
            cat: cat, title: title, sub: sub, kw: kw, page: page, detail: detail || [],
            act: act, actLabel: actLabel || '查看'
        });

        (d.elements || []).forEach(e => push('元素', `${e.symbol}　${e.name}`,
            `原子序数 ${e.num}　原子量 ${e.mass}　化合价 ${e.valence}　${e.type}`,
            `${e.symbol} ${e.name} ${e.type} ${e.valence} ${e.props}`, 'periodic',
            [['符号', e.symbol], ['名称', e.name], ['原子序数', e.num], ['相对原子质量', e.mass],
            ['化合价', e.valence], ['类别', e.type], ['周期 / 族', `${e.period} / ${e.group}`],
            ['电子排布', e.electron], ['发现年份', e.year], ['发现者', e.discoverer], ['性质', e.props]],
            `CHEM.showElement('${e.symbol}')`));

        (d.molecules || []).forEach(m => push('分子', m.name,
            `${m.formula}　Mr ${m.weight}　${m.type}　${m.desc}`,
            `${m.name} ${m.formula} ${m.type} ${m.desc}`, 'molecules',
            [['名称', m.name], ['化学式', m.formula], ['相对分子质量', m.weight], ['类别', m.type], ['说明', m.desc]]));

        (d.equations || []).forEach(e => push('方程式', e.equation, `${e.type}　${e.desc}`,
            `${e.equation} ${e.type} ${e.desc}`, 'equations',
            [['方程式', e.equation], ['类型', e.type], ['说明', e.desc]],
            `CHEM.sendToBalance('${esc(e.equation)}')`, '去配平'));

        (d.radicals || []).forEach(r => push('原子团', `${r.name}　${r.formula}`,
            `电荷 ${r.charge}　${r.desc}`, `${r.name} ${r.formula} ${r.charge} ${r.desc}`, 'radicals',
            [['名称', r.name], ['化学式', r.formula], ['电荷', r.charge], ['说明', r.desc]]));

        (d.acids || []).forEach(a => {
            let ph = '';
            try {
                const e = CHEM.acidPH ? CHEM.acidPH(a, 0.1) : null;
                if (e && isFinite(e.pH)) ph = `　pH(0.1M) ${e.pH.toFixed(2)}`;
            } catch (err) { /* 忽略 */ }
            push('酸碱', `${a.name}　${a.formula}`,
                `${a.kind}·${a.strength}　${a.pk}${ph}　共轭 ${a.conjugate}　${a.desc}`,
                `${a.name} ${a.formula} ${a.kind} ${a.strength} ${a.pk} ${a.desc} ${ph}`, 'acidbase',
                [['名称', a.name], ['化学式', a.formula], ['类别', a.kind], ['强弱', a.strength],
                ['pK', a.pk], ['0.1 mol/L 时 pH', ph.replace(/^　pH\(0\.1M\)\s*/, '') || '—'],
                ['共轭', a.conjugate], ['特性与用途', a.desc]]);
        });

        (d.organics || []).forEach(o => push('有机物', `${o.klass}　${o.example}`,
            `${o.formula}　官能团 ${o.group}　通式 ${o.general}　${o.props}`,
            `${o.klass} ${o.example} ${o.formula} ${o.group} ${o.general} ${o.props}`, 'organic',
            [['类别', o.klass], ['代表物', o.example], ['化学式', o.formula], ['官能团', o.group],
            ['通式', o.general], ['性质与用途', o.props]]));

        (d.organicReactions || []).forEach(r => push('有机反应', r.equation,
            `${r.type}　条件 ${r.condition}　${r.desc}`,
            `${r.equation} ${r.type} ${r.condition} ${r.desc}`, 'organic',
            [['方程式', r.equation], ['类型', r.type], ['条件', r.condition], ['说明', r.desc]]));

        (d.indicators || []).forEach(i => push('指示剂', `${i.name}　${i.range}`,
            `酸色 ${i.acidColor}　碱色 ${i.baseColor}　${i.use}`,
            `${i.name} ${i.range} ${i.acidColor} ${i.baseColor} ${i.use}`, 'acidbase',
            [['指示剂', i.name], ['变色范围', i.range], ['酸色', i.acidColor],
            ['碱色', i.baseColor], ['典型用途', i.use]]));

        (d.aliases || []).forEach(a => push('俗名', `${a.alias}　→　${a.chem}`,
            `${a.formula}　${a.desc}`, `${a.alias} ${a.chem} ${a.formula} ${a.desc}`, 'refs',
            [['俗名', a.alias], ['化学名称', a.chem], ['化学式', a.formula], ['说明', a.desc]]));

        (d.solubility || []).forEach(s => push('溶解性', `${s.name}　${s.formula}`,
            `${s.color}　${s.solubility}　${s.klass}　${s.desc}`,
            `${s.name} ${s.formula} ${s.color} ${s.solubility} ${s.klass} ${s.desc}`, 'refs',
            [['名称', s.name], ['化学式', s.formula], ['颜色', s.color], ['溶解性', s.solubility],
            ['类别', s.klass], ['说明', s.desc]]));

        (d.ions || []).forEach(i => push('离子检验', i.ion,
            `${i.method}　→　${i.phenomenon}　${i.desc}`,
            `${i.ion} ${i.method} ${i.phenomenon} ${i.desc}`, 'refs',
            [['离子', i.ion], ['检验方法', i.method], ['现象', i.phenomenon], ['说明', i.desc]]));

        (d.constants || []).forEach(c => push('常数', `${c.name}${c.symbol && c.symbol !== '—' ? '　' + c.symbol : ''}`,
            `${c.value} ${c.unit}　${c.klass}　${c.desc}`,
            `${c.klass} ${c.name} ${c.symbol} ${c.value} ${c.unit} ${c.desc}`, 'refs',
            [['类别', c.klass], ['名称', c.name], ['符号', c.symbol], ['数值', c.value],
            ['单位', c.unit], ['说明', c.desc]]));

        (d.experiments || []).forEach(x => push('实验', x.name,
            `${x.phenomenon}　${x.conclusion}　注意：${x.caution}`,
            `${x.name} ${x.phenomenon} ${x.conclusion} ${x.caution}`, 'refs',
            [['实验', x.name], ['现象', x.phenomenon], ['结论 / 方程式', x.conclusion], ['注意事项', x.caution]]));

        (d.reactions || []).forEach(r => push('反应现象', `${r.a} + ${r.b}`,
            `${r.phenomenon}　${r.equation}　危险度 ${r.danger}`,
            `${r.a} ${r.b} ${r.phenomenon} ${r.equation} ${r.desc} ${r.danger}`, 'lab',
            [['试剂 A', r.a], ['试剂 B', r.b], ['现象', r.phenomenon], ['方程式', r.equation],
            ['说明', r.desc], ['危险度', r.danger]],
            `CHEM.mixPreset('${esc(r.a)}','${esc(r.b)}')`, '去做实验'));

        (d.procedures || []).forEach((p, i) => push('实验流程', p.name,
            `${p.klass}　共 ${String(p.steps || '').split(/[；|]/).filter(s => s.trim()).length} 步　${p.phenomenon}`,
            `${p.name} ${p.klass} ${p.tools} ${p.steps} ${p.phenomenon} ${p.conclusion} ${p.safety}`, 'lab',
            [['实验', p.name], ['类别', p.klass], ['器材', String(p.tools || '').split('|').join('、')],
            ['步骤', String(p.steps || '').split(/[；|]/).map((s, j) => (j + 1) + '. ' + s).join('\n')],
            ['现象', p.phenomenon], ['结论 / 原理', p.conclusion], ['安全', p.safety]],
            `CHEM.flowPick(${i})`, '看步骤'));

        (d.labware || []).forEach(w => push('器材', w.name,
            `${w.klass}　${w.use}`,
            `${w.name} ${w.klass} ${w.use} ${w.points} ${w.caution}`, 'lab',
            [['名称', w.name], ['类别', w.klass], ['用途', w.use], ['使用要点', w.points], ['注意', w.caution]]));

        (d.alloys || []).forEach(a => push('合金', a.name,
            `${a.klass}　${a.composition}　${a.feature}`,
            `${a.name} ${a.klass} ${a.composition} ${a.grade} ${a.feature} ${a.use}`, 'alloy',
            [['名称', a.name], ['类别', a.klass], ['主要成分', a.composition], ['典型牌号', a.grade],
            ['密度', a.density + ' g/cm³'], ['熔点', a.melting + ' ℃'], ['特性', a.feature], ['用途', a.use]],
            `CHEM.alloyDetail('${esc(a.name)}')`, '看详情'));

        (d.alloyElements || []).forEach(e => push('合金元素', `${e.name}　${e.symbol}`,
            `${e.apply}　${e.role}　${e.effect}`,
            `${e.name} ${e.symbol} ${e.apply} ${e.role} ${e.effect} ${e.desc}`, 'alloy',
            [['元素', e.name], ['符号', e.symbol], ['主要应用', e.apply], ['作用', e.role],
            ['影响', e.effect], ['说明', e.desc]]));

        (d.phaseDiagrams || []).forEach(p => push('相图', `${p.system}　${p.type}`,
            `${p.a}—${p.b}　共晶 ${p.eutecticT} ${p.eutecticC}　${p.desc}`,
            `${p.system} ${p.type} ${p.a} ${p.b} ${p.desc}`, 'alloy',
            [['体系', p.system], ['类型', p.type], ['组元A', p.a], ['组元B', p.b],
            ['熔点A', p.mpA + ' ℃'], ['熔点B', p.mpB + ' ℃'], ['共晶温度', p.eutecticT],
            ['共晶成分', p.eutecticC], ['说明', p.desc]],
            `CHEM.phasePick('${esc(p.system)}');CHEM.go('alloy~phase')`, '看相图'));

        (d.questions || []).forEach(q => push('题目', q.question,
            `${q.type}·${q.level}　答案 ${q.answer}　${q.explain}`,
            `${q.question} ${q.type} ${q.explain}`, 'practice',
            [['类型', q.type], ['难度', q.level], ['题目', q.question],
            ['A', q.A], ['B', q.B], ['C', q.C], ['D', q.D], ['答案', q.answer], ['解析', q.explain]]));

        return rows;
    }

    let ROW_CACHE = null;
    function allRows() {
        if (!ROW_CACHE) ROW_CACHE = buildRows();
        return ROW_CACHE;
    }
    /* 数据重载后清缓存 */
    CHEM.invalidateRows = function () { ROW_CACHE = null; };

    CHEM.pages.database = function () {
        const st = CHEM.state.db = CHEM.state.db || { tab: 'search', cat: '全部', kw: '', limit: PAGE };
        if (!st.limit) st.limit = PAGE;
        const total = CHEM.totalRecords();
        const nFav = CHEM.favList().length, nWrong = CHEM.wrongList().length;
        const tabs = [
            ['search', '统一检索'],
            ['fav', '收藏夹' + (nFav ? ` (${nFav})` : '')],
            ['wrong', '错题本' + (nWrong ? ` (${nWrong})` : '')],
            ['source', '数据源']
        ];
        UI.panel('数据库', `· ${total} 条记录 ·`, UI.tabBar(tabs, st.tab, 'CHEM.dbTab') + ({
            search: searchHtml, fav: favHtml, wrong: wrongHtml, source: sourceHtml
        })[st.tab]());

        if (st.tab === 'search') {
            const el = document.getElementById('dbKw');
            if (el) {
                el.addEventListener('keydown', e => { if (e.key === 'Enter') CHEM.dbSearch(); });
            }
        }
        if (st.tab === 'fav') {
            const el = document.getElementById('favKw');
            if (el && st.favKw) {
                el.addEventListener('keydown', e => { if (e.key === 'Enter') CHEM.favSearch(); });
            }
        }
    };

    CHEM.dbTab = function (t) { CHEM.state.db.tab = t; CHEM.pages.database(); };

    /* ---------- 关键词高亮（支持空格分隔的多个词） ---------- */
    function tokens(kw) {
        return String(kw === undefined || kw === null ? '' : kw).trim().split(/\s+/).filter(Boolean);
    }
    function hl(text, kw) {
        const s = String(text === undefined || text === null ? '' : text);
        const list = Array.isArray(kw) ? kw : tokens(kw);
        if (!list.length) return esc(s);
        let re;
        try {
            re = new RegExp('(' + list.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
        } catch (e) { return esc(s); }
        let out = '', last = 0, m;
        while ((m = re.exec(s)) !== null) {
            if (m[0] === '') { re.lastIndex++; continue; }
            out += esc(s.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
            last = m.index + m[0].length;
        }
        return out + esc(s.slice(last));
    }

    /* ---------- 统一检索 ---------- */
    function searchHtml() {
        const st = CHEM.state.db;
        const all = allRows();
        const cats = ['全部'].concat(Array.from(new Set(all.map(r => r.cat))));
        const kwRaw = st.kw.trim();
        const kws = tokens(kwRaw).map(t => t.toLowerCase());

        let list = all;
        if (st.cat !== '全部') list = list.filter(r => r.cat === st.cat);
        if (kws.length) list = list.filter(r => {
            const hay = (r.title + ' ' + r.sub + ' ' + r.kw).toLowerCase();
            return kws.every(k => hay.includes(k));
        });
        CHEM.state.db._rows = list;

        const isBare = !kws.length && st.cat === '全部';
        const countOf = c => all.filter(r => r.cat === c).length;
        const hist = store.get('dbHist', []);

        return `
        <div class="field">
            <input type="text" id="dbKw" placeholder="输入关键词：硫酸钡、pH、酯化、Fe3+、胆矾、银镜、Ksp …（空格分隔多个词＝同时满足）"
                   value="${esc(st.kw)}" style="flex:3;min-width:220px;">
            <button class="btn btn-primary" onclick="CHEM.dbSearch()">检索</button>
            <button class="btn" onclick="CHEM.dbReset()">重置</button>
            ${!isBare ? `<button class="btn btn-sm" onclick="CHEM.dbExportCSV()">导出结果</button>` : ''}
        </div>
        ${hist.length && isBare ? `<div class="chip-row" style="margin-bottom:10px;">
            <span class="muted" style="font-size:.76rem;align-self:center;">最近：</span>
            ${hist.map(h => `<span class="chip" style="font-size:.76rem;" onclick="CHEM.dbHistGo('${esc(h)}')">${esc(h)}</span>`).join('')}
            <span class="chip" style="font-size:.76rem;opacity:.7;" onclick="CHEM.dbHistClear()">清空</span>
        </div>` : ''}
        <div class="chip-row" style="margin-bottom:10px;">
            ${cats.map(c => `<span class="chip ${c === st.cat ? 'on' : ''}" onclick="CHEM.dbCat('${c}')">${c}${c === '全部' ? '' : ` <span class="muted">${countOf(c)}</span>`}</span>`).join('')}
        </div>
        <div class="muted" style="font-size:.8rem;margin-bottom:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <span>${isBare ? `库中共 <b class="gold">${all.length}</b> 条记录` : `命中 <b class="gold">${list.length}</b> 条`}</span>
            ${!isBare && list.length > st.limit ? `<span>（已显示前 ${st.limit} 条）</span>` : ''}
            <span style="margin-left:auto;cursor:pointer;color:#a4884f;" onclick="CHEM.dbRandom()">🎲 随便看一条</span>
        </div>
        ${isBare ? overview(all, countOf) : ''}
        <div class="list">
            ${isBare ? '' : list.slice(0, st.limit).map((r, i) => `
                <div class="item">
                    <div class="item-head">
                        <span class="tag tag-gold">${r.cat}</span>
                        <span class="item-title mono" style="cursor:pointer;" onclick="CHEM.dbDetail(${i})">${hl(r.title, kws)}</span>
                        <span style="margin-left:auto;display:flex;gap:6px;flex:none;align-items:center;">
                            <button class="btn btn-sm" onclick="CHEM.dbDetail(${i})">详情</button>
                            ${r.act ? `<button class="btn btn-sm" onclick="${r.act}">${esc(r.actLabel || '查看')}</button>` : ''}
                            ${CHEM.favBtn(r.cat, r.title, r.sub, r.page)}
                        </span>
                    </div>
                    <div class="item-desc">${hl(r.sub, kws)}</div>
                </div>`).join('')}
        </div>
        ${(!isBare && list.length > st.limit) ? `<div style="text-align:center;margin-top:14px;">
            <button class="btn" onclick="CHEM.dbMore()">继续展开（还有 ${list.length - st.limit} 条）</button></div>` : ''}
        ${(!isBare && list.length === 0) ? UI.note('没有找到匹配的记录。多个关键词之间是「同时满足」，试试减少关键词或换更短的说法（如「胆矾」→「硫酸铜」）。', 'warn') : ''}`;
    }

    /* 记录详情：把一条数据的全部字段摊开 */
    CHEM.dbDetail = function (i) {
        const r = (CHEM.state.db._rows || [])[i];
        if (!r) return;
        const rows = (r.detail || []).filter(([, v]) => v !== undefined && v !== '' && v !== '—');
        UI.modal(`<div class="panel-title" style="font-size:1.25rem;">${esc(r.cat)}<span class="sub">记录详情</span></div>
            <div class="mono" style="font-size:1rem;color:#f4e3bb;line-height:1.8;margin-bottom:12px;overflow-wrap:anywhere;">${esc(r.title)}</div>
            ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><tbody>
                ${rows.map(([k, v]) => `<tr>
                    <td style="width:110px;color:var(--gold-dim);white-space:nowrap;">${esc(k)}</td>
                    <td style="color:var(--ink-2);line-height:1.85;white-space:pre-line;">${esc(v)}</td>
                </tr>`).join('')}
            </tbody></table></div>` : `<div class="muted">${esc(r.sub)}</div>`}
            <div class="field" style="margin-top:16px;">
                ${r.page ? `<button class="btn btn-sm" onclick="CHEM.ui.closeModal();CHEM.go('${r.page}')">前往「${esc({
            periodic: '周期表', molecules: '分子查询', equations: '方程式库', radicals: '原子团',
            acidbase: '酸碱世界', organic: '有机天地', refs: '速查手册', practice: '练一练',
            lab: '实验室', balance: '配平'
        }[r.page] || r.page)}」</button>` : ''}
                ${r.act ? `<button class="btn btn-sm" onclick="CHEM.ui.closeModal();${r.act}">${esc(r.actLabel || '查看')}</button>` : ''}
                ${CHEM.favBtn(r.cat, r.title, r.sub, r.page)}
            </div>`);
    };

    CHEM.sendToBalance = function (eq) {
        CHEM.go('balance');
        const el = document.getElementById('balInput');
        if (el) el.value = eq;
    };

    CHEM.dbHistGo = function (k) {
        CHEM.state.db.kw = k;
        CHEM.state.db.limit = PAGE;
        CHEM.pages.database();
    };
    CHEM.dbHistClear = function () {
        store.set('dbHist', []);
        CHEM.pages.database();
    };

    function overview(all, countOf) {
        const stats = CHEM.stats();
        const maxN = Math.max.apply(null, stats.map(s => s.n)) || 1;
        return `
        <div class="note">
            输入关键词即可跨库检索，或点上方的分类只看某一类。
            例：<span class="mono">硫酸钡</span>、<span class="mono">pH</span>、<span class="mono">酯化</span>、
            <span class="mono">胆矾</span>、<span class="mono">银镜</span>、<span class="mono">Ksp</span>。
            多个关键词用空格分隔表示<b>同时满足</b>，如 <span class="mono">铁 沉淀</span>。
        </div>
        <div class="stat-grid" style="margin-top:12px;">
            ${stats.map(s => `<div class="stat-card" style="cursor:pointer" onclick="CHEM.dbCat('${s.cat}')">
                <div class="n">${s.n}</div><div class="l">${s.label}</div></div>`).join('')}
        </div>
        <div class="sec-title" style="margin:20px 0 10px;">分 类 占 比</div>
        <div class="bar-list">
            ${stats.slice().sort((a, b) => b.n - a.n).map(s => `<div class="bar-row" onclick="CHEM.dbCat('${s.cat}')">
                <span class="bl">${s.label}</span>
                <span class="bar-track"><span class="bar-fill" style="width:${Math.max(2, s.n / maxN * 100).toFixed(1)}%"></span></span>
                <span class="bn">${s.n}</span>
            </div>`).join('')}
        </div>`;
    }

    CHEM.dbSearch = function () {
        const el = document.getElementById('dbKw');
        const kw = el ? el.value.trim() : '';
        CHEM.state.db.kw = kw;
        CHEM.state.db.limit = PAGE;
        if (kw) {
            const h = store.get('dbHist', []).filter(x => x !== kw);
            h.unshift(kw);
            store.set('dbHist', h.slice(0, 8));
        }
        CHEM.pages.database();
    };
    CHEM.dbCat = function (c) {
        CHEM.state.db.cat = c;
        CHEM.state.db.limit = PAGE;
        CHEM.pages.database();
    };
    CHEM.dbReset = function () {
        CHEM.state.db = { tab: 'search', cat: '全部', kw: '', limit: PAGE };
        CHEM.pages.database();
    };
    CHEM.dbMore = function () {
        CHEM.state.db.limit += PAGE;
        CHEM.pages.database();
    };
    CHEM.dbRandom = function () {
        const all = allRows();
        if (!all.length) return;
        const r = all[Math.floor(Math.random() * all.length)];
        CHEM.state.db._random = r;
        UI.modal(`<div class="panel-title" style="font-size:1.3rem;">${esc(r.cat)}<span class="sub">随机一条</span></div>
            <div class="mono" style="font-size:1.02rem;color:#f4e3bb;line-height:1.8;">${esc(r.title)}</div>
            <div class="divider"></div>
            <div style="color:#c9b795;font-size:.9rem;line-height:1.9;">${esc(r.sub)}</div>
            <div class="field" style="margin-top:16px;">
                <button class="btn btn-sm" onclick="CHEM.dbStarRandom()">收藏</button>
                <button class="btn btn-sm" onclick="CHEM.ui.closeModal();CHEM.go('${r.page}')">前往相关页面</button>
            </div>`);
    };
    CHEM.dbStarRandom = function () {
        const r = CHEM.state.db._random;
        if (!r) return;
        CHEM.toast(CHEM.favAdd({ cat: r.cat, title: r.title, sub: r.sub }) ? '已加入收藏' : '已在收藏中');
    };

    CHEM.dbStar = function (cat, title, sub) {
        CHEM.toast(CHEM.favAdd({ cat, title, sub }) ? '已加入收藏' : '已在收藏中');
    };

    /* ---------- 导出检索结果为 CSV ---------- */
    CHEM.dbExportCSV = function () {
        const rows = CHEM.state.db._rows || [];
        if (!rows.length) { CHEM.toast('当前没有结果可导出'); return; }
        const q = v => '"' + String(v === undefined || v === null ? '' : v).replace(/"/g, '""') + '"';
        const csv = '\uFEFF类别,标题,摘要\n' + rows.map(r => [r.cat, r.title, r.sub].map(q).join(',')).join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `化学数据库-检索结果-${rows.length}条.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        CHEM.toast(`已导出 ${rows.length} 条`);
    };

    /* ---------- 收藏夹 ---------- */
    function ago(t) {
        if (!t) return '';
        const d = Date.now() - t;
        if (d < 60e3) return '刚刚';
        if (d < 3600e3) return Math.floor(d / 60e3) + ' 分钟前';
        if (d < 86400e3) return Math.floor(d / 3600e3) + ' 小时前';
        if (d < 30 * 86400e3) return Math.floor(d / 86400e3) + ' 天前';
        const dt = new Date(t);
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    }

    function favHtml() {
        const list = CHEM.favList();
        const st = CHEM.state.db;
        const kw = (st.favKw || '').trim().toLowerCase();
        const cats = {};
        list.forEach(f => { cats[f.cat] = (cats[f.cat] || 0) + 1; });

        let shown = list.map((f, i) => ({ f: f, i: i }));
        if (kw) shown = shown.filter(o => (o.f.cat + o.f.title + ' ' + (o.f.sub || '')).toLowerCase().includes(kw));
        if (st.favCat) shown = shown.filter(o => o.f.cat === st.favCat);

        return `
        <div class="field">
            <input type="text" id="favKw" placeholder="在收藏里搜索 …" value="${esc(st.favKw || '')}" style="flex:2;min-width:170px;"
                   onkeydown="if(event.key==='Enter')CHEM.favSearch()">
            <button class="btn btn-primary btn-sm" onclick="CHEM.favSearch()">检索</button>
            <button class="btn btn-sm" style="margin-left:auto;" onclick="CHEM.exportJSON()">导出 JSON</button>
            ${list.length ? `<button class="btn btn-sm" onclick="CHEM.favClear()">清空</button>` : ''}
        </div>
        ${list.length ? `<div class="chip-row" style="margin-bottom:12px;">
            <span class="chip ${!st.favCat ? 'on' : ''}" onclick="CHEM.favCat('')">全部 <span class="muted">${list.length}</span></span>
            ${Object.keys(cats).map(c => `<span class="chip ${st.favCat === c ? 'on' : ''}" onclick="CHEM.favCat('${esc(c)}')">${esc(c)} <span class="muted">${cats[c]}</span></span>`).join('')}
        </div>` : ''}
        ${list.length === 0 ? UI.note('还没有收藏。元素、分子、方程式、原子团、酸碱、有机反应、速查表的每一行都带 ☆ 按钮，点一下即可收藏到这里。') :
            (shown.length === 0 ? UI.note('没有匹配的收藏项。', 'warn') : `
        <div class="list">
            ${shown.map(o => {
                const f = o.f;
                return `<div class="item">
                <div class="item-head">
                    <span class="tag tag-gold">${esc(f.cat)}</span>
                    <span class="item-title mono">${esc(f.title)}</span>
                    <span class="muted" style="font-size:.72rem;margin-left:auto;flex:none;">${ago(f.t)}</span>
                    ${f.page ? `<button class="btn btn-sm" style="flex:none;" onclick="CHEM.favOpen('${esc(f.page)}')">前往</button>` : ''}
                    <button class="btn btn-sm" style="flex:none;" onclick="CHEM.favRemove(${o.i})">删除</button>
                </div>
                ${f.sub ? `<div class="item-desc">${esc(f.sub)}</div>` : ''}
            </div>`;
            }).join('')}
        </div>`)}
        <div class="note" style="margin-top:14px;">
            收藏保存在本机浏览器（localStorage），共 ${list.length} 条 · 上限 400 条。
            清理浏览器数据会丢失，重要内容请用「导出 JSON」备份。
        </div>`;
    }
    CHEM.favSearch = function () {
        const el = document.getElementById('favKw');
        CHEM.state.db.favKw = el ? el.value.trim() : '';
        CHEM.pages.database();
    };
    CHEM.favCat = function (c) {
        CHEM.state.db.favCat = c;
        CHEM.pages.database();
    };
    CHEM.favOpen = function (page) {
        if (CHEM.pages[page]) CHEM.go(page);
    };

    /* ---------- 错题本 ---------- */
    function wrongHtml() {
        const list = CHEM.wrongList();
        return `
        <div class="field">
            <span class="muted" style="font-size:.82rem;">练习中答错的题会自动收进这里，方便回头重做。</span>
            ${list.length ? `<button class="btn btn-sm" style="margin-left:auto;" onclick="CHEM.wrongClear()">清空</button>` : ''}
        </div>
        ${list.length === 0 ? UI.note('错题本还是空的。去「练一练」做几道题吧。') : `
        <div class="list">
            ${list.map((q, i) => `<div class="item">
                <div class="item-head">
                    <span class="tag tag-gold">${esc(q.type || '')}</span>
                    <span class="tag">${esc(q.level || '')}</span>
                    <span class="item-title" style="font-weight:400;font-size:.92rem;">${esc(q.question)}</span>
                    <button class="btn btn-sm" style="margin-left:auto;flex:none;" onclick="CHEM.wrongRemove(${i})">删除</button>
                </div>
                <div class="item-desc">
                    ${['A', 'B', 'C', 'D'].map(L => q[L] ? `<span class="muted">${L}. ${esc(q[L])}　</span>` : '').join('')}
                    <br><span class="ok-text">正确答案 ${esc(q.answer)}</span>　${esc(q.explain || '')}
                </div>
            </div>`).join('')}
        </div>`}`;
    }

    /* ---------- 数据源 ---------- */
    function sourceHtml() {
        const stats = CHEM.stats();
        const total = stats.reduce((a, s) => a + s.n, 0);
        const loaded = stats.filter(s => s.n > 0).length;
        return `
        ${UI.kv([
            ['加载方式', CHEM.source === 'files' ? '实时读取同目录 txt（http/https）' : CHEM.source === 'snapshot' ? '离线快照 db.js（file:// 直接打开）' : '数据缺失'],
            ['记录总数', `${total} 条 / ${stats.length} 类（已载入 ${loaded} 类）`],
            ['方程式索引', (CHEM.eqIndex ? Object.keys(CHEM.eqIndex).length : 0) + ' 条（用于多解方程式的系数比对）'],
            ['收藏 / 错题', `${CHEM.favList().length} 条收藏 · ${CHEM.wrongList().length} 道错题（本机保存）`],
            ['字段规范', '各表首行为表头，逗号分隔，含逗号的字段用英文双引号包裹']
        ])}
        <div class="divider"></div>
        <div class="tbl-wrap tbl-scroll" style="max-height:none;">
        <table class="tbl"><thead><tr><th>数据文件</th><th>类别</th><th>条数</th><th>状态</th></tr></thead><tbody>
            ${stats.map(s => `<tr>
                <td class="mono">${s.file}</td><td>${s.label}</td><td class="num">${s.n}</td>
                <td>${s.n > 0 ? '<span class="ok-text">✓ 已载入</span>' : '<span class="err-text">✗ 缺失</span>'}</td>
            </tr>`).join('')}
            <tr><td colspan="2" style="text-align:right;color:#a4884f;">合计</td>
                <td class="num" style="color:#f4e3bb;font-weight:700;">${total}</td><td></td></tr>
        </tbody></table></div>
        <div class="note">
            <b>扩充数据</b>：直接编辑对应 txt（保持表头与列顺序），然后在仓库根目录执行
            <span class="mono">node tools/build_db.js</span> 重新生成 db.js 快照即可。运行
            <span class="mono">node tools/test_core.js</span> 可检验配平引擎是否仍正常。
        </div>
        <div class="note warn">
            直接双击 index.html 时浏览器禁止读取本地文件（fetch 被拦截），此时页面自动使用 db.js 快照；
            如需读取最新 txt，请用本地服务器：<span class="mono">python -m http.server</span> 后访问 localhost:8000。
        </div>`;
    }

    /* ---------- 导出 ---------- */
    CHEM.exportJSON = function () {
        const data = { fav: CHEM.favList(), wrong: CHEM.wrongList(), exported: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'huaxue-我的数据.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        CHEM.toast('已导出');
    };
})();
