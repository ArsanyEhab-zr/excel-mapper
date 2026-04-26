import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  Upload, ArrowRight, ArrowLeft, Download, CheckCircle2,
  FileSpreadsheet, RefreshCcw, X, AlertCircle, Plus,
  Trash2, FileText, PackageCheck, Smartphone, Monitor, Info
} from 'lucide-react';

/* ─── Helpers ─── */
const GlassCard = ({ children, className = "" }) => (
  <div className={`glass-card rounded-2xl md:rounded-3xl p-5 md:p-8 transition-all duration-300 ${className}`}>{children}</div>
);

const StepDot = ({ step, current, label }) => {
  const done = current > step, active = current === step;
  return (
    <div className={`flex flex-col items-center gap-1.5 transition-all ${active ? 'scale-110 opacity-100' : done ? 'opacity-80' : 'opacity-35'}`}>
      <div className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center font-black text-sm ${done ? 'bg-emerald-500 text-white' : active ? 'bg-emerald-600 text-white' : 'bg-white/5 text-slate-500 border border-white/10'}`}>
        {done ? <CheckCircle2 size={18}/> : step}
      </div>
      <span className="text-[10px] md:text-xs font-bold text-slate-400">{label}</span>
    </div>
  );
};

/* ─── Main Component ─── */
export default function ManualSplitter({ onGoHome }) {
  const [step, setStep]           = useState(1);
  const [fileName, setFileName]   = useState('');
  const [sheetData, setSheetData] = useState([]);   // raw rows (array of arrays)
  const [headers, setHeaders]     = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [ranges, setRanges]       = useState([{ start: 1, end: '', name: 'part_1' }]);
  const [results, setResults]     = useState([]);   // [{ name, blob, rowCount }]
  const [error, setError]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const fileRef = useRef(null);

  // ── Step 1: Parse uploaded file ──
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: 'array' });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const all = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (all.length < 2) throw new Error("الملف فارغ أو يحتوي على صف واحد فقط.");
      const hdr  = all[0];
      const rows = all.slice(1);
      setHeaders(hdr);
      setSheetData(rows);
      setTotalRows(rows.length);
      setFileName(file.name);
      setRanges([{ start: 1, end: rows.length, name: 'part_1' }]);
      setStep(2);
    } catch (err) {
      setError(err.message || "فشل قراءة الملف.");
    } finally { setLoading(false); }
  };

  // ── Step 2: Range management ──
  const updateRange = (i, field, val) => {
    setRanges(prev => {
      const copy = [...prev];
      copy[i] = { ...copy[i], [field]: field === 'name' ? val : val === '' ? '' : Math.max(1, parseInt(val) || 1) };
      return copy;
    });
  };

  const addRange = () => {
    const lastEnd = ranges.length ? (parseInt(ranges[ranges.length - 1].end) || 0) : 0;
    setRanges(prev => [...prev, { start: lastEnd + 1, end: '', name: `part_${prev.length + 1}` }]);
  };

  const removeRange = (i) => { if (ranges.length > 1) setRanges(prev => prev.filter((_, idx) => idx !== i)); };

  const validateRanges = () => {
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i];
      const s = parseInt(r.start), e = parseInt(r.end);
      if (!s || !e) return `النطاق ${i+1}: أدخل بداية ونهاية صالحتين.`;
      if (s > e) return `النطاق ${i+1}: البداية أكبر من النهاية.`;
      if (s < 1 || e > totalRows) return `النطاق ${i+1}: القيم خارج نطاق البيانات (1 - ${totalRows}).`;
      if (!r.name.trim()) return `النطاق ${i+1}: أدخل اسم ملف.`;
      // Check overlaps with all previous ranges
      for (let j = 0; j < i; j++) {
        const ps = parseInt(ranges[j].start), pe = parseInt(ranges[j].end);
        if (s <= pe && e >= ps) return `النطاق ${i+1} يتداخل مع النطاق ${j+1}.`;
      }
    }
    return null;
  };

  // ── Step 2→3: Process & generate blobs ──
  const processRanges = () => {
    const err = validateRanges();
    if (err) { setError(err); return; }
    setError(null); setLoading(true);

    // Yield to paint the spinner
    setTimeout(() => {
      try {
        const generated = ranges.map(r => {
          const s = parseInt(r.start) - 1; // 0-indexed
          const e = parseInt(r.end);       // slice end is exclusive
          const slice = sheetData.slice(s, e);
          // Build workbook
          const wsData = [headers, ...slice];
          const ws = XLSX.utils.aoa_to_sheet(wsData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Data");
          const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          return {
            name: r.name.trim().replace(/\.xlsx$/i, '') + '.xlsx',
            blob: new Blob([buf], { type: 'application/octet-stream' }),
            rowCount: slice.length
          };
        });
        setResults(generated);
        setStep(3);
      } catch (err) {
        setError("فشل في معالجة البيانات.");
      } finally { setLoading(false); }
    }, 60);
  };

  // ── Step 3: Downloads ──
  const downloadOne = (r) => saveAs(r.blob, r.name);

  const downloadAllSequential = async () => {
    setLoading(true);
    for (const r of results) {
      saveAs(r.blob, r.name);
      await new Promise(res => setTimeout(res, 900));
    }
    setLoading(false);
  };

  const downloadZip = async () => {
    setLoading(true);
    try {
      const zip = new JSZip();
      results.forEach(r => zip.file(r.name, r.blob));
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'exelar_split_files.zip');
    } catch { setError("فشل إنشاء ملف ZIP."); }
    finally { setLoading(false); }
  };

  const resetAll = () => {
    setStep(1); setSheetData([]); setHeaders([]); setTotalRows(0);
    setFileName(''); setRanges([{ start: 1, end: '', name: 'part_1' }]);
    setResults([]); setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  /* ════════════ RENDER ════════════ */
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 min-h-screen grid-bg" dir="rtl">

      {/* Top bar */}
      {onGoHome && (
        <div className="flex items-center justify-between mb-6 animate-fade-in">
          <button onClick={onGoHome} className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 font-bold text-sm bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-xl border border-white/5 hover:border-emerald-500/20 transition-all active:scale-95">
            <ArrowRight size={18}/> الرئيسية
          </button>
          <span className="text-sm font-bold text-slate-500 flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-emerald-400"/> تقسيم يدوي
          </span>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-8 animate-slide-up">
        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-2">
          تقسيم <span className="text-gradient">يدوي</span> للإكسيل
        </h2>
        <p className="text-slate-500 text-sm font-bold max-w-md mx-auto">حدد النطاقات يدوياً وسمّي كل ملف بنفسك — تحكم كامل.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-4 md:gap-8 mb-10 animate-slide-up stagger-1">
        <StepDot step={1} current={step} label="الرفع"/>
        <div className={`w-10 md:w-16 h-0.5 rounded-full transition-all ${step > 1 ? 'bg-emerald-500' : 'bg-white/5'}`}/>
        <StepDot step={2} current={step} label="النطاقات"/>
        <div className={`w-10 md:w-16 h-0.5 rounded-full transition-all ${step > 2 ? 'bg-emerald-500' : 'bg-white/5'}`}/>
        <StepDot step={3} current={step} label="التنزيل"/>
      </div>

      {/* Error toast */}
      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-start gap-3 animate-slide-up">
          <AlertCircle className="shrink-0 mt-0.5" size={18}/>
          <p className="text-sm font-bold flex-1">{error}</p>
          <button onClick={() => setError(null)} className="hover:bg-rose-500/20 p-1 rounded-lg"><X size={14}/></button>
        </div>
      )}

      {/* ═══ STEP 1: Upload ═══ */}
      {step === 1 && (
        <GlassCard className="text-center animate-slide-up stagger-2">
          <div className="p-8 md:p-14 border-2 border-dashed border-emerald-500/20 rounded-2xl hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all cursor-pointer relative group">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"/>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                {loading ? <RefreshCcw size={32} className="animate-spin"/> : <Upload size={32}/>}
              </div>
              <h3 className="text-xl font-black text-white mb-2">ارفع ملف الإكسيل</h3>
              <p className="text-slate-500 font-bold text-sm max-w-xs mx-auto">اختر ملف .xlsx أو .csv — سيتم تحليل عدد الصفوف تلقائياً.</p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* ═══ STEP 2: Define Ranges ═══ */}
      {step === 2 && (
        <div className="space-y-5 animate-slide-up stagger-2">
          {/* File info bar */}
          <GlassCard className="!p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center"><FileText size={16} className="text-emerald-400"/></div>
                <div>
                  <p className="text-xs text-slate-500 font-bold">الملف المرفوع</p>
                  <p className="text-sm font-black text-slate-200 truncate max-w-[180px] md:max-w-xs">{fileName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-black bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/15">
                  {totalRows.toLocaleString()} صف
                </span>
                <button onClick={resetAll} className="text-xs text-slate-500 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg transition-colors font-bold">تغيير</button>
              </div>
            </div>
          </GlassCard>

          {/* Range cards */}
          <GlassCard>
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/5">
              <h3 className="font-black text-white text-lg">تحديد النطاقات</h3>
              <button onClick={addRange} className="flex items-center gap-1.5 text-xs font-black text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 rounded-xl transition-colors active:scale-95">
                <Plus size={14}/> إضافة نطاق
              </button>
            </div>

            <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
              {ranges.map((r, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 hover:border-emerald-500/15 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-slate-400">النطاق {i + 1}</span>
                    {ranges.length > 1 && (
                      <button onClick={() => removeRange(i)} className="text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors">
                        <Trash2 size={14}/>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">من صف</label>
                      <input type="number" min={1} max={totalRows} value={r.start} onChange={e => updateRange(i, 'start', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-200 focus:outline-none focus:border-emerald-500/30 focus:ring-2 focus:ring-emerald-500/10"/>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">إلى صف</label>
                      <input type="number" min={1} max={totalRows} value={r.end} onChange={e => updateRange(i, 'end', e.target.value)} placeholder={String(totalRows)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-200 focus:outline-none focus:border-emerald-500/30 focus:ring-2 focus:ring-emerald-500/10"/>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">اسم الملف</label>
                      <input type="text" value={r.name} onChange={e => updateRange(i, 'name', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-200 focus:outline-none focus:border-emerald-500/30 focus:ring-2 focus:ring-emerald-500/10"/>
                    </div>
                  </div>
                  {r.start && r.end && parseInt(r.end) >= parseInt(r.start) && (
                    <p className="text-[10px] text-slate-500 font-bold mt-2 text-left">{(parseInt(r.end) - parseInt(r.start) + 1).toLocaleString()} صف</p>
                  )}
                </div>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex gap-3 mt-6 pt-4 border-t border-white/5">
              <button onClick={() => setStep(1)} className="px-5 py-3 text-sm font-bold text-slate-400 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                السابق
              </button>
              <button onClick={processRanges} disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-50">
                {loading ? <RefreshCcw size={18} className="animate-spin"/> : <CheckCircle2 size={18}/>}
                معالجة وتقسيم
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ═══ STEP 3: Results Dashboard ═══ */}
      {step === 3 && (
        <div className="space-y-5 animate-slide-up stagger-2">
          {/* Summary */}
          <GlassCard className="!p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center"><PackageCheck size={18} className="text-emerald-400"/></div>
                <div>
                  <p className="text-xs text-slate-500 font-bold">تم التقسيم بنجاح</p>
                  <p className="text-sm font-black text-white">{results.length} ملفات جاهزة</p>
                </div>
              </div>
              <button onClick={resetAll} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 px-3 py-2 rounded-lg transition-colors font-bold">
                <RefreshCcw size={12}/> بداية جديدة
              </button>
            </div>
          </GlassCard>

          {/* Individual file cards */}
          <GlassCard>
            <h3 className="font-black text-white mb-4">الملفات المُنشأة</h3>
            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-xl p-3 md:p-4 hover:border-emerald-500/15 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <FileSpreadsheet size={14} className="text-emerald-400"/>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-200 truncate">{r.name}</p>
                      <p className="text-[10px] text-slate-500 font-bold">{r.rowCount.toLocaleString()} صف</p>
                    </div>
                  </div>
                  <button onClick={() => downloadOne(r)} className="flex items-center gap-1.5 text-xs font-black text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 rounded-lg transition-colors shrink-0 active:scale-95">
                    <Download size={14}/> تنزيل
                  </button>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Global download actions */}
          <GlassCard>
            <h3 className="font-black text-white mb-1">تنزيل الكل</h3>
            <div className="flex items-start gap-2 mb-5">
              <Info size={12} className="text-slate-500 shrink-0 mt-0.5"/>
              <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                خيار "ملفات منفصلة" مناسب للهواتف القديمة التي لا تدعم فك الضغط. خيار "ZIP" أسرع لأجهزة الكمبيوتر.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={downloadAllSequential} disabled={loading}
                className="flex items-center justify-center gap-2 px-5 py-3.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-emerald-500/15 text-slate-200 font-black text-sm rounded-xl transition-all active:scale-[0.98] disabled:opacity-50">
                {loading ? <RefreshCcw size={16} className="animate-spin"/> : <Smartphone size={16} className="text-cyan-400"/>}
                ملفات منفصلة
              </button>
              <button onClick={downloadZip} disabled={loading}
                className="flex items-center justify-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl shadow-lg hover:shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50">
                {loading ? <RefreshCcw size={16} className="animate-spin"/> : <Monitor size={16}/>}
                تنزيل كـ ZIP
              </button>
            </div>
          </GlassCard>

          {/* Back to ranges */}
          <button onClick={() => { setStep(2); setResults([]); }} className="w-full text-center text-xs text-slate-500 hover:text-emerald-400 font-bold py-2 transition-colors">
            ← العودة لتعديل النطاقات
          </button>
        </div>
      )}
    </div>
  );
}
