import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  ArrowLeft,
  Download,
  CheckCircle2,
  FileText,
  RefreshCcw,
  X,
  AlertCircle,
  Layout,
  PenTool,
  Plus,
  ArrowRight,
  Home
} from 'lucide-react';

// --- Helper Components (restyled for dark theme) ---
const GlassCard = ({ children, className = "" }) => (
  <div className={`glass-card rounded-2xl md:rounded-3xl p-5 md:p-8 transition-all duration-300 ${className}`}>
    {children}
  </div>
);

const StepIndicator = ({ step, currentStep, label, icon: Icon }) => {
  const isActive = currentStep === step;
  const isCompleted = currentStep > step;

  return (
    <div className={`flex items-center gap-3 transition-all duration-300 ${isActive ? 'opacity-100 scale-105' : 'opacity-40 scale-100'}`}>
      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-colors shadow-lg ${
        isCompleted ? 'bg-emerald-500 text-white' : isActive ? 'bg-emerald-600 text-white' : 'bg-white/5 text-slate-500 border border-white/10'
      }`}>
        {isCompleted ? <CheckCircle2 size={20} /> : <Icon size={20} />}
      </div>
      <div>
        <p className="text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-500">الخطوة {step}</p>
        <p className="text-xs md:text-sm font-bold text-slate-300">{label}</p>
      </div>
    </div>
  );
};

// --- Main Component ---
export default function ExcelMapper({ onGoHome }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [targetColumns, setTargetColumns] = useState([]);
  const [sourceColumns, setSourceColumns] = useState([]);
  const [sourceData, setSourceData] = useState([]);
  const [mappings, setMappings] = useState({});
  const [staticValues, setStaticValues] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [templateFileName, setTemplateFileName] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");

  // --- Processing Functions ---
  const parseExcelHeaders = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target.result;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          if (jsonData.length > 0) {
            resolve(jsonData[0]);
          } else {
            reject("الملف يبدو فارغاً.");
          }
        } catch (err) {
          reject("فشل قراءة الملف. تأكد إنه بصيغة Excel أو CSV صحيحة.");
        }
      };
      reader.onerror = () => reject("حدث خطأ أثناء قراءة الملف.");
      reader.readAsArrayBuffer(file);
    });
  };

  const parseExcelData = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target.result;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
          const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];
          resolve({ data: jsonData, headers });
        } catch (err) {
          reject("فشل قراءة الملف. تأكد إنه بصيغة Excel أو CSV صحيحة.");
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleTemplateUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setError(null);
    try {
      const headers = await parseExcelHeaders(file);
      setTargetColumns(headers.map(h => String(h)));
      setTemplateFileName(file.name);
      setCurrentStep(2);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSourceUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data, headers } = await parseExcelData(file);
      setSourceColumns(headers.map(h => String(h)));
      setSourceData(data);
      setSourceFileName(file.name);
      const newMappings = {};
      targetColumns.forEach(target => {
        const match = headers.find(source => String(source).toLowerCase().trim() === target.toLowerCase().trim());
        newMappings[target] = match ? [String(match)] : [""];
      });
      setMappings(newMappings);
      setCurrentStep(3);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMappingChange = (target, index, value) => {
    setMappings(prev => {
      const currentArr = [...(prev[target] || [""])];
      currentArr[index] = value;
      return { ...prev, [target]: currentArr };
    });
  };

  const addMappingField = (target) => {
    setMappings(prev => ({
      ...prev,
      [target]: [...(prev[target] || [""]), ""]
    }));
  };

  const removeMappingField = (target, index) => {
    setMappings(prev => {
      const currentArr = [...(prev[target] || [""])];
      currentArr.splice(index, 1);
      return { ...prev, [target]: currentArr };
    });
  };

  const handleStaticValueChange = (target, value) => {
    setStaticValues(prev => ({ ...prev, [target]: value }));
  };

  const generateAndDownload = () => {
    setIsLoading(true);
    try {
      const transformedData = sourceData.map(row => {
        const newRow = {};
        targetColumns.forEach(target => {
          const sourcesArr = mappings[target] || [];
          const parts = sourcesArr.map(sourceCol => {
            if (sourceCol === '__STATIC__') return staticValues[target] || "";
            if (sourceCol) return row[sourceCol] ?? "";
            return "";
          }).filter(val => String(val).trim() !== "");
          let combinedValue = parts.join(" - ");
          combinedValue = combinedValue.replace(/(^|\D)(1[0125]\d{8})(\D|$)/g, '$10$2$3');
          combinedValue = combinedValue.replace(/(^|\D)(3\d{7})(\D|$)/g, '$10$2$3');
          newRow[target] = combinedValue;
        });
        return newRow;
      });

      const worksheet = XLSX.utils.json_to_sheet(transformedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "MappedData");
      XLSX.writeFile(workbook, "Clean_Data_Ready_For_App.xlsx");
    } catch (err) {
      setError("فشل في تحويل وتصدير البيانات.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetAll = () => {
    setTargetColumns([]);
    setSourceColumns([]);
    setSourceData([]);
    setMappings({});
    setStaticValues({});
    setCurrentStep(1);
    setTemplateFileName("");
    setSourceFileName("");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:py-16 min-h-screen" dir="rtl">
      {/* Header with back button */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <button
          onClick={onGoHome}
          className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 font-bold text-sm bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-xl border border-white/5 hover:border-emerald-500/20 transition-all active:scale-95"
        >
          <ArrowRight size={18} />
          الرئيسية
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <PenTool size={16} className="text-emerald-400" />
          </div>
          <span className="text-sm font-bold text-slate-400">تجديد البيانات</span>
        </div>
      </div>

      {/* Page Title */}
      <div className="text-center mb-12 animate-slide-up">
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
          منظف <span className="text-gradient">الإكسيل</span>
        </h1>
        <p className="text-slate-500 text-sm md:text-base font-bold max-w-xl mx-auto">
          أداة سحرية لدمج الأعمدة، استعادة أصفار التليفونات المفقودة، وتجهيز الداتا للأبلكيشن.
        </p>
      </div>

      {/* Step Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-12 glass-card rounded-2xl p-4 animate-slide-up stagger-1">
        <StepIndicator step={1} currentStep={currentStep} label="التمبليت (الأعمدة المطلوبة)" icon={FileText} />
        <StepIndicator step={2} currentStep={currentStep} label="الداتا القديمة (الأرشيف)" icon={FileSpreadsheet} />
        <StepIndicator step={3} currentStep={currentStep} label="الدمج والتصدير" icon={Download} />
      </div>

      <main className="step-transition">
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-start gap-3 animate-slide-up">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <p className="text-sm font-bold flex-1">{error}</p>
            <button onClick={() => setError(null)} className="hover:bg-rose-500/20 p-1 rounded-lg transition-colors"><X size={16} /></button>
          </div>
        )}

        {/* Step 1 */}
        {currentStep === 1 && (
          <GlassCard className="text-center animate-slide-up stagger-2">
            <div className="p-8 md:p-14 border-2 border-dashed border-emerald-500/20 rounded-2xl hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all cursor-pointer relative group">
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleTemplateUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform"><Upload size={36} /></div>
                <h3 className="text-xl md:text-2xl font-black text-white mb-2">ارفع ملف التمبليت الفاضي</h3>
                <p className="text-slate-500 font-bold max-w-sm mx-auto text-sm">ارفع ملف إكسيل يحتوي فقط على الصف الأول الذي يضم أسماء الأعمدة المطلوبة في التطبيق الجديد.</p>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Step 2 */}
        {currentStep === 2 && (
          <GlassCard className="animate-slide-up stagger-2">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
              <div className="flex items-center gap-2 text-emerald-400 font-black text-sm bg-emerald-500/10 px-4 py-2 rounded-xl">
                <CheckCircle2 size={18} /><span>التمبليت المقروء: {templateFileName}</span>
              </div>
              <button onClick={() => setCurrentStep(1)} className="text-sm text-slate-500 hover:text-emerald-400 font-bold flex items-center bg-white/5 px-3 py-2 rounded-xl transition-colors">
                تغيير التمبليت <ArrowLeft size={14} className="mr-1" />
              </button>
            </div>
            <div className="p-8 md:p-14 border-2 border-dashed border-cyan-500/20 rounded-2xl hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all cursor-pointer relative text-center group">
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleSourceUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-cyan-500/10 rounded-2xl flex items-center justify-center text-cyan-400 mb-6 group-hover:scale-110 transition-transform"><FileSpreadsheet size={36} /></div>
                <h3 className="text-xl md:text-2xl font-black text-white mb-2">ارفع ملف الداتا القديمة</h3>
                <p className="text-slate-500 font-bold max-w-sm mx-auto text-sm">قم برفع الإكسيل القديم المليء بالبيانات العشوائية.</p>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Step 3 */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-slide-up stagger-2">
            <GlassCard>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/5 text-sm">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg font-bold w-fit"><span className="text-emerald-600">التمبليت:</span><span>{templateFileName}</span></div>
                  <div className="flex items-center gap-2 bg-cyan-500/10 text-cyan-400 px-3 py-1.5 rounded-lg font-bold w-fit"><span className="text-cyan-600">الداتا:</span><span>{sourceFileName}</span></div>
                </div>
                <button onClick={resetAll} className="flex items-center text-rose-400 font-black bg-rose-500/10 hover:bg-rose-500/20 px-4 py-2 rounded-xl transition-colors w-fit">
                  <RefreshCcw size={16} className="ml-2" /> البدء من جديد
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pl-2 custom-scrollbar">
                <div className="flex items-center font-black text-slate-500 text-xs px-4 mb-1">
                  <div className="w-1/3">أعمدة التمبليت (الجديدة)</div>
                  <div className="w-2/3">مصدر البيانات (الداتا القديمة المدمجة)</div>
                </div>

                {targetColumns.map((target) => {
                  const targetMappings = mappings[target] || [""];
                  const hasStatic = targetMappings.includes('__STATIC__');

                  return (
                    <div key={target} className={`flex flex-col p-4 md:p-5 rounded-xl border transition-all ${hasStatic ? 'bg-amber-500/5 border-amber-500/20' : 'bg-white/[0.02] border-white/5 hover:border-emerald-500/20'}`}>
                      <div className="flex flex-col md:flex-row md:items-start gap-4">
                        <div className="w-full md:w-1/3 flex items-center gap-3 mt-1">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${hasStatic ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                            <Layout size={14} />
                          </div>
                          <span className="font-black text-slate-200 text-sm">{target}</span>
                        </div>

                        <div className="w-full md:w-2/3 flex flex-col gap-3">
                          {targetMappings.map((mappedVal, idx) => (
                            <div key={idx} className="flex items-center gap-2 w-full">
                              {idx === 0 ? <ArrowLeft className="text-slate-600 shrink-0" size={18} /> : <Plus className="text-emerald-500 shrink-0" size={18} />}
                              <div className="relative w-full">
                                <select
                                  className={`w-full border rounded-xl px-4 py-3 text-sm font-bold appearance-none transition-all cursor-pointer outline-none focus:ring-2 bg-white/5 ${
                                    mappedVal === '__STATIC__' ? 'border-amber-500/30 text-amber-300 focus:ring-amber-500/20' :
                                    mappedVal ? 'border-emerald-500/20 text-emerald-300 focus:ring-emerald-500/20' :
                                    'border-white/10 text-slate-400 focus:ring-emerald-500/20 focus:border-emerald-500/30'
                                  }`}
                                  value={mappedVal || ""}
                                  onChange={(e) => handleMappingChange(target, idx, e.target.value)}
                                >
                                  <option value="" className="bg-gray-900">-- تجاهل (سيبقى فارغاً) --</option>
                                  <option value="__STATIC__" className="bg-gray-900">✏️ إدخال قيمة ثابتة للكل...</option>
                                  {sourceColumns.map(source => (
                                    <option key={source} value={source} className="bg-gray-900">{source}</option>
                                  ))}
                                </select>
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">▼</div>
                              </div>
                              {idx > 0 && (
                                <button onClick={() => removeMappingField(target, idx)} className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 p-2 rounded-xl transition-colors shrink-0">
                                  <X size={18} />
                                </button>
                              )}
                            </div>
                          ))}

                          {!hasStatic && (
                            <button onClick={() => addMappingField(target)} className="text-xs text-emerald-400 font-black flex items-center w-fit hover:text-emerald-300 hover:bg-emerald-500/10 px-3 py-1.5 rounded-lg transition-colors mt-1 mr-7">
                              + دمج عمود آخر
                            </button>
                          )}
                        </div>
                      </div>

                      {hasStatic && (
                        <div className="w-full flex justify-end mt-4">
                          <div className="w-full md:w-2/3 relative pr-7">
                            <PenTool className="absolute right-10 top-1/2 -translate-y-1/2 text-amber-500" size={16} />
                            <input
                              type="text"
                              placeholder="اكتب القيمة الثابتة هنا (مثال: بنت، ولد، إعدادي...)"
                              className="w-full border-2 border-amber-500/20 rounded-xl pr-10 pl-4 py-3 text-sm font-bold text-slate-200 focus:outline-none focus:border-amber-500/40 focus:ring-4 focus:ring-amber-500/10 bg-amber-500/5"
                              value={staticValues[target] || ""}
                              onChange={(e) => handleStaticValueChange(target, e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-10 flex justify-center">
                <button onClick={generateAndDownload} disabled={isLoading} className="group relative flex items-center justify-center px-8 md:px-10 py-4 bg-emerald-600 text-white font-black text-base md:text-lg rounded-2xl hover:bg-emerald-500 shadow-xl hover:shadow-emerald-500/30 active:scale-95 transition-all disabled:opacity-50">
                  {isLoading ? <RefreshCcw className="animate-spin ml-3" size={24} /> : <Download className="ml-3 group-hover:-translate-y-1 transition-transform" size={24} />}
                  استخراج وتحميل الإكسيل النظيف
                </button>
              </div>
            </GlassCard>
          </div>
        )}
      </main>
    </div>
  );
}
