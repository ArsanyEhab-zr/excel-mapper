import React, { useState, useEffect, useRef, Component } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  Upload, FileSpreadsheet, ArrowLeft, ArrowRight,
  Download, CheckCircle2, FileText, RefreshCcw,
  X, AlertCircle, Layout, Settings, Smartphone, Monitor
} from 'lucide-react';

// --- 1. Error Boundary (Security & Stability) ---
// Catches JS errors anywhere in the child component tree and displays a fallback UI
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center bg-rose-50 border border-rose-200 text-rose-700 rounded-3xl m-4 max-w-lg mx-auto mt-20" dir="rtl">
          <AlertCircle className="mx-auto mb-4" size={48} />
          <h2 className="text-xl font-black mb-2">عذراً، حدث خطأ غير متوقع!</h2>
          <p className="text-sm font-bold opacity-80">{this.state.error?.toString()}</p>
          <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors">
            إعادة تحميل الصفحة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Helper Components ---
const GlassCard = ({ children, className = "" }) => (
  <div className={`bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl rounded-3xl p-6 md:p-8 ${className}`}>
    {children}
  </div>
);

const StepIndicator = ({ step, currentStep, label, icon: Icon }) => {
  const isActive = currentStep === step;
  const isCompleted = currentStep > step;

  return (
    <div className={`flex flex-col md:flex-row items-center md:space-x-3 md:space-x-reverse transition-all duration-300 ${isActive ? 'opacity-100 scale-105' : 'opacity-60 scale-100'}`}>
      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-colors shadow-lg mb-2 md:mb-0 ${
        isCompleted ? 'bg-emerald-500 text-white' : isActive ? 'bg-blue-600 text-white' : 'bg-white/80 text-slate-400 border border-slate-200'
      }`}>
        {isCompleted ? <CheckCircle2 size={20} /> : <Icon size={20} />}
      </div>
      <div className="text-center md:text-right">
        <p className="text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-400">الخطوة {step}</p>
        <p className="text-xs md:text-sm font-bold text-slate-800">{label}</p>
      </div>
    </div>
  );
};

// --- Main Component ---
function ExcelSplitterCore() {
  const [currentStep, setCurrentStep] = useState(1);
  
  // Data States
  const [sourceData, setSourceData] = useState([]);
  const [sourceColumns, setSourceColumns] = useState([]);
  const [sourceFileName, setSourceFileName] = useState("");
  
  const [templateColumns, setTemplateColumns] = useState([]);
  const [templateFileName, setTemplateFileName] = useState("");
  
  const [mappings, setMappings] = useState({}); 
  
  // Split Settings
  const [splitStrategy, setSplitStrategy] = useState('rows'); 
  const [splitRowCount, setSplitRowCount] = useState(100);
  const [splitColumn, setSplitColumn] = useState('');
  
  // Download Settings
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [forceZipOnMobile, setForceZipOnMobile] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // 2. Memory Leak Prevention: Track mount status for async operations
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth <= 768;
    setIsMobileDevice(isMobile);
    return () => {
      isMounted.current = false;
    };
  }, []);

  const parseExcelData = async (file, isTemplate = false) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target.result;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          
          const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] || [];
          const stringHeaders = headers.map(h => String(h).trim());
          
          if (isTemplate) {
            resolve({ headers: stringHeaders });
          } else {
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
            resolve({ data: jsonData, headers: stringHeaders });
          }
        } catch (err) {
          reject("فشل قراءة الملف. تأكد إنه بصيغة إكسيل صحيحة.");
        }
      };
      reader.onerror = () => reject("حدث خطأ أثناء قراءة الملف.");
      reader.readAsArrayBuffer(file);
    });
  };

  const handleSourceUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    try {
      const { data, headers } = await parseExcelData(file, false);
      if (!isMounted.current) return; // Prevent state update if unmounted
      
      if (data.length === 0) throw new Error("ملف البيانات يبدو فارغاً.");
      
      setSourceColumns(headers);
      setSourceData(data);
      setSourceFileName(file.name);
      setCurrentStep(2);
    } catch (err) {
      if (isMounted.current) setError(err instanceof Error ? err.message : err);
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  };

  const handleTemplateUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    try {
      const { headers } = await parseExcelData(file, true);
      if (!isMounted.current) return;

      if (headers.length === 0) throw new Error("ملف التمبليت لا يحتوي على أعمدة.");
      
      setTemplateColumns(headers);
      setTemplateFileName(file.name);
      
      const initialMappings = {};
      headers.forEach(tCol => {
        const match = sourceColumns.find(sCol => sCol.toLowerCase() === tCol.toLowerCase());
        initialMappings[tCol] = match || "";
      });
      setMappings(initialMappings);
      
      setCurrentStep(3);
    } catch (err) {
      if (isMounted.current) setError(err instanceof Error ? err.message : err);
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  };

  const handleMappingChange = (targetCol, sourceCol) => {
    setMappings(prev => ({ ...prev, [targetCol]: sourceCol }));
  };

  const generateChunks = () => {
    const mappedData = sourceData.map(row => {
      const newRow = {};
      templateColumns.forEach(tCol => {
        const sCol = mappings[tCol];
        newRow[tCol] = sCol ? (row[sCol] ?? "") : "";
      });
      return newRow;
    });

    const chunks = [];
    if (splitStrategy === 'rows') {
      const rowLimit = Math.max(1, parseInt(splitRowCount) || 100);
      for (let i = 0; i < mappedData.length; i += rowLimit) {
        chunks.push({
          name: `split_part_${Math.floor(i / rowLimit) + 1}.xlsx`,
          data: mappedData.slice(i, i + rowLimit)
        });
      }
    } else if (splitStrategy === 'column' && splitColumn) {
      const groups = {};
      mappedData.forEach(row => {
        const val = row[splitColumn] || 'بدون_قيمة';
        if (!groups[val]) groups[val] = [];
        groups[val].push(row);
      });
      
      // 3. Prevent Filename Collisions
      const safeKeysCount = {};
      Object.keys(groups).forEach(key => {
        let safeKey = String(key).replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_').substring(0, 30);
        
        if (safeKeysCount[safeKey] !== undefined) {
          safeKeysCount[safeKey] += 1;
          safeKey = `${safeKey}_${safeKeysCount[safeKey]}`;
        } else {
          safeKeysCount[safeKey] = 0;
        }

        chunks.push({
          name: `split_${safeKey}.xlsx`,
          data: groups[key]
        });
      });
    } else {
      throw new Error("إعدادات التقسيم غير مكتملة.");
    }
    
    return chunks;
  };

  const handleDownload = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);
    
    // 4. UI Thread Unblocking: Yield to the event loop so the UI (Spinner) can render 
    // before the potentially heavy synchronous chunk generation blocks the thread.
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const chunks = generateChunks();
      if (chunks.length === 0) throw new Error("لا توجد بيانات للتقسيم بعد المعالجة.");

      const useZip = !isMobileDevice || forceZipOnMobile;

      if (useZip) {
        const zip = new JSZip();
        chunks.forEach(chunk => {
          const ws = XLSX.utils.json_to_sheet(chunk.data, { header: templateColumns });
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Data");
          const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          zip.file(chunk.name, excelBuffer);
        });
        const zipContent = await zip.generateAsync({ type: 'blob' });
        if (isMounted.current) saveAs(zipContent, "Splitted_Excel_Files.zip");
      } else {
        for (let i = 0; i < chunks.length; i++) {
          // Break loop if component unmounted mid-download sequence
          if (!isMounted.current) break;
          
          const chunk = chunks[i];
          const ws = XLSX.utils.json_to_sheet(chunk.data, { header: templateColumns });
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Data");
          XLSX.writeFile(wb, chunk.name);
          
          await new Promise(res => setTimeout(res, 800));
        }
      }
      if (isMounted.current) setSuccessMsg("تم تجهيز وتحميل الملفات بنجاح!");
    } catch (err) {
      if (isMounted.current) setError(err instanceof Error ? err.message : err);
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  };

  const resetAll = () => {
    setCurrentStep(1);
    setSourceData([]);
    setSourceColumns([]);
    setTemplateColumns([]);
    setMappings({});
    setSourceFileName("");
    setTemplateFileName("");
    setError(null);
    setSuccessMsg(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 font-sans" dir="rtl">
      {/* Header */}
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-3">
          <FileSpreadsheet className="text-blue-600" size={40} />
          مُقسّم الإكسيل الذكي
        </h2>
        <p className="text-slate-500 mt-3 max-w-2xl mx-auto font-bold">
          قم برفع ملفك، طابق الأعمدة مع تمبليت جديد، ثم قسّم الملف الكبير إلى ملفات صغيرة بكل سهولة.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex flex-row justify-between items-start md:items-center mb-10 bg-white/60 p-4 md:p-6 rounded-3xl shadow-sm border border-slate-200 gap-2 md:gap-6 overflow-x-auto custom-scrollbar">
        <StepIndicator step={1} currentStep={currentStep} label="البيانات" icon={Upload} />
        <div className="flex-1 h-1 bg-slate-200 rounded-full hidden md:block opacity-50 relative top-6">
           <div className={`h-full bg-blue-500 rounded-full transition-all ${currentStep > 1 ? 'w-full' : 'w-0'}`}></div>
        </div>
        <StepIndicator step={2} currentStep={currentStep} label="التمبليت" icon={FileText} />
        <div className="flex-1 h-1 bg-slate-200 rounded-full hidden md:block opacity-50 relative top-6">
           <div className={`h-full bg-blue-500 rounded-full transition-all ${currentStep > 2 ? 'w-full' : 'w-0'}`}></div>
        </div>
        <StepIndicator step={3} currentStep={currentStep} label="المطابقة" icon={Layout} />
        <div className="flex-1 h-1 bg-slate-200 rounded-full hidden md:block opacity-50 relative top-6">
           <div className={`h-full bg-blue-500 rounded-full transition-all ${currentStep > 3 ? 'w-full' : 'w-0'}`}></div>
        </div>
        <StepIndicator step={4} currentStep={currentStep} label="التقسيم" icon={Settings} />
      </div>

      {/* Error & Success Messages */}
      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="shrink-0 mt-0.5" size={20} />
          <p className="text-sm font-bold flex-1">{error}</p>
          <button onClick={() => setError(null)} className="hover:bg-rose-200 p-1 rounded-lg transition-colors"><X size={16} /></button>
        </div>
      )}
      
      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="shrink-0 mt-0.5" size={20} />
          <p className="text-sm font-bold flex-1">{successMsg}</p>
          <button onClick={() => setSuccessMsg(null)} className="hover:bg-emerald-200 p-1 rounded-lg transition-colors"><X size={16} /></button>
        </div>
      )}

      {/* Step Content */}
      <div className="transition-all duration-500">
        
        {/* Step 1: Upload Source Data */}
        {currentStep === 1 && (
          <GlassCard className="text-center animate-in fade-in zoom-in-95">
            <div className="p-8 md:p-16 border-2 border-dashed border-blue-200 rounded-3xl hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer relative group">
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleSourceUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" />
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform">
                  <Upload size={36} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-3">ارفع ملف البيانات الأصلي</h3>
                <p className="text-slate-500 font-bold max-w-sm mx-auto text-sm leading-relaxed">
                  هذا هو الملف الكبير الذي يحتوي على البيانات التي ترغب في تقسيمها.
                </p>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Step 2: Upload Template */}
        {currentStep === 2 && (
          <GlassCard className="animate-in fade-in zoom-in-95">
            <div className="flex flex-col sm:flex-row items-center justify-between mb-8 pb-4 border-b border-slate-100 gap-4">
              <div className="flex items-center gap-2 text-blue-600 font-black text-sm bg-blue-50 px-4 py-2 rounded-xl w-full sm:w-auto">
                <CheckCircle2 size={18} />
                <span className="truncate max-w-[200px]">{sourceFileName}</span>
              </div>
              <button onClick={() => setCurrentStep(1)} className="text-sm text-slate-500 hover:text-blue-600 font-bold flex items-center bg-slate-50 px-4 py-2 rounded-xl w-full sm:w-auto justify-center">
                تغيير الملف <ArrowLeft size={16} className="mr-2" />
              </button>
            </div>
            
            <div className="p-8 md:p-16 border-2 border-dashed border-emerald-200 rounded-3xl hover:border-emerald-400 hover:bg-emerald-50/50 transition-all cursor-pointer relative text-center group">
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleTemplateUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" />
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform">
                  <FileText size={36} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-3">ارفع ملف التمبليت</h3>
                <p className="text-slate-500 font-bold max-w-sm mx-auto text-sm leading-relaxed">
                  ارفع ملف إكسيل فارغ يحتوي فقط على الصف الأول (رؤوس الأعمدة) بالشكل الجديد المطلوب.
                </p>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Step 3: Column Mapping */}
        {currentStep === 3 && (
          <GlassCard className="animate-in fade-in zoom-in-95">
             <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-100">
               <div className="flex flex-wrap gap-3">
                  <span className="text-xs font-bold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100">البيانات: {sourceFileName}</span>
                  <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100">التمبليت: {templateFileName}</span>
               </div>
               <div className="flex gap-2 w-full sm:w-auto">
                 <button onClick={() => setCurrentStep(2)} className="flex-1 sm:flex-none text-sm text-slate-500 hover:text-blue-600 font-bold flex items-center justify-center bg-slate-50 px-4 py-2 rounded-xl">
                   السابق
                 </button>
                 <button onClick={() => setCurrentStep(4)} className="flex-1 sm:flex-none text-sm text-white bg-blue-600 hover:bg-blue-700 font-bold flex items-center justify-center px-6 py-2 rounded-xl shadow-md">
                   التالي: التقسيم <ArrowLeft size={16} className="mr-2" />
                 </button>
               </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl mb-6">
              <h4 className="font-black text-slate-700 mb-1">مطابقة الأعمدة</h4>
              <p className="text-sm text-slate-500 font-bold">حدد لكل عمود في التمبليت الجديد العمود المقابل له من ملف البيانات الأصلي.</p>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {templateColumns.map((tCol) => (
                <div key={tCol} className="flex flex-col sm:flex-row sm:items-center bg-white border border-slate-200 rounded-2xl p-4 gap-4 hover:border-blue-300 transition-colors">
                  <div className="sm:w-1/3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                      <Layout size={16} />
                    </div>
                    <span className="font-black text-slate-700 text-sm">{tCol}</span>
                  </div>
                  
                  <div className="hidden sm:flex items-center text-slate-300">
                    <ArrowLeft size={20} />
                  </div>
                  
                  <div className="sm:w-1/2 relative w-full">
                    <select
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-bold text-sm rounded-xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                      value={mappings[tCol] || ""}
                      onChange={(e) => handleMappingChange(tCol, e.target.value)}
                    >
                      <option value="">-- تجاهل (اتركه فارغاً) --</option>
                      {sourceColumns.map(sCol => (
                        <option key={sCol} value={sCol}>{sCol}</option>
                      ))}
                    </select>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Step 4: Split Settings & Download */}
        {currentStep === 4 && (
          <GlassCard className="animate-in fade-in zoom-in-95">
             <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100">
               <h3 className="text-xl font-black text-slate-800">إعدادات التقسيم والتنزيل</h3>
               <button onClick={() => setCurrentStep(3)} className="text-sm text-slate-500 hover:text-blue-600 font-bold flex items-center bg-slate-50 px-4 py-2 rounded-xl">
                 رجوع للمطابقة <ArrowRight size={16} className="ml-2" />
               </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              {/* Split Settings */}
              <div className="space-y-6">
                <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-2xl">
                  <h4 className="font-black text-blue-800 mb-4 flex items-center gap-2">
                    <Settings size={18} /> طريقة التقسيم
                  </h4>
                  
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-blue-50 border border-transparent transition-colors">
                      <input 
                        type="radio" 
                        name="splitStrategy" 
                        value="rows" 
                        checked={splitStrategy === 'rows'}
                        onChange={() => setSplitStrategy('rows')}
                        className="w-5 h-5 text-blue-600 focus:ring-blue-500" 
                      />
                      <span className="font-bold text-slate-700">تقسيم بعدد الصفوف لكل ملف</span>
                    </label>
                    
                    {splitStrategy === 'rows' && (
                      <div className="mr-8 pr-4 border-r-2 border-blue-200">
                        <input 
                          type="number" 
                          min="1"
                          value={splitRowCount}
                          onChange={(e) => setSplitRowCount(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          placeholder="مثال: 100"
                        />
                        <p className="text-xs text-slate-500 mt-2 font-bold">كل ملف سيحتوي على {splitRowCount || 0} صف كحد أقصى.</p>
                      </div>
                    )}

                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-blue-50 border border-transparent transition-colors">
                      <input 
                        type="radio" 
                        name="splitStrategy" 
                        value="column" 
                        checked={splitStrategy === 'column'}
                        onChange={() => setSplitStrategy('column')}
                        className="w-5 h-5 text-blue-600 focus:ring-blue-500" 
                      />
                      <span className="font-bold text-slate-700">تقسيم حسب قيمة عمود معين</span>
                    </label>

                    {splitStrategy === 'column' && (
                      <div className="mr-8 pr-4 border-r-2 border-blue-200 relative">
                        <select
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold appearance-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          value={splitColumn}
                          onChange={(e) => setSplitColumn(e.target.value)}
                        >
                          <option value="" disabled>اختر العمود...</option>
                          {templateColumns.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                        <p className="text-xs text-slate-500 mt-2 font-bold">سيتم إنشاء ملف منفصل لكل قيمة مختلفة في هذا العمود.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Download Settings */}
              <div className="space-y-6">
                <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl h-full flex flex-col">
                  <h4 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                    {isMobileDevice ? <Smartphone className="text-indigo-600" size={18} /> : <Monitor className="text-indigo-600" size={18} />}
                    إعدادات التنزيل
                  </h4>
                  
                  <div className="flex-1">
                    {isMobileDevice ? (
                      <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl mb-4">
                        <p className="text-sm text-indigo-800 font-bold leading-relaxed mb-3">
                          يبدو أنك تستخدم هاتفاً محمولاً. التنزيل العادي (ملفات منفصلة) مدعوم بشكل أفضل على الهواتف.
                        </p>
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={forceZipOnMobile}
                            onChange={(e) => setForceZipOnMobile(e.target.checked)}
                            className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" 
                          />
                          <span className="text-sm font-bold text-slate-700">
                            تجميع الملفات في ملف مضغوط (.zip) بدلاً من ذلك <span className="text-xs text-slate-500 block mt-1">(قد يتطلب تطبيقاً لفك الضغط)</span>
                          </span>
                        </label>
                      </div>
                    ) : (
                      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl mb-4">
                        <p className="text-sm text-emerald-800 font-bold leading-relaxed">
                          أنت تستخدم جهاز كمبيوتر. سيتم تجميع جميع الملفات المقسمة تلقائياً في ملف مضغوط (.zip) واحد لتوفير الوقت وسهولة التنزيل.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 mt-auto border-t border-slate-200">
                     <p className="text-xs font-bold text-slate-500 mb-4 flex items-center gap-2">
                       <AlertCircle size={14} /> تأكد من مراجعة الإعدادات قبل التنزيل.
                     </p>
                     <div className="flex gap-3 flex-col sm:flex-row">
                       <button 
                         onClick={handleDownload} 
                         disabled={isLoading || (splitStrategy === 'column' && !splitColumn)} 
                         className="flex-1 flex items-center justify-center px-6 py-4 bg-blue-600 text-white font-black text-lg rounded-2xl hover:bg-blue-700 shadow-xl hover:shadow-blue-500/40 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                       >
                         {isLoading ? <RefreshCcw className="animate-spin ml-3" size={24} /> : <Download className="ml-3 group-hover:-translate-y-1 transition-transform" size={24} />}
                         {isMobileDevice && !forceZipOnMobile ? 'تنزيل الملفات تباعاً' : 'تنزيل كملف ZIP'}
                       </button>
                       <button onClick={resetAll} className="flex items-center justify-center text-rose-500 font-black bg-rose-50 hover:bg-rose-100 px-6 py-4 rounded-2xl transition-colors shrink-0">
                         <RefreshCcw size={20} />
                       </button>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}

// Export the wrapper containing the Error Boundary
export default function ExcelSplitter(props) {
  return (
    <ErrorBoundary>
      <ExcelSplitterCore {...props} />
    </ErrorBoundary>
  );
}
