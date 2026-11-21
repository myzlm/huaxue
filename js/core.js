/* ============================================================
 *  js/core.js  —— 化学世界 · 核心引擎
 *  数据加载 / 化学式解析 / 配平算法 / 分子量 / 通用 UI
 * ============================================================ */
(function () {
    'use strict';

    const CHEM = window.CHEM = window.CHEM || {};
    CHEM.version = '3.0';

    /* ============================================================
     *  一、数据集定义
     * ============================================================ */
    const DATASETS = [
        { file: '原子.txt', key: 'elements', min: 6, fields: ['symbol', 'name', 'num', 'mass', 'valence', 'type', 'group', 'period', 'electron', 'year', 'discoverer', 'props'], fix: r => { r.name = (r.name || '').split('(')[0].trim(); return r; } },
        { file: '方程式.txt', key: 'equations', min: 3, fields: ['type', 'equation', 'desc'] },
        { file: '分子.txt', key: 'molecules', min: 5, fields: ['name', 'formula', 'weight', 'type', 'desc'] },
        { file: '原子团.txt', key: 'radicals', min: 4, fields: ['name', 'formula', 'charge', 'desc'] },
        { file: '问题.txt', key: 'questions', min: 8, fields: ['type', 'level', 'question', 'A', 'B', 'C', 'D', 'answer', 'explain'] },
        { file: '酸碱.txt', key: 'acids', min: 5, fields: ['name', 'formula', 'kind', 'strength', 'pk', 'conjugate', 'desc'] },
        { file: '指示剂.txt', key: 'indicators', min: 4, fields: ['name', 'range', 'acidColor', 'baseColor', 'use'] },
        { file: '有机物.txt', key: 'organics', min: 5, fields: ['klass', 'example', 'formula', 'group', 'general', 'props'] },
        { file: '有机反应.txt', key: 'organicReactions', min: 4, fields: ['type', 'equation', 'condition', 'desc'] }
    ];
    CHEM.DATASETS = DATASETS;

    CHEM.DB = {
        elements: [], equations: [], molecules: [], radicals: [], questions: [],
        acids: [], indicators: [], organics: [], organicReactions: []
    };
    CHEM.WEIGHTS = {};
    CHEM.source = 'none';

    /* ============================================================
     *  二、通用工具
     * ============================================================ */
    function gcd(a, b) {
        a = Math.abs(a); b = Math.abs(b);
        while (b) { const t = b; b = a % b; a = t; }
        return a;
    }
    function lcm(a, b) { return a / gcd(a, b) * b; }

    function esc(s) {
        return String(s === undefined || s === null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function fmt(n, digits) {
        if (!isFinite(n)) return '—';
        const d = digits === undefined ? 2 : digits;
        if (Math.abs(n) >= 1e6 || (Math.abs(n) < 1e-4 && n !== 0)) return n.toExponential(2);
        return Number(n.toFixed(d)).toString();
    }

    /* localStorage 封装：不可用时（隐私模式 / file:// 受限）退回内存存储 */
    const memStore = Object.create(null);
    const store = {
        get(k, dflt) {
            try {
                const v = localStorage.getItem('huaxue.' + k);
                return v === null ? (k in memStore ? memStore[k] : dflt) : JSON.parse(v);
            } catch (e) {
                return k in memStore ? memStore[k] : dflt;
            }
        },
        set(k, v) {
            memStore[k] = v;
            try { localStorage.setItem('huaxue.' + k, JSON.stringify(v)); return true; }
            catch (e) { return false; }
        }
    };

    CHEM.util = { gcd, lcm, esc, fmt, store };

    /* ============================================================
     *  三、数据加载（txt 优先，失败退回 db.js 快照）
     * ============================================================ */
    /* fetch 的安全封装：fetch 不存在时直接失败，避免抛 ReferenceError 打断渲染 */
    CHEM.getText = function (file) {
        return new Promise((resolve, reject) => {
            if (typeof fetch !== 'function') { reject(new Error('当前环境不支持 fetch')); return; }
            fetch(encodeURI(file), { cache: 'no-cache' })
                .then(r => r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status)))
                .then(resolve, reject);
        });
    };

    function parseCSVLine(line) {
        const parts = []; let cur = ''; let inQuotes = false;
        for (const ch of line) {
            if (ch === '"') inQuotes = !inQuotes;
            else if (ch === ',' && !inQuotes) { parts.push(cur.trim()); cur = ''; }
            else cur += ch;
        }
        parts.push(cur.trim());
        return parts.map(p => p.replace(/^"|"$/g, '').trim());
    }

    function parseTable(text, ds) {
        const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim() !== '');
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const raw = parseCSVLine(lines[i]);
            if (raw.length < ds.min) continue;
            /* 兼容旧版 8 列题库 */
            if (ds.key === 'questions' && raw.length === 8) {
                rows.push({ type: raw[0], level: '易', question: raw[1], A: raw[2], B: raw[3], C: raw[4], D: raw[5], answer: raw[6], explain: raw[7] });
                continue;
            }
            const row = {};
            ds.fields.forEach((f, idx) => { row[f] = raw[idx] !== undefined ? raw[idx] : ''; });
            rows.push(ds.fix ? ds.fix(row) : row);
        }
        return rows;
    }

    function loadSnapshot() {
        return new Promise(resolve => {
            if (window.CHEM_DB && window.CHEM_DB.data) { resolve(window.CHEM_DB.data); return; }
            const s = document.createElement('script');
            s.src = 'db.js';
            s.onload = () => resolve(window.CHEM_DB && window.CHEM_DB.data ? window.CHEM_DB.data : null);
            s.onerror = () => resolve(null);
            document.head.appendChild(s);
        });
    }

    CHEM.load = async function (onProgress) {
        const db = {};
        let failed = 0;
        for (let i = 0; i < DATASETS.length; i++) {
            const ds = DATASETS[i];
            if (onProgress) onProgress(i + 1, DATASETS.length, ds.file);
            try {
                db[ds.key] = parseTable(await CHEM.getText(ds.file), ds);
                if (db[ds.key].length === 0) failed++;
            } catch (e) {
                db[ds.key] = null;
                failed++;
            }
        }
        if (failed > 0) {
            const snap = await loadSnapshot();
            if (snap) {
                DATASETS.forEach(ds => { if (!db[ds.key] || db[ds.key].length === 0) db[ds.key] = snap[ds.key] || []; });
                CHEM.source = 'snapshot';
            } else {
                DATASETS.forEach(ds => { if (!db[ds.key]) db[ds.key] = []; });
                CHEM.source = 'none';
            }
        } else {
            CHEM.source = 'files';
        }
        Object.keys(CHEM.DB).forEach(k => { CHEM.DB[k] = db[k] || []; });

        CHEM.WEIGHTS = {};
        CHEM.DB.elements.forEach(e => {
            const m = parseFloat(e.mass);
            if (!isNaN(m) && m > 0) CHEM.WEIGHTS[e.symbol] = m;
        });
        CHEM.SYMBOLS = new Set(CHEM.DB.elements.map(e => e.symbol));
        CHEM.buildIndex();
        return CHEM.DB;
    };

    /* 汇总统计，供「数据库」页使用 */
    CHEM.stats = function () {
        const d = CHEM.DB;
        return [
            { key: 'elements', label: '元素', cat: '元素', n: d.elements.length, file: '原子.txt' },
            { key: 'molecules', label: '分子', cat: '分子', n: d.molecules.length, file: '分子.txt' },
            { key: 'equations', label: '方程式', cat: '方程式', n: d.equations.length, file: '方程式.txt' },
            { key: 'radicals', label: '原子团', cat: '原子团', n: d.radicals.length, file: '原子团.txt' },
            { key: 'acids', label: '酸碱', cat: '酸碱', n: d.acids.length, file: '酸碱.txt' },
            { key: 'organics', label: '有机物类别', cat: '有机物', n: d.organics.length, file: '有机物.txt' },
            { key: 'organicReactions', label: '有机反应', cat: '有机反应', n: d.organicReactions.length, file: '有机反应.txt' },
            { key: 'indicators', label: '指示剂', cat: '指示剂', n: d.indicators.length, file: '指示剂.txt' },
            { key: 'questions', label: '题目', cat: '题目', n: d.questions.length, file: '问题.txt' }
        ];
    };

    /* ============================================================
     *  四、化学式解析
     *  支持：括号嵌套、水合物 ·、离子电荷 ^2- / Fe3+ / SO4^2-、
     *        状态符号 (aq)、(s)、上下标、全角符号、电子 e-
     * ============================================================ */

    const SUB = '₀₁₂₃₄₅₆₇₈₉';
    const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

    function normalizeFormula(raw) {
        let s = String(raw)
            .replace(/[＋]/g, '+')
            .replace(/[－−–—]/g, '-')
            .replace(/[＝]/g, '=')
            .replace(/[\u200b\u00a0]/g, '')
            .replace(/\s+/g, '');

        /* 1) 先把上标电荷（²⁻ ³⁺ ⁺）转成 ^n± 形式 */
        s = s.replace(new RegExp('([' + SUP + ']+)?([⁺⁻])', 'g'), (m, digits, sign) => {
            const d = digits ? digits.split('').map(c => SUP.indexOf(c)).join('') : '1';
            return '^' + d + (sign === '⁺' ? '+' : '-');
        });
        /* 2) 残余上标（如同位素 ¹⁴）直接去掉 */
        s = s.replace(new RegExp('[' + SUP + ']', 'g'), '');
        /* 3) 下标字母（聚合度 n、x）直接去掉 */
        s = s.replace(/[ₙₓₘ]/g, '');
        /* 4) 下标转普通数字 */
        s = s.replace(new RegExp('[' + SUB + ']', 'g'), d => String(SUB.indexOf(d)));
        return s;
    }

    /* 去掉状态符号与箭头标记 */
    function stripDecorations(s) {
        return s
            .replace(/\((?:s|l|g|aq|sln|固体|液体|气体|溶液|稀|浓)\)/gi, '')
            .replace(/[↑↓]/g, '');
    }

    /* 从式子尾部/^ 后提取电荷 */
    function extractCharge(s) {
        let charge = 0;
        const caret = s.match(/\^(\d*)([+-])/);
        if (caret) {
            charge = (caret[1] ? parseInt(caret[1], 10) : 1) * (caret[2] === '+' ? 1 : -1);
            s = s.replace(caret[0], '');
            return { body: s, charge };
        }
        const tail = s.match(/([+-])$/);
        if (tail) {
            const sign = tail[1] === '+' ? 1 : -1;
            const before = s.slice(0, -1);
            const digits = before.match(/(\d+)$/);
            if (digits) {
                const head = before.slice(0, before.length - digits[1].length);
                /* 单一元素符号 Fe3+ / Ca2+ 或括号结尾 (SO4)2- 时，数字是电荷 */
                if (/^[A-Z][a-z]?$/.test(head) || /[)\]]$/.test(head)) {
                    return { body: head, charge: sign * parseInt(digits[1], 10) };
                }
            }
            return { body: before, charge: sign };
        }
        return { body: s, charge };
    }

    /* 递归统计某一段的原子个数 */
    function countAtoms(str) {
        const out = {};
        let i = 0;
        while (i < str.length) {
            const ch = str[i];
            if (ch === '(' || ch === '[' || ch === '{') {
                const close = ch === '(' ? ')' : ch === '[' ? ']' : '}';
                let depth = 1, j = i + 1;
                while (j < str.length && depth > 0) {
                    if (str[j] === ch) depth++;
                    else if (str[j] === close) depth--;
                    j++;
                }
                if (depth !== 0) throw new Error('括号不匹配："' + str + '"');
                const inner = str.slice(i + 1, j - 1);
                const rest = str.slice(j);
                const m = rest.match(/^\d+/);
                const mult = m ? parseInt(m[0], 10) : 1;
                const sub = countAtoms(inner);
                for (const k in sub) out[k] = (out[k] || 0) + sub[k] * mult;
                i = j + (m ? m[0].length : 0);
            } else if (/[A-Z]/.test(ch)) {
                let el = ch, k = i + 1;
                while (k < str.length && /[a-z]/.test(str[k])) { el += str[k]; k++; }
                let num = '';
                while (k < str.length && /\d/.test(str[k])) { num += str[k]; k++; }
                out[el] = (out[el] || 0) + (num ? parseInt(num, 10) : 1);
                i = k;
            } else {
                i++; /* 跳过 . 数字等 */
            }
        }
        return out;
    }

    /**
     * 解析单个物种 → { counts, charge, formula }
     */
    CHEM.parseFormula = function (input) {
        let s = normalizeFormula(input);
        s = stripDecorations(s);
        if (!s) throw new Error('空的化学式');
        /* 电子 */
        if (/^e$/.test(s) || /^e-$/.test(s) || /^e-$/.test(normalizeFormula(input))) {
            return { counts: {}, charge: -1, formula: 'e-' };
        }
        const { body, charge } = extractCharge(s);
        if (!body) throw new Error('无法解析化学式："' + input + '"');

        /* 水合物：a·b 形式，首段的前导数字是系数，其余段是倍数 */
        const parts = body.split(/[·*.]/).filter(p => p !== '');
        const counts = {};
        parts.forEach((part, idx) => {
            let p = part, mult = 1;
            const m = p.match(/^(\d+)(?=[A-Za-z(\[])/);
            if (m) { mult = parseInt(m[1], 10); p = p.slice(m[1].length); }
            if (idx === 0 && m) mult = 1;         /* 首段前导数字属于反应系数，忽略 */
            const sub = countAtoms(p);
            for (const k in sub) counts[k] = (counts[k] || 0) + sub[k] * mult;
        });
        if (Object.keys(counts).length === 0 && charge === 0) {
            throw new Error('无法解析化学式："' + input + '"');
        }
        return { counts, charge, formula: String(input).trim() };
    };

    /* 美化失败时原样返回，避免展示层因脏数据崩溃 */
    CHEM.prettySafe = function (f) {
        const str = String(f === undefined || f === null ? '' : f);
        if (!/[A-Za-z]/.test(str)) return str;      /* 纯符号（如“—”）原样返回 */
        try { return CHEM.pretty(str); } catch (e) { return str; }
    };

    /* 化学式美化：数字转下标、电荷转上标 */
    function supText(d, sign) {
        const up = String(d).split('').map(c => SUP[+c]).join('');
        return (up === '¹' ? '' : up) + (sign === '+' ? '⁺' : '⁻');
    }

    CHEM.pretty = function (f) {
        const s = stripDecorations(normalizeFormula(f));
        if (s === 'e' || s === 'e-') return 'e⁻';
        const { body, charge } = extractCharge(s);
        let out = body.replace(/([A-Za-z)\]])(\d+)/g, (m, a, d) =>
            a + d.split('').map(c => SUB[+c]).join(''));
        if (charge !== 0) out += supText(String(Math.abs(charge)), charge > 0 ? '+' : '-');
        return out;
    };

    /* ============================================================
     *  五、方程式拆分
     * ============================================================ */
    function normalizeEquation(input) {
        let s = String(input)
            .replace(/[＝]/g, '=')
            .replace(/[＋]/g, '+')
            .replace(/[－−–—]/g, '-')
            .replace(/(-->|->|=>|⟶|→|⇒|⇌|⟺|<=>)/g, '→')
            .replace(/[↑↓]/g, '')
            /* 去掉热效应等附加信息 */
            .replace(/\s*(ΔH|焓变)\s*=.*$/i, '')
            .trim();

        /* "=" 有两种身份：箭头 或 有机结构式中的双键（CH2=CH2） */
        if (s.indexOf('→') === -1) {
            const idxs = [];
            for (let i = 0; i < s.length; i++) if (s[i] === '=') idxs.push(i);
            if (idxs.length === 1) {
                s = s.slice(0, idxs[0]) + '→' + s.slice(idxs[0] + 1);
            } else if (idxs.length > 1) {
                /* 两边带空格的等号最像箭头，其次是最后一个 */
                let pick = idxs.filter(i => /\s/.test(s[i - 1] || '') && /\s/.test(s[i + 1] || ''))[0];
                if (pick === undefined) pick = idxs[idxs.length - 1];
                s = s.slice(0, pick) + '→' + s.slice(pick + 1);
            }
        }
        return s;
    }

    /* 按 '+' / ' - ' 拆分一侧，区分“电荷 +”与“分隔 +” */
    function splitSide(side) {
        const terms = [];
        let cur = '';
        for (let i = 0; i < side.length; i++) {
            const ch = side[i];
            if (ch === '+') {
                const rest = side.slice(i + 1).replace(/^\s+/, '');
                if (rest === '') { cur += ch; continue; }              /* 末尾 + 是电荷 */
                if (/^[+-]/.test(rest)) { cur += ch; continue; }        /* 后面还有符号 → 当前是电荷 */
                if (/^[A-Za-z0-9(\[{]/.test(rest)) { terms.push(cur); cur = ''; continue; }
                cur += ch;
            } else if (ch === '-' && /\s$/.test(cur) && /^\s/.test(side.slice(i + 1))) {
                /* " - " 视为分隔（如 Zn - 2e⁻），孤立的减号不是电荷 */
                terms.push(cur); cur = '';
            } else {
                cur += ch;
            }
        }
        terms.push(cur);
        return terms.map(t => t.trim()).filter(Boolean);
    }

    CHEM.parseEquation = function (input) {
        const eq = normalizeEquation(input);
        if (!eq) throw new Error('请输入方程式');
        const m = eq.split('→');
        if (m.length < 2) throw new Error('缺少箭头：请用 → 或 = 连接反应物与生成物');
        if (m.length > 2) throw new Error('含有多个箭头，目前只支持一个反应方向');
        const reactants = splitSide(m[0]);
        const products = splitSide(m[1]);
        if (reactants.length === 0) throw new Error('箭头左侧没有反应物');
        if (products.length === 0) throw new Error('箭头右侧没有生成物');
        return { reactants, products, raw: String(input).trim() };
    };

    /* 取式子前导系数（用于校验模式） */
    function leadingCoef(term) {
        const t = term.trim();
        const m = t.match(/^(\d+)(?=[A-Za-z(\[])/);
        return m ? { coef: parseInt(m[1], 10), rest: t.slice(m[1].length) } : { coef: 1, rest: t };
    }
    CHEM.leadingCoef = leadingCoef;

    /* 物种指纹：忽略书写差异（下标/系数/顺序），只认元素组成与电荷 */
    function speciesSig(f) {
        try {
            const p = CHEM.parseFormula(CHEM.leadingCoef(f).rest);
            return Object.keys(p.counts).sort().map(k => k + p.counts[k]).join('') + '/' + p.charge;
        } catch (e) { return 'bad:' + String(f); }
    }
    function sigKey(rForms, pForms) {
        return rForms.map(speciesSig).sort().join('+') + '=' + pForms.map(speciesSig).sort().join('+');
    }
    CHEM.speciesSig = speciesSig;
    CHEM.sigKey = sigKey;

    /* 从方程式库建立索引：用于给出“书上那一组”系数 */
    CHEM.buildIndex = function () {
        const idx = Object.create(null);
        const add = (rows, field) => (rows || []).forEach(row => {
            const raw = row[field];
            if (!raw) return;
            /* 聚合度、示意式子（含 n、x 或中文）不计入索引 */
            if (/[ₙₓ]|nCH|nHO|nH₂O|聚酯|[\u4e00-\u9fa5]/.test(raw)) return;
            try {
                const parsed = CHEM.parseEquation(raw);
                const key = sigKey(parsed.reactants, parsed.products);
                if (idx[key]) return;
                const coef = Object.create(null);
                parsed.reactants.concat(parsed.products).forEach(t => {
                    const lc = leadingCoef(t);
                    coef[speciesSig(lc.rest)] = lc.coef;
                });
                idx[key] = { coef, raw };
            } catch (e) { /* 非标准式子（含中文、变量等）跳过 */ }
        });
        add(CHEM.DB.equations, 'equation');
        add(CHEM.DB.organicReactions, 'equation');
        CHEM.eqIndex = idx;
        return idx;
    };

    /* ============================================================
     *  六、配平算法：精确有理数高斯消元 + 零空间搜索
     * ============================================================ */
    function frac(n, d) {
        if (d === undefined) d = 1;
        if (d === 0) throw new Error('分母为零');
        if (d < 0) { n = -n; d = -d; }
        if (n === 0) return { n: 0, d: 1 };
        const g = gcd(n, d) || 1;
        return { n: n / g, d: d / g };
    }
    const fAdd = (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
    const fSub = (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
    const fMul = (a, b) => frac(a.n * b.n, a.d * b.d);
    const fDiv = (a, b) => frac(a.n * b.d, a.d * b.n);
    const fNeg = a => frac(-a.n, a.d);
    const fZero = a => a.n === 0;

    function rref(M, C) {
        const R = M.length;
        let pr = 0;
        const pivots = [];
        for (let pc = 0; pc < C && pr < R; pc++) {
            let best = -1;
            for (let r = pr; r < R; r++) if (!fZero(M[r][pc])) { best = r; break; }
            if (best === -1) continue;
            if (best !== pr) { const t = M[pr]; M[pr] = M[best]; M[best] = t; }
            const p = M[pr][pc];
            for (let c = pc; c < C; c++) M[pr][c] = fDiv(M[pr][c], p);
            for (let r = 0; r < R; r++) {
                if (r === pr) continue;
                const f = M[r][pc];
                if (!fZero(f)) for (let c = pc; c < C; c++) M[r][c] = fSub(M[r][c], fMul(f, M[pr][c]));
            }
            pivots.push(pc);
            pr++;
        }
        return { pivots, rank: pr };
    }

    /**
     * 主配平入口
     * @returns {{rCoef:number[], pCoef:number[], checks:Array, charge:{left:number,right:number}, warnings:string[]}}
     */
    CHEM.balance = function (input) {
        const { reactants, products } = CHEM.parseEquation(input);
        /* 去掉用户可能写的前导系数，配平只认化学式 */
        const rForms = reactants.map(t => leadingCoef(t).rest);
        const pForms = products.map(t => leadingCoef(t).rest);

        const rParsed = rForms.map(f => CHEM.parseFormula(f));
        const pParsed = pForms.map(f => CHEM.parseFormula(f));

        const elemSet = new Set();
        rParsed.concat(pParsed).forEach(p => Object.keys(p.counts).forEach(e => elemSet.add(e)));
        const elems = Array.from(elemSet);
        if (elems.length === 0) throw new Error('没有解析出任何元素');

        const unknown = elems.filter(e => !CHEM.WEIGHTS[e] && e !== 'e');
        if (unknown.length) throw new Error('未知元素符号：' + unknown.join('、') + '（请检查大小写或拼写）');

        const nR = rParsed.length, nP = pParsed.length, n = nR + nP;

        /* 只在一侧出现的元素 → 必然配不平，提前给出准确提示 */
        const onlyLeft = [], onlyRight = [];
        elems.forEach(e => {
            const L = rParsed.some(p => p.counts[e]);
            const R = pParsed.some(p => p.counts[e]);
            if (L && !R) onlyLeft.push(e);
            if (R && !L) onlyRight.push(e);
        });
        if (onlyLeft.length || onlyRight.length) {
            throw new Error('元素不守恒：' + (onlyLeft.length ? '左侧独有的 ' + onlyLeft.join('、') + ' ' : '') +
                (onlyRight.length ? '右侧独有的 ' + onlyRight.join('、') : '') + '——请检查是否有物质漏写');
        }

        /* 构造增广矩阵 */
        const massRows = elems.map(e => {
            const row = [];
            rParsed.forEach(p => row.push(frac(p.counts[e] || 0)));
            pParsed.forEach(p => row.push(frac(-(p.counts[e] || 0))));
            return row;
        });
        /* 电荷守恒行 */
        const hasCharge = rParsed.some(p => p.charge) || pParsed.some(p => p.charge);
        const chargeRow = hasCharge ? (() => {
            const row = [];
            rParsed.forEach(p => row.push(frac(p.charge)));
            pParsed.forEach(p => row.push(frac(-p.charge)));
            return row;
        })() : null;

        /* ---- 求解器：精确有理数消元 + 零空间搜索，返回所有正整数解 ---- */
        function solveRows(rows) {
            const M = rows.map(r => r.slice());
            const { pivots } = rref(M, n);
            const freeCols = [];
            for (let c = 0; c < n; c++) if (pivots.indexOf(c) === -1) freeCols.push(c);
            if (freeCols.length === 0) return null;

            const basis = freeCols.map(f => {
                const x = new Array(n).fill(frac(0));
                x[f] = frac(1);
                for (let r = pivots.length - 1; r >= 0; r--) {
                    const pc = pivots[r];
                    let acc = frac(0);
                    for (let c = pc + 1; c < n; c++) if (!fZero(M[r][c]) && !fZero(x[c])) acc = fAdd(acc, fMul(M[r][c], x[c]));
                    x[pc] = fNeg(acc);
                }
                return x;
            });

            const cands = [];
            const seen = Object.create(null);
            const range = freeCols.length <= 2 ? 6 : freeCols.length === 3 ? 3 : 2;

            function consider(vec) {
                const neg = vec.every(v => v.n <= 0) && vec.some(v => v.n < 0);
                const pos = vec.every(v => v.n >= 0) && vec.some(v => v.n > 0);
                if (!pos && !neg) return;
                const v = neg ? vec.map(fNeg) : vec;
                let L = 1;
                v.forEach(x => { L = lcm(L, x.d); });
                const ints = v.map(x => x.n * (L / x.d));
                let g = 0;
                ints.forEach(x => { g = gcd(g, x); });
                if (g === 0) return;
                const coef = ints.map(x => x / g);
                if (coef.some(c => c <= 0)) return;
                const key = coef.join(',');
                if (seen[key]) return;
                seen[key] = 1;
                cands.push({ coef, sum: coef.reduce((a, b) => a + b, 0), max: Math.max.apply(null, coef) });
            }
            function walk(idx, acc) {
                if (idx === basis.length) {
                    if (acc.every(fZero)) return;
                    consider(acc);
                    return;
                }
                for (let t = -range; t <= range; t++) {
                    const next = acc.map((v, i) => t === 0 ? v : fAdd(v, fMul(frac(t), basis[idx][i])));
                    walk(idx + 1, next);
                }
            }
            walk(0, new Array(n).fill(frac(0)));
            if (cands.length === 0) return null;
            cands.sort((a, b) => a.sum - b.sum || a.max - b.max);
            return { best: cands[0], all: cands, freeDim: freeCols.length };
        }

        const solved = solveRows(massRows.concat(chargeRow ? [chargeRow] : []));
        if (!solved) {
            throw new Error('找不到全部为正的整数系数——请检查物质是否写错（例如把生成物写成了反应物）');
        }

        /* ---- 优先采用方程式库中的真实系数（解决多解歧义） ---- */
        const warnings = [];
        const key = sigKey(rForms, pForms);
        const hit = CHEM.eqIndex && CHEM.eqIndex[key];
        let chosen = solved.best;

        if (hit) {
            const mapped = { r: [], p: [] };
            let ok = true;
            rForms.forEach(f => { const c = hit.coef[speciesSig(f)]; if (!c) ok = false; else mapped.r.push(c); });
            pForms.forEach(f => { const c = hit.coef[speciesSig(f)]; if (!c) ok = false; else mapped.p.push(c); });
            if (ok && mapped.r.length === nR && mapped.p.length === nP) {
                const all = mapped.r.concat(mapped.p);
                let g = 0;
                all.forEach(v => { g = gcd(g, v); });
                const coef = all.map(v => v / g);
                if (validate(coef)) {
                    chosen = { coef, sum: coef.reduce((a, b) => a + b, 0), fromDB: true };
                }
            }
        }

        function validate(coef) {
            for (const e of elems) {
                let L = 0, R = 0;
                rParsed.forEach((p, i) => L += coef[i] * (p.counts[e] || 0));
                pParsed.forEach((p, j) => R += coef[nR + j] * (p.counts[e] || 0));
                if (L !== R) return false;
            }
            let cl = 0, cr = 0;
            rParsed.forEach((p, i) => cl += coef[i] * p.charge);
            pParsed.forEach((p, j) => cr += coef[nR + j] * p.charge);
            return cl === cr;
        }

        if (solved.all.length > 1 && !chosen.fromDB) {
            warnings.push(`该反应式在数学上有 ${solved.all.length} 组系数解（仅靠元素守恒无法唯一确定），已给出系数和最小的一组；请结合反应机理核对`);
        }
        if (chosen.fromDB && solved.all.length > 1) {
            warnings.push('该反应式存在多组数学解，已采用方程式库中的实际系数');
        }

        const alternatives = solved.all.slice(0, 8).map(c => ({
            rCoef: c.coef.slice(0, nR),
            pCoef: c.coef.slice(nR),
            text: buildText(rForms, c.coef.slice(0, nR), pForms, c.coef.slice(nR))
        }));

        const rCoef = chosen.coef.slice(0, nR);
        const pCoef = chosen.coef.slice(nR);

        /* 校验 */
        const checks = elems.map(e => {
            let left = 0, right = 0;
            rParsed.forEach((p, i) => left += rCoef[i] * (p.counts[e] || 0));
            pParsed.forEach((p, j) => right += pCoef[j] * (p.counts[e] || 0));
            return { el: e, left, right, ok: left === right };
        });
        let chLeft = 0, chRight = 0;
        rParsed.forEach((p, i) => chLeft += rCoef[i] * p.charge);
        pParsed.forEach((p, j) => chRight += pCoef[j] * p.charge);
        if (chLeft !== chRight) throw new Error('电荷不守恒，配平失败');

        const masses = [];
        let massLeft = 0, massRight = 0;
        rParsed.forEach((p, i) => {
            const m = CHEM.molarMass(rForms[i]).mass;
            masses.push({ side: 'L', formula: rForms[i], coef: rCoef[i], mass: m, total: m * rCoef[i] });
            massLeft += m * rCoef[i];
        });
        pParsed.forEach((p, j) => {
            const m = CHEM.molarMass(pForms[j]).mass;
            masses.push({ side: 'R', formula: pForms[j], coef: pCoef[j], mass: m, total: m * pCoef[j] });
            massRight += m * pCoef[j];
        });

        return {
            rForms, pForms, rCoef, pCoef, checks, warnings, masses, alternatives,
            charge: { left: chLeft, right: chRight, ok: chLeft === chRight, has: hasCharge },
            massLeft, massRight,
            type: CHEM.guessType(rForms, pForms, hasCharge),
            text: buildText(rForms, rCoef, pForms, pCoef)
        };
    };

    function buildText(rForms, rCoef, pForms, pCoef) {
        const L = rForms.map((f, i) => (rCoef[i] > 1 ? rCoef[i] : '') + CHEM.pretty(f)).join(' + ');
        const R = pForms.map((f, i) => (pCoef[i] > 1 ? pCoef[i] : '') + CHEM.pretty(f)).join(' + ');
        return L + ' → ' + R;
    }

    /* 反应类型推断（启发式，仅供参考） */
    CHEM.guessType = function (rForms, pForms, hasCharge) {
        const isElement = f => {
            const p = CHEM.parseFormula(f);
            return Object.keys(p.counts).length === 1 && !p.charge;
        };
        const nR = rForms.length, nP = pForms.length;
        const hasO2 = rForms.some(f => /^O2$/i.test(f.replace(/\s/g, '')));
        if (hasO2 && pForms.some(f => /^CO2$/i.test(f)) && pForms.some(f => /^H2O$/i.test(f))) return '燃烧反应（完全燃烧）';
        if (hasCharge) {
            if (rForms.some(f => /H\+/.test(f)) && pForms.some(f => /H2O/.test(f))) return '离子反应（酸碱中和）';
            return '离子反应';
        }
        if (nR === 2 && nP === 1) return '化合反应';
        if (nR === 1 && nP >= 2) return '分解反应';
        if (nR === 2 && nP === 2) {
            const rEl = rForms.filter(isElement).length;
            const pEl = pForms.filter(isElement).length;
            if (rEl === 1 && pEl === 1) return '置换反应';
            if (rEl >= 1 && pEl === 0) return '氧化反应（单质与化合物反应）';
            if (rForms.some(f => /H2O/.test(f)) || pForms.some(f => /H2O/.test(f))) return '中和反应 / 复分解反应';
            return '复分解反应';
        }
        if (rForms.concat(pForms).some(isElement)) return '氧化还原反应（单质参与）';
        if (rForms.some(f => /OH/.test(f)) && pForms.some(f => /H2O/.test(f))) return '中和反应';
        return '复杂反应（需自行判断类型）';
    };

    /* ============================================================
     *  七、分子量与相关计算
     * ============================================================ */
    /* 中学常用近似原子量（取整规则与教材一致：Cl 取 35.5） */
    const TEXTBOOK_WEIGHTS = {
        H: 1, He: 4, Li: 7, Be: 9, B: 11, C: 12, N: 14, O: 16, F: 19, Ne: 20,
        Na: 23, Mg: 24, Al: 27, Si: 28, P: 31, S: 32, Cl: 35.5, Ar: 40,
        K: 39, Ca: 40, Mn: 55, Fe: 56, Cu: 64, Zn: 65, Ag: 108, Ba: 137, I: 127, Br: 80
    };

    CHEM.molarMass = function (formula, approx) {
        const { counts } = CHEM.parseFormula(formula);
        let mass = 0;
        const parts = [];
        const unknown = [];
        for (const el in counts) {
            let w = CHEM.WEIGHTS[el];
            if (w === undefined) { unknown.push(el); continue; }
            if (approx) w = TEXTBOOK_WEIGHTS[el] !== undefined ? TEXTBOOK_WEIGHTS[el] : Math.round(w);
            mass += w * counts[el];
            parts.push({ el, count: counts[el], weight: w, sub: w * counts[el] });
        }
        if (unknown.length) throw new Error('未知元素：' + unknown.join('、'));
        return { mass, counts, parts };
    };

    /* 不饱和度 DBE = (2C + 2 + N - H - X) / 2 */
    CHEM.dbe = function (counts) {
        const C = counts.C || 0, H = counts.H || 0, N = counts.N || 0;
        const X = (counts.F || 0) + (counts.Cl || 0) + (counts.Br || 0) + (counts.I || 0);
        if (C === 0) return null;
        return (2 * C + 2 + N - H - X) / 2;
    };

    /* ============================================================
     *  八、UI 基础设施
     * ============================================================ */
    const UI = CHEM.ui = {};

    UI.panel = function (title, sub, html) {
        const t = document.getElementById('panelTitle');
        const b = document.getElementById('panelBody');
        if (!t || !b) return;
        t.innerHTML = title + (sub ? `<span class="sub">${sub}</span>` : '');
        b.innerHTML = html;
        b.classList.remove('fade-in');
        void b.offsetWidth;
        b.classList.add('fade-in');
    };

    UI.modal = function (html) {
        const c = document.getElementById('modalContent');
        const o = document.getElementById('modalOverlay');
        if (!c || !o) return;
        c.innerHTML = html;
        o.classList.add('active');
    };
    UI.closeModal = function () {
        const o = document.getElementById('modalOverlay');
        if (o) o.classList.remove('active');
    };

    /* 子标签栏 */
    UI.tabBar = function (items, active, setterName) {
        return `<div class="tabbar">` + items.map(([k, label]) =>
            `<button class="tab ${k === active ? 'active' : ''}" onclick="${setterName}('${k}')">${label}</button>`
        ).join('') + `</div>`;
    };

    UI.note = function (text, type) {
        return `<div class="note ${type || ''}">${text}</div>`;
    };

    UI.rows = function (arr, render) { return arr.map(render).join(''); };

    UI.kv = function (pairs) {
        return `<div class="kv">` + pairs.filter(p => p[1] !== undefined && p[1] !== '')
            .map(([k, v]) => `<div class="k">${k}</div><div class="v">${v}</div>`).join('') + `</div>`;
    };

    /* 卡片式列表项 */
    UI.item = function (title, tags, desc, onclick) {
        return `<div class="item" ${onclick ? `onclick="${onclick}"` : ''}>
            <div class="item-head"><span class="item-title">${title}</span>${tags || ''}</div>
            ${desc ? `<div class="item-desc">${desc}</div>` : ''}
        </div>`;
    };

    UI.insertAtCursor = function (inputId, text) {
        const el = document.getElementById(inputId);
        if (!el) return;
        el.focus();
        const s = el.selectionStart, e = el.selectionEnd, v = el.value;
        el.value = v.slice(0, s) + text + v.slice(e);
        el.selectionStart = el.selectionEnd = s + text.length;
        el.focus();
    };
    window.insertAtCursor = UI.insertAtCursor;

    /* 公式输入工具条 */
    UI.formulaToolbar = function (inputId) {
        const sup = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻';
        const sub = '₀₁₂₃₄₅₆₇₈₉';
        const btn = (ch) => `<button class="btn-tool" onclick="insertAtCursor('${inputId}','${ch}')">${ch}</button>`;
        return `<div class="toolbar">
            <div class="toolbar-group"><label>上标</label>${sup.split('').map(btn).join('')}</div>
            <div class="toolbar-group"><label>下标</label>${sub.split('').map(btn).join('')}</div>
            <div class="toolbar-group"><label>符号</label>
                ${['→', '+', '-', '(', ')', '·', '^', '^2-', '^+'].map(btn).join('')}
            </div>
        </div>`;
    };

    /* ============================================================
     *  九、路由与初始化
     * ============================================================ */
    CHEM.pages = CHEM.pages || {};

    CHEM.go = function (key) {
        if (!CHEM.pages[key]) key = 'home';
        try {
            if (location.hash.slice(1) !== key) history.replaceState(null, '', '#' + key);
        } catch (e) { /* file:// 下部分浏览器禁止，忽略 */ }
        const fn = CHEM.pages[key];
        if (!fn) return;
        try {
            fn();
        } catch (e) {
            console.error(e);
            UI.panel('出错了', '', `<div class="note err">页面渲染失败：${esc(e.message)}</div>`);
        }
        const panel = document.getElementById('contentPanel');
        if (panel && typeof panel.scrollIntoView === 'function') {
            try { panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { /* 老浏览器忽略 */ }
        }
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.toggle('active', b.dataset.page === key));
    };
    window.CHEM_GO = CHEM.go;

    CHEM.init = async function () {
        const body = document.getElementById('panelBody');
        /* 1) 加载数据 */
        await CHEM.load((i, total, file) => {
            if (body) body.innerHTML = `<div class="loading">正在读取 <b>${file}</b> … ${i}/${total}</div>`;
        });
        /* 2) 菜单状态 */
        const badge = document.getElementById('dataBadge');
        if (badge) {
            const total = Object.keys(CHEM.DB).reduce((a, k) => a + CHEM.DB[k].length, 0);
            badge.textContent = CHEM.source === 'files' ? `数据 ${total} 条` :
                CHEM.source === 'snapshot' ? `离线快照 ${total} 条` : '数据缺失';
            badge.className = 'data-badge ' + (CHEM.source === 'none' ? 'bad' : 'ok');
            badge.title = CHEM.source === 'files' ? '已从同目录 txt 文件读取' :
                CHEM.source === 'snapshot' ? 'fetch 不可用（file:// 直接打开），已使用 db.js 快照' : '请检查数据文件';
        }
        /* 3) 首页（支持 #page 直接定位） */
        const start = (location.hash || '').replace('#', '');
        CHEM.go(CHEM.pages[start] ? start : 'home');
    };
})();
