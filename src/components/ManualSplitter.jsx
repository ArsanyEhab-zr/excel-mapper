import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Upload, ArrowRight, ArrowLeft, Download, CheckCircle2, FileSpreadsheet, RefreshCcw, X, AlertCircle, Plus, Trash2, FileText, PackageCheck, Smartphone, Monitor, Info, Link2, ChevronDown } from 'lucide-react';

const GlassCard = ({ children, className = "" }) => (
  <div className={`glass-card rounded-2xl md:rounded-3xl p-5 md:p-8 transition-all duration-300 ${className}`}>{children}</div>
);
const StepDot = ({ step, current, label }) => {
  const done = current > step, active = current === step;
  return (
    <div className={`flex flex-col items-center gap-1 transition-all ${active?'scale-110 opacity-100':done?'opacity-80':'opacity-35'}`}>
      <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center font-black text-xs ${done?'bg-emerald-500 text-white':active?'bg-emerald-600 text-white':'bg-white/5 text-slate-500 border border-white/10'}`}>
        {done ? <CheckCircle2 size={16}/> : step}
      </div>
      <span className="text-[9px] md:text-[10px] font-bold text-slate-400">{label}</span>
    </div>
  );
};
const Connector = ({active}) => <div className={`w-6 md:w-10 h-0.5 rounded-full transition-all ${active?'bg-emerald-500':'bg-white/5'}`}/>;

export default function ManualSplitter({ onGoHome }) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [sheetData, setSheetData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  // Each range: { start, end, name, templateHeaders:[]|null, mappings:{tCol:srcCol} }
  const [ranges, setRanges] = useState([{ start:1, end:'', name:'part_1', templateHeaders:null, mappings:{} }]);
  const [activeMapIdx, setActiveMapIdx] = useState(null); // which range is being mapped
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);
  const tplRef = useRef(null);

  const newRange = (n) => ({ start:'', end:'', name:`part_${n}`, templateHeaders:null, mappings:{} });

  // Step 1
  const handleUpload = async (e) => {
    const file = e.target.files?.[0]; if(!file) return;
    setLoading(true); setError(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), {type:'array'});
      const all = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1});
      if(all.length<2) throw new Error("الملف فارغ.");
      setHeaders(all[0]); setSheetData(all.slice(1)); setTotalRows(all.slice(1).length);
      setFileName(file.name); setRanges([{start:1, end:all.slice(1).length, name:'part_1', templateHeaders:null, mappings:{}}]);
      setStep(2);
    } catch(err){ setError(err.message||"فشل قراءة الملف."); }
    finally{ setLoading(false); }
  };

  // Step 2: range ops
  const updateRange = (i,f,v) => setRanges(p => { const c=[...p]; c[i]={...c[i],[f]:f==='name'?v:v===''?'':Math.max(1,parseInt(v)||1)}; return c; });
  const addRange = () => { const le = ranges.length?(parseInt(ranges[ranges.length-1].end)||0):0; setRanges(p=>[...p,{...newRange(p.length+1), start:le+1}]); };
  const removeRange = (i) => { if(ranges.length>1) setRanges(p=>p.filter((_,j)=>j!==i)); };

  // Template upload per range
  const handleTemplateUpload = async (e, idx) => {
    const file = e.target.files?.[0]; if(!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), {type:'array'});
      const row0 = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1})[0];
      if(!row0?.length) throw new Error("التمبليت فارغ.");
      const tCols = row0.map(h=>String(h));
      // auto-map matching columns
      const autoMap = {};
      tCols.forEach(t => { const m = headers.find(s=>String(s).toLowerCase().trim()===t.toLowerCase().trim()); autoMap[t]=m?String(m):''; });
      setRanges(p => { const c=[...p]; c[idx]={...c[idx], templateHeaders:tCols, mappings:autoMap}; return c; });
    } catch(err){ setError(err.message); }
    if(tplRef.current) tplRef.current.value='';
  };

  const clearTemplate = (idx) => setRanges(p => { const c=[...p]; c[idx]={...c[idx], templateHeaders:null, mappings:{}}; return c; });
  const updateMapping = (rIdx, tCol, sCol) => setRanges(p => { const c=[...p]; c[rIdx]={...c[rIdx], mappings:{...c[rIdx].mappings,[tCol]:sCol}}; return c; });

  const validateRanges = () => {
    for(let i=0;i<ranges.length;i++){
      const r=ranges[i], s=parseInt(r.start), e=parseInt(r.end);
      if(!s||!e) return `النطاق ${i+1}: أدخل بداية ونهاية.`;
      if(s>e) return `النطاق ${i+1}: البداية أكبر من النهاية.`;
      if(s<1||e>totalRows) return `النطاق ${i+1}: خارج النطاق (1-${totalRows}).`;
      if(!r.name.trim()) return `النطاق ${i+1}: أدخل اسم ملف.`;
      for(let j=0;j<i;j++){ const ps=parseInt(ranges[j].start),pe=parseInt(ranges[j].end); if(s<=pe&&e>=ps) return `النطاق ${i+1} يتداخل مع ${j+1}.`; }
    }
    return null;
  };

  // Step 2→3: Process
  const processRanges = () => {
    const err=validateRanges(); if(err){setError(err);return;}
    setError(null); setLoading(true);
    setTimeout(()=>{
      try {
        const generated = ranges.map(r => {
          const slice = sheetData.slice(parseInt(r.start)-1, parseInt(r.end));
          let wsData;
          if(r.templateHeaders) {
            // Map data to template columns
            const mapped = slice.map(row => {
              const obj = {}; headers.forEach((h,ci) => obj[String(h)]=row[ci]??'');
              return r.templateHeaders.map(tCol => { const src=r.mappings[tCol]; return src ? (obj[src]??'') : ''; });
            });
            wsData = [r.templateHeaders, ...mapped];
          } else {
            wsData = [headers, ...slice];
          }
          const ws=XLSX.utils.aoa_to_sheet(wsData); const wb=XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb,ws,"Data");
          const buf=XLSX.write(wb,{bookType:'xlsx',type:'array'});
          return { name:r.name.trim().replace(/\.xlsx$/i,'')+'.xlsx', blob:new Blob([buf],{type:'application/octet-stream'}), rowCount:slice.length, hasTpl:!!r.templateHeaders };
        });
        setResults(generated); setStep(3);
      } catch{ setError("فشل المعالجة."); }
      finally{ setLoading(false); }
    },60);
  };

  const downloadOne=(r)=>saveAs(r.blob,r.name);
  const downloadSeq=async()=>{ setLoading(true); for(const r of results){saveAs(r.blob,r.name);await new Promise(x=>setTimeout(x,900));} setLoading(false); };
  const downloadZip=async()=>{ setLoading(true); try{ const z=new JSZip(); results.forEach(r=>z.file(r.name,r.blob)); saveAs(await z.generateAsync({type:'blob'}),'exelar_split.zip'); }catch{setError("فشل ZIP.");} finally{setLoading(false);} };
  const resetAll=()=>{ setStep(1);setSheetData([]);setHeaders([]);setTotalRows(0);setFileName('');setRanges([{...newRange(1),start:1}]);setResults([]);setError(null);setActiveMapIdx(null);if(fileRef.current)fileRef.current.value=''; };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 min-h-screen grid-bg" dir="rtl">
      {onGoHome && (
        <div className="flex items-center justify-between mb-6 animate-fade-in">
          <button onClick={onGoHome} className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 font-bold text-sm bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-xl border border-white/5 hover:border-emerald-500/20 transition-all active:scale-95"><ArrowRight size={18}/> الرئيسية</button>
          <span className="text-sm font-bold text-slate-500 flex items-center gap-2"><FileSpreadsheet size={16} className="text-emerald-400"/> تقسيم يدوي</span>
        </div>
      )}
      <div className="text-center mb-8 animate-slide-up">
        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-2">تقسيم <span className="text-gradient">يدوي</span> متقدم</h2>
        <p className="text-slate-500 text-sm font-bold max-w-lg mx-auto">حدد النطاقات يدوياً، أضف تمبليت لكل نطاق، وطابق الأعمدة — تحكم كامل.</p>
      </div>
      <div className="flex items-center justify-center gap-2 md:gap-4 mb-10 animate-slide-up stagger-1">
        <StepDot step={1} current={step} label="الرفع"/>
        <Connector active={step>1}/>
        <StepDot step={2} current={step} label="النطاقات"/>
        <Connector active={step>2}/>
        <StepDot step={3} current={step} label="التنزيل"/>
      </div>
      {error && (
        <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-start gap-3 animate-slide-up">
          <AlertCircle className="shrink-0 mt-0.5" size={16}/><p className="text-sm font-bold flex-1">{error}</p>
          <button onClick={()=>setError(null)} className="hover:bg-rose-500/20 p-1 rounded-lg"><X size={14}/></button>
        </div>
      )}

      {/* ═══ STEP 1 ═══ */}
      {step===1 && (
        <GlassCard className="text-center animate-slide-up stagger-2">
          <div className="p-8 md:p-14 border-2 border-dashed border-emerald-500/20 rounded-2xl hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all cursor-pointer relative group">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"/>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                {loading?<RefreshCcw size={32} className="animate-spin"/>:<Upload size={32}/>}
              </div>
              <h3 className="text-xl font-black text-white mb-2">ارفع ملف الإكسيل</h3>
              <p className="text-slate-500 font-bold text-sm max-w-xs mx-auto">اختر ملف .xlsx أو .csv — سيتم تحليل عدد الصفوف والأعمدة تلقائياً.</p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* ═══ STEP 2 ═══ */}
      {step===2 && (
        <div className="space-y-4 animate-slide-up stagger-2">
          <GlassCard className="!p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center"><FileText size={14} className="text-emerald-400"/></div>
                <div><p className="text-[10px] text-slate-500 font-bold">الملف</p><p className="text-sm font-black text-slate-200 truncate max-w-[160px] md:max-w-xs">{fileName}</p></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/15">{totalRows} صف · {headers.length} عمود</span>
                <button onClick={resetAll} className="text-[10px] text-slate-500 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 px-2.5 py-1 rounded-lg transition-colors font-bold">تغيير</button>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
              <h3 className="font-black text-white">النطاقات والتمبليت</h3>
              <button onClick={addRange} className="flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors active:scale-95"><Plus size={12}/> نطاق جديد</button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
              {ranges.map((r,i) => (
                <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 hover:border-emerald-500/15 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black text-slate-400">النطاق {i+1}</span>
                    {ranges.length>1 && <button onClick={()=>removeRange(i)} className="text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10 p-1 rounded-lg transition-colors"><Trash2 size={12}/></button>}
                  </div>
                  {/* Row range + name */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[['start','من صف',r.start],['end','إلى صف',r.end],['name','اسم الملف',r.name]].map(([f,lbl,val])=>(
                      <div key={f}><label className="text-[9px] font-bold text-slate-500 block mb-0.5">{lbl}</label>
                        <input type={f==='name'?'text':'number'} min={f!=='name'?1:undefined} max={f!=='name'?totalRows:undefined} value={val} onChange={e=>updateRange(i,f,e.target.value)} placeholder={f==='end'?String(totalRows):''}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-sm font-bold text-slate-200 focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/10"/>
                      </div>
                    ))}
                  </div>
                  {r.start && r.end && parseInt(r.end)>=parseInt(r.start) && <p className="text-[9px] text-slate-500 font-bold mb-3">{(parseInt(r.end)-parseInt(r.start)+1).toLocaleString()} صف</p>}

                  {/* Template section */}
                  <div className="border-t border-white/5 pt-3">
                    {!r.templateHeaders ? (
                      <div className="flex items-center gap-2">
                        <label className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-bold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/15 px-3 py-2 rounded-lg cursor-pointer transition-colors border border-dashed border-cyan-500/20">
                          <Upload size={12}/> رفع تمبليت (اختياري)
                          <input ref={tplRef} type="file" accept=".xlsx,.xls,.csv" onChange={e=>handleTemplateUpload(e,i)} className="hidden"/>
                        </label>
                        <span className="text-[9px] text-slate-600 font-bold">أو اتركه بدون تمبليت</span>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black text-cyan-400 flex items-center gap-1"><CheckCircle2 size={10}/> تمبليت ({r.templateHeaders.length} عمود)</span>
                          <div className="flex gap-1.5">
                            <button onClick={()=>setActiveMapIdx(activeMapIdx===i?null:i)} className="text-[10px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/15 px-2 py-1 rounded-lg transition-colors flex items-center gap-1">
                              <Link2 size={10}/> {activeMapIdx===i?'إخفاء':'مطابقة'}
                            </button>
                            <button onClick={()=>clearTemplate(i)} className="text-[10px] text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10 px-2 py-1 rounded-lg transition-colors">حذف</button>
                          </div>
                        </div>
                        {/* Inline mapping UI */}
                        {activeMapIdx===i && (
                          <div className="mt-2 space-y-1.5 bg-white/[0.02] border border-white/5 rounded-lg p-3 max-h-[200px] overflow-y-auto custom-scrollbar">
                            <p className="text-[9px] text-slate-500 font-bold mb-2">طابق كل عمود في التمبليت مع عمود من البيانات الأصلية:</p>
                            {r.templateHeaders.map(tCol => (
                              <div key={tCol} className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-cyan-300 w-1/3 truncate">{tCol}</span>
                                <ArrowLeft size={12} className="text-slate-600 shrink-0"/>
                                <div className="flex-1 relative">
                                  <select value={r.mappings[tCol]||''} onChange={e=>updateMapping(i,tCol,e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-300 appearance-none focus:outline-none focus:border-emerald-500/20 cursor-pointer">
                                    <option value="" className="bg-gray-900">-- تجاهل --</option>
                                    {headers.map(h=><option key={String(h)} value={String(h)} className="bg-gray-900">{String(h)}</option>)}
                                  </select>
                                  <ChevronDown size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"/>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-5 pt-4 border-t border-white/5">
              <button onClick={()=>setStep(1)} className="px-4 py-2.5 text-sm font-bold text-slate-400 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">السابق</button>
              <button onClick={processRanges} disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-50">
                {loading?<RefreshCcw size={16} className="animate-spin"/>:<CheckCircle2 size={16}/>} معالجة وتقسيم
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ═══ STEP 3 ═══ */}
      {step===3 && (
        <div className="space-y-4 animate-slide-up stagger-2">
          <GlassCard className="!p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center"><PackageCheck size={16} className="text-emerald-400"/></div>
                <div><p className="text-[10px] text-slate-500 font-bold">تم بنجاح</p><p className="text-sm font-black text-white">{results.length} ملفات</p></div>
              </div>
              <button onClick={resetAll} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 px-2.5 py-1.5 rounded-lg transition-colors font-bold"><RefreshCcw size={10}/> جديد</button>
            </div>
          </GlassCard>
          <GlassCard>
            <h3 className="font-black text-white mb-3 text-sm">الملفات</h3>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
              {results.map((r,i)=>(
                <div key={i} className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-xl p-3 hover:border-emerald-500/15 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0"><FileSpreadsheet size={12} className="text-emerald-400"/></div>
                    <div className="min-w-0"><p className="text-sm font-black text-slate-200 truncate">{r.name}</p>
                      <p className="text-[9px] text-slate-500 font-bold">{r.rowCount} صف {r.hasTpl && <span className="text-cyan-400">· بتمبليت</span>}</p>
                    </div>
                  </div>
                  <button onClick={()=>downloadOne(r)} className="flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1.5 rounded-lg transition-colors shrink-0 active:scale-95"><Download size={12}/> تنزيل</button>
                </div>
              ))}
            </div>
          </GlassCard>
          <GlassCard>
            <h3 className="font-black text-white mb-1 text-sm">تنزيل الكل</h3>
            <div className="flex items-start gap-2 mb-4"><Info size={10} className="text-slate-500 shrink-0 mt-0.5"/><p className="text-[10px] text-slate-500 font-bold leading-relaxed">"ملفات منفصلة" للهواتف القديمة. "ZIP" أسرع للكمبيوتر.</p></div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={downloadSeq} disabled={loading} className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-emerald-500/15 text-slate-200 font-black text-xs rounded-xl transition-all active:scale-[0.98] disabled:opacity-50">
                {loading?<RefreshCcw size={14} className="animate-spin"/>:<Smartphone size={14} className="text-cyan-400"/>} منفصلة
              </button>
              <button onClick={downloadZip} disabled={loading} className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg hover:shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50">
                {loading?<RefreshCcw size={14} className="animate-spin"/>:<Monitor size={14}/>} ZIP
              </button>
            </div>
          </GlassCard>
          <button onClick={()=>{setStep(2);setResults([]);}} className="w-full text-center text-[10px] text-slate-500 hover:text-emerald-400 font-bold py-2 transition-colors">← تعديل النطاقات</button>
        </div>
      )}
    </div>
  );
}
