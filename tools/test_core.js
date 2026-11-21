#!/usr/bin/env node
/* ============================================================
 *  tools/test_core.js  —— 核心引擎自测（node 环境，无需浏览器）
 *  用法：node tools/test_core.js
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

global.window = global;
global.document = { getElementById: () => null, createElement: () => ({}), head: { appendChild() { } }, querySelectorAll: () => [] };
global.fetch = async () => { throw new Error('no fetch in test'); };
global.localStorage = { getItem: () => null, setItem() { } };

/* 载入 db.js 里的数据快照 */
eval(fs.readFileSync(path.join(ROOT, 'db.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/core.js'), 'utf8'));

const CHEM = global.CHEM;
const DB = global.CHEM_DB.data;

/* 用快照填充权重（跳过异步 load） */
CHEM.DB = DB;
CHEM.WEIGHTS = {};
DB.elements.forEach(e => {
    const m = parseFloat(e.mass);
    if (!isNaN(m) && m > 0) CHEM.WEIGHTS[e.symbol] = m;
});
CHEM.buildIndex();

let pass = 0, fail = 0;
const fails = [];
function check(name, fn) {
    try {
        const msg = fn();
        pass++;
        if (process.env.VERBOSE) console.log('  ✓ ' + name + (msg ? '  ' + msg : ''));
    } catch (e) {
        fail++;
        fails.push(name + ' → ' + e.message);
        console.log('  ✗ ' + name + '  ' + e.message);
    }
}
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || '') + ' 期望 ' + JSON.stringify(b) + ' 实际 ' + JSON.stringify(a));
}

/* ---------- 1. 化学式解析 ---------- */
console.log('\n[1] 化学式解析');
check('H2O', () => eq(CHEM.parseFormula('H2O').counts, { H: 2, O: 1 }));
check('Ca(OH)2', () => eq(CHEM.parseFormula('Ca(OH)2').counts, { Ca: 1, O: 2, H: 2 }));
check('Al2(SO4)3', () => eq(CHEM.parseFormula('Al2(SO4)3').counts, { Al: 2, S: 3, O: 12 }));
check('CuSO4·5H2O', () => eq(CHEM.parseFormula('CuSO4·5H2O').counts, { Cu: 1, S: 1, O: 9, H: 10 }));
check('K4[Fe(CN)6]', () => eq(CHEM.parseFormula('K4[Fe(CN)6]').counts, { K: 4, Fe: 1, C: 6, N: 6 }));
check('水合物 Na2CO3·10H2O', () => eq(CHEM.parseFormula('Na2CO3·10H2O').counts, { Na: 2, C: 1, O: 13, H: 20 }));
check('MnO4- 电荷', () => eq(CHEM.parseFormula('MnO4-').charge, -1));
check('Fe3+ 电荷', () => eq(CHEM.parseFormula('Fe3+').charge, 3));
check('Fe3+ 元素', () => eq(CHEM.parseFormula('Fe3+').counts, { Fe: 1 }));
check('SO4^2- 电荷', () => eq(CHEM.parseFormula('SO4^2-').charge, -2));
check('SO₄²⁻ 上标电荷', () => eq(CHEM.parseFormula('SO₄²⁻').charge, -2));
check('SO₄²⁻ 计数', () => eq(CHEM.parseFormula('SO₄²⁻').counts, { S: 1, O: 4 }));
check('NH4+ 电荷为1', () => eq(CHEM.parseFormula('NH4+').charge, 1));
check('NH4+ 计数', () => eq(CHEM.parseFormula('NH4+').counts, { N: 1, H: 4 }));
check('Ca2+ 电荷', () => eq(CHEM.parseFormula('Ca2+').charge, 2));
check('OH- 电荷', () => eq(CHEM.parseFormula('OH-').charge, -1));
check('e- 电子', () => { const p = CHEM.parseFormula('e-'); eq(p.charge, -1); eq(p.counts, {}); });
check('状态符号 CuSO4(aq)', () => eq(CHEM.parseFormula('CuSO4(aq)').counts, { Cu: 1, S: 1, O: 4 }));
check('前导系数 2H2O', () => eq(CHEM.parseFormula('2H2O').counts, { H: 2, O: 1 }));
check('括号不匹配报错', () => {
    let ok = false;
    try { CHEM.parseFormula('Ca(OH2'); } catch (e) { ok = true; }
    if (!ok) throw new Error('应当报错');
});
check('美化 H2O', () => eq(CHEM.pretty('H2O'), 'H₂O'));
check('美化 Fe3+', () => eq(CHEM.pretty('Fe3+'), 'Fe³⁺'));
check('美化 MnO4-', () => eq(CHEM.pretty('MnO4-'), 'MnO₄⁻'));
check('美化 SO4^2-', () => eq(CHEM.pretty('SO4^2-'), 'SO₄²⁻'));

/* ---------- 2. 分子量 ---------- */
console.log('\n[2] 分子量');
check('H2O = 18.015', () => { const m = CHEM.molarMass('H2O').mass; if (Math.abs(m - 18.015) > 0.01) throw new Error('得到 ' + m); });
check('H2SO4 ≈ 98', () => { const m = CHEM.molarMass('H2SO4', true).mass; eq(m, 98); });
check('NaCl 近似 58.5', () => { const m = CHEM.molarMass('NaCl', true).mass; eq(m, 58.5); });
check('C6H12O6 近似 180', () => { const m = CHEM.molarMass('C6H12O6', true).mass; eq(m, 180); });
check('CuSO4·5H2O 近似 250', () => { const m = CHEM.molarMass('CuSO4·5H2O', true).mass; eq(m, 250); });

/* ---------- 3. 配平 ---------- */
console.log('\n[3] 配平');

function coefs(input) {
    const r = CHEM.balance(input);
    return r.rCoef.concat(r.pCoef);
}

const BALANCE_CASES = [
    ['H2 + O2 -> H2O', [2, 1, 2]],
    ['Fe + O2 -> Fe3O4', [3, 2, 1]],
    ['Al + HCl -> AlCl3 + H2', [2, 6, 2, 3]],
    ['KClO3 -> KCl + O2', [2, 2, 3]],
    ['Fe2O3 + CO -> Fe + CO2', [1, 3, 2, 3]],
    ['CH4 + O2 -> CO2 + H2O', [1, 2, 1, 2]],
    ['C2H5OH + O2 -> CO2 + H2O', [1, 3, 2, 3]],
    ['Cu + HNO3 -> Cu(NO3)2 + NO + H2O', [3, 8, 3, 2, 4]],
    ['KMnO4 + HCl -> KCl + MnCl2 + Cl2 + H2O', [2, 16, 2, 2, 5, 8]],
    ['KMnO4 + H2O2 + H2SO4 -> MnSO4 + K2SO4 + O2 + H2O', [2, 5, 3, 2, 1, 5, 8]],
    ['CuSO4·5H2O -> CuSO4 + H2O', [1, 1, 5]],
    ['Fe + H2O -> Fe3O4 + H2', [3, 4, 1, 4]],
    ['NaOH + H2SO4 -> Na2SO4 + H2O', [2, 1, 1, 2]],
    ['Ca(OH)2 + CO2 -> CaCO3 + H2O', [1, 1, 1, 1]],
    ['C3H8 + O2 -> CO2 + H2O', [1, 5, 3, 4]],
    ['FeS2 + O2 -> Fe2O3 + SO2', [4, 11, 2, 8]],
    ['NH3 + O2 -> NO + H2O', [4, 5, 4, 6]],
    ['Al2(SO4)3 + NaOH -> Al(OH)3 + Na2SO4', [1, 6, 2, 3]],
    ['Na2CO3 + HCl -> NaCl + H2O + CO2', [1, 2, 2, 1, 1]],
    ['P4 + O2 -> P2O5', [1, 5, 2]],
    ['C6H12O6 + O2 -> CO2 + H2O', [1, 6, 6, 6]],
    ['Cu + AgNO3 -> Cu(NO3)2 + Ag', [1, 2, 1, 2]],
    ['CH3COOH + C2H5OH -> CH3COOC2H5 + H2O', [1, 1, 1, 1]],
    ['Ca3(PO4)2 + H2SO4 -> CaSO4 + H3PO4', [1, 3, 3, 2]],
    ['Fe(OH)3 + HCl -> FeCl3 + H2O', [1, 3, 1, 3]],
    ['Mg + O2 -> MgO', [2, 1, 2]],
    ['N2 + H2 -> NH3', [1, 3, 2]],
    ['H2S + O2 -> SO2 + H2O', [2, 3, 2, 2]],
    /* 离子方程式：需要电荷守恒行 */
    ['MnO4- + Fe2+ + H+ -> Mn2+ + Fe3+ + H2O', [1, 5, 8, 1, 5, 4]],
    ['Cr2O7^2- + Fe2+ + H+ -> Cr3+ + Fe3+ + H2O', [1, 6, 14, 2, 6, 7]],
    ['H+ + OH- -> H2O', [1, 1, 1]],
    ['Zn + H+ -> Zn2+ + H2', [1, 2, 1, 1]],
    ['Cl2 + OH- -> Cl- + ClO- + H2O', [1, 2, 1, 1, 1]],
    /* 无空格、全角、下标、等号混写 */
    ['KMnO4+H2O2+H2SO4=MnSO4+K2SO4+O2+H2O', [2, 5, 3, 2, 1, 5, 8]],
    ['H₂ + O₂ → H₂O', [2, 1, 2]],
    ['Na2CO3＋HCl＝NaCl＋H2O＋CO2', [1, 2, 2, 1, 1]],
    /* 已带系数的方程式也应被重新归一化 */
    ['2H2 + O2 -> 2H2O', [2, 1, 2]],
    ['4Fe + 3O2 -> 2Fe2O3', [4, 3, 2]]
];

BALANCE_CASES.forEach(([input, expected]) => {
    check('配平 ' + input, () => eq(coefs(input), expected));
});

/* ---------- 4. 错误诊断 ---------- */
console.log('\n[4] 错误诊断');
function expectError(input, keyword) {
    try {
        CHEM.balance(input);
        throw new Error('应当报错但没有');
    } catch (e) {
        if (/应当报错/.test(e.message)) throw e;
        if (keyword && e.message.indexOf(keyword) === -1) throw new Error('错误信息不含「' + keyword + '」：' + e.message);
    }
}
check('缺少箭头', () => expectError('H2 + O2', '箭头'));
check('未知元素 Xx', () => expectError('Xx + O2 -> XxO2', '未知元素'));
check('元素不守恒', () => expectError('H2 + O2 -> H2O + N2', '不守恒'));
check('括号不匹配', () => expectError('Ca(OH2 -> CaO + H2O', '括号'));

/* ---------- 5. 反应类型推断 ---------- */
console.log('\n[5] 反应类型');
check('化合', () => { const r = CHEM.balance('2H2 + O2 -> 2H2O'); eq(r.type, '化合反应'); });
check('分解', () => { const r = CHEM.balance('2KClO3 -> 2KCl + 3O2'); eq(r.type, '分解反应'); });
check('置换', () => { const r = CHEM.balance('Fe + CuSO4 -> FeSO4 + Cu'); eq(r.type, '置换反应'); });
check('燃烧', () => { const r = CHEM.balance('CH4 + O2 -> CO2 + H2O'); if (r.type.indexOf('燃烧') === -1) throw new Error(r.type); });

/* ---------- 6. 数据集回归：把 txt 里的方程式全跑一遍 ---------- */
console.log('\n[6] 数据集回归（方程式.txt + 有机反应.txt）');
let dsTotal = 0, dsFail = 0;
const dsFails = [];
function runDataset(rows, field, name) {
    rows.forEach(r => {
        const raw = r[field];
        if (!raw || raw.indexOf('→') === -1 && raw.indexOf('->') === -1 && raw.indexOf('⇌') === -1) return;
        /* 跳过非化学计量式子：中文、聚合物、变量、半反应 */
        if (/[\u4e00-\u9fa5]/.test(raw)) return;
        if (/xH2O|\]n|nCH|聚酯|nH₂O/i.test(raw)) return;
        if (/e⁻|e-\s*→|→.*e⁻/.test(raw)) return;
        dsTotal++;
        try {
            CHEM.balance(raw);
        } catch (e) {
            dsFail++;
            dsFails.push(name + ' | ' + raw + ' → ' + e.message);
        }
    });
}
runDataset(DB.equations, 'equation', '方程式');
runDataset(DB.organicReactions, 'equation', '有机反应');
console.log(`  共测试 ${dsTotal} 条，失败 ${dsFail} 条`);
dsFails.forEach(f => console.log('    ! ' + f));

/* ---------- 汇总 ---------- */
console.log(`\n结果：通过 ${pass}，失败 ${fail}`);
if (fails.length) fails.forEach(f => console.log('  ' + f));
process.exitCode = fail ? 1 : 0;
