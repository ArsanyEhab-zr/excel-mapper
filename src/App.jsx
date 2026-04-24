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
  Plus
} from 'lucide-react';

// --- مكونات مساعدة ---
const GlassCard = ({ children, className = "" }) => (
  <div className={`bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl rounded-3xl p-8 ${className}`}>
    {children}
  </div>
);

const StepIndicator = ({ step, currentStep, label, icon: Icon }) => {
  const isActive = currentStep === step;
  const isCompleted = currentStep > step;

  return (
    <div className={`flex items-center space-x-3 space-x-reverse transition-all duration-300 ${isActive ? 'opacity-100 scale-105' : 'opacity-50 scale-100'}`}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-lg ${isCompleted ? 'bg-emerald-500 text-white' : isActive ? 'bg-indigo-600 text-white' : 'bg-white/80 text-slate-400 border border-slate-200'
        }`}>
        {isCompleted ? <CheckCircle2 size={24} /> : <Icon size={24} />}
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-slate-400">الخطوة {step}</p>
        <p className="text-sm font-bold text-slate-800">{label}</p>
      </div>
    </div>
  );
};

// --- المكون الأساسي ---
function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [targetColumns, setTargetColumns] = useState([]);
  const [sourceColumns, setSourceColumns] = useState([]);
  const [sourceData, setSourceData] = useState([]);

  // 🌟 تعديل جذري: الـ mappings بقت مصفوفة عشان نقدر ندمج كذا عمود
  const [mappings, setMappings] = useState({}); // { targetCol: ['sourceCol1', 'sourceCol2'] }
  const [staticValues, setStaticValues] = useState({}); // { targetCol: 'بنت' }

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [templateFileName, setTemplateFileName] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");

  // --- دوال المعالجة ---
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

          // raw: false عشان التواريخ تتقرأ كنص
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

  // تغيير عمود معين جوه المصفوفة
  const handleMappingChange = (target, index, value) => {
    setMappings(prev => {
      const currentArr = [...(prev[target] || [""])];
      currentArr[index] = value;
      return { ...prev, [target]: currentArr };
    });
  };

  // إضافة عمود جديد للدمج
  const addMappingField = (target) => {
    setMappings(prev => ({
      ...prev,
      [target]: [...(prev[target] || [""]), ""]
    }));
  };

  // حذف عمود من الدمج
  const removeMappingField = (target, index) => {
    setMappings(prev => {
      const currentArr = [...(prev[target] || [""])];
      currentArr.splice(index, 1);
      return { ...prev, [target]: currentArr };
    });
  };

  const handleStaticValueChange = (target, value) => {
    setStaticValues(prev => ({
      ...prev,
      [target]: value
    }));
  };

  const generateAndDownload = () => {
    setIsLoading(true);
    try {
      const transformedData = sourceData.map(row => {
        const newRow = {};

        targetColumns.forEach(target => {
          const sourcesArr = mappings[target] || [];

          // تجميع القيم المدموجة
          const parts = sourcesArr.map(sourceCol => {
            if (sourceCol === '__STATIC__') return staticValues[target] || "";
            if (sourceCol) return row[sourceCol] ?? "";
            return "";
          }).filter(val => String(val).trim() !== ""); // فلترة القيم الفاضية

          // دمج القيم بفاصل (شرطة) عشان العنوان يطلع منسق
          let combinedValue = parts.join(" - ");

          // 🌟 الفلتر الذكي لحل مشكلة الصفر المفقود في التليفونات 🌟
          // بيدور على أي 10 أرقام بتبدأ بـ 1 (موبايل) أو 8 أرقام بتبدأ بـ 3 (أرضي إسكندرية) ويحط صفر
          combinedValue = combinedValue.replace(/(^|\D)(1[0125]\d{8})(\D|$)/g, '$10$2$3'); // الموبايلات
          combinedValue = combinedValue.replace(/(^|\D)(3\d{7})(\D|$)/g, '$10$2$3');       // الأرضي

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
    <div className="max-w-5xl mx-auto px-4 py-12 md:py-20 min-h-screen font-sans" dir="rtl">
      {/* رأس الصفحة */}
      <div className="text-center mb-16 space-y-4">
        <div className="flex justify-center mb-6">
          <div className="bg-indigo-600/10 p-4 rounded-3xl shadow-inner">
            <Layout className="text-indigo-600" size={48} />
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
          منظف <span className="text-indigo-600">أرشيف الخدمة</span>
        </h1>
        <p className="text-slate-500 text-lg font-bold max-w-2xl mx-auto">
          أداة سحرية لدمج الأعمدة، استعادة أصفار التليفونات المفقودة، وتجهيز الداتا للأبلكيشن.
        </p>
      </div>

      {/* عداد الخطوات */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 bg-white/50 p-4 rounded-3xl shadow-sm border border-white/50">
        <StepIndicator step={1} currentStep={currentStep} label="التمبليت (الأعمدة المطلوبة)" icon={FileText} />
        <StepIndicator step={2} currentStep={currentStep} label="الداتا القديمة (الأرشيف)" icon={FileSpreadsheet} />
        <StepIndicator step={3} currentStep={currentStep} label="الدمج والتصدير" icon={Download} />
      </div>

      <main className="transition-all duration-500">
        {error && (
          <div className="mb-8 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-start space-x-3 space-x-reverse shadow-sm">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <p className="text-sm font-bold flex-1">{error}</p>
            <button onClick={() => setError(null)} className="hover:bg-rose-200 p-1 rounded-lg transition-colors"><X size={16} /></button>
          </div>
        )}

        {/* الخطوة 1 */}
        {currentStep === 1 && (
          <GlassCard className="text-center">
            <div className="p-12 border-2 border-dashed border-indigo-200 rounded-3xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer relative group">
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleTemplateUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform"><Upload size={36} /></div>
                <h3 className="text-2xl font-black text-slate-800 mb-2">ارفع ملف التمبليت الفاضي</h3>
                <p className="text-slate-500 font-bold max-w-sm mx-auto text-sm">ارفع ملف إكسيل يحتوي فقط على الصف الأول الذي يضم أسماء الأعمدة المطلوبة في التطبيق الجديد.</p>
              </div>
            </div>
          </GlassCard>
        )}

        {/* الخطوة 2 */}
        {currentStep === 2 && (
          <GlassCard>
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3 space-x-reverse text-emerald-600 font-black text-sm bg-emerald-50 px-4 py-2 rounded-xl">
                <CheckCircle2 size={18} /><span>التمبليت المقروء: {templateFileName}</span>
              </div>
              <button onClick={() => setCurrentStep(1)} className="text-sm text-slate-400 hover:text-indigo-600 font-black flex items-center bg-slate-50 px-3 py-2 rounded-xl">
                تغيير التمبليت <ArrowLeft size={14} className="mr-1" />
              </button>
            </div>
            <div className="p-12 border-2 border-dashed border-emerald-200 rounded-3xl hover:border-emerald-400 hover:bg-emerald-50/50 transition-all cursor-pointer relative text-center group">
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleSourceUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform"><FileSpreadsheet size={36} /></div>
                <h3 className="text-2xl font-black text-slate-800 mb-2">ارفع ملف الداتا القديمة</h3>
                <p className="text-slate-500 font-bold max-w-sm mx-auto text-sm">قم برفع الإكسيل القديم المليء بالبيانات العشوائية.</p>
              </div>
            </div>
          </GlassCard>
        )}

        {/* الخطوة 3 */}
        {currentStep === 3 && (
          <div className="space-y-8">
            <GlassCard>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-200 text-sm">
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center space-x-2 space-x-reverse bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-bold w-fit"><span className="text-indigo-400">التمبليت:</span><span>{templateFileName}</span></div>
                  <div className="flex items-center space-x-2 space-x-reverse bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-bold w-fit"><span className="text-emerald-400">الداتا:</span><span>{sourceFileName}</span></div>
                </div>
                <button onClick={resetAll} className="flex items-center text-rose-500 font-black bg-rose-50 hover:bg-rose-100 px-4 py-2 rounded-xl transition-colors w-fit">
                  <RefreshCcw size={16} className="ml-2" /> البدء من جديد
                </button>
              </div>

              <div className="grid grid-cols-1 gap-5 max-h-[600px] overflow-y-auto pl-2 custom-scrollbar">
                <div className="flex items-center font-black text-slate-400 text-xs px-4 mb-2">
                  <div className="w-1/3">أعمدة التمبليت (الجديدة)</div>
                  <div className="w-2/3">مصدر البيانات (الداتا القديمة المدمجة)</div>
                </div>

                {targetColumns.map((target) => {
                  const targetMappings = mappings[target] || [""];
                  const hasStatic = targetMappings.includes('__STATIC__');

                  return (
                    <div key={target} className={`flex flex-col p-5 rounded-2xl border transition-all ${hasStatic ? 'bg-amber-50/50 border-amber-200' : 'bg-white/80 border-slate-200 hover:border-indigo-300'}`}>
                      <div className="flex flex-col md:flex-row md:items-start gap-4">
                        {/* اسم العمود الجديد */}
                        <div className="w-full md:w-1/3 flex items-center space-x-3 space-x-reverse mt-2">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-inner shrink-0 ${hasStatic ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                            <Layout size={14} />
                          </div>
                          <span className="font-black text-slate-800 text-sm">{target}</span>
                        </div>

                        {/* العواميد المدموجة */}
                        <div className="w-full md:w-2/3 flex flex-col space-y-3">
                          {targetMappings.map((mappedVal, idx) => (
                            <div key={idx} className="flex items-center space-x-2 space-x-reverse w-full">
                              {idx === 0 ? <ArrowLeft className="text-slate-300 shrink-0" size={18} /> : <Plus className="text-indigo-400 shrink-0" size={18} />}

                              <div className="relative w-full">
                                <select
                                  className={`w-full border rounded-xl px-4 py-3 text-sm font-bold appearance-none transition-all cursor-pointer outline-none focus:ring-2 ${mappedVal === '__STATIC__' ? 'bg-amber-100 border-amber-300 text-amber-800 focus:ring-amber-500/20' :
                                      mappedVal ? 'bg-emerald-50 border-emerald-200 text-emerald-800 focus:ring-emerald-500/20' :
                                        'bg-white border-slate-200 text-slate-500 focus:ring-indigo-500/20 focus:border-indigo-500'
                                    }`}
                                  value={mappedVal || ""}
                                  onChange={(e) => handleMappingChange(target, idx, e.target.value)}
                                >
                                  <option value="" className="text-slate-400">-- تجاهل (سيبقى فارغاً) --</option>
                                  <option value="__STATIC__" className="text-amber-700 font-black">✏️ إدخال قيمة ثابتة للكل...</option>
                                  {sourceColumns.map(source => (
                                    <option key={source} value={source} className="text-slate-800 font-bold">{source}</option>
                                  ))}
                                </select>
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                              </div>

                              {/* زرار حذف العمود المدموج */}
                              {idx > 0 && (
                                <button onClick={() => removeMappingField(target, idx)} className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-xl transition-colors shrink-0">
                                  <X size={18} />
                                </button>
                              )}
                            </div>
                          ))}

                          {/* زرار إضافة عمود جديد للدمج */}
                          {!hasStatic && (
                            <button onClick={() => addMappingField(target)} className="text-xs text-indigo-500 font-black flex items-center w-fit hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors mt-1 mr-7">
                              + دمج عمود آخر
                            </button>
                          )}
                        </div>
                      </div>

                      {/* حقل الإدخال لو اختار قيمة ثابتة */}
                      {hasStatic && (
                        <div className="w-full flex justify-end animate-in slide-in-from-top-2 mt-4">
                          <div className="w-full md:w-2/3 relative pr-7">
                            <PenTool className="absolute right-10 top-1/2 -translate-y-1/2 text-amber-400" size={16} />
                            <input
                              type="text"
                              placeholder={`اكتب القيمة الثابتة هنا (مثال: بنت، ولد، إعدادي...)`}
                              className="w-full border-2 border-amber-200 rounded-xl pr-10 pl-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100 bg-amber-50/50"
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
                <button onClick={generateAndDownload} disabled={isLoading} className="group relative flex items-center justify-center px-10 py-4 bg-indigo-600 text-white font-black text-lg rounded-2xl hover:bg-indigo-700 shadow-xl hover:shadow-indigo-500/40 active:scale-95 transition-all disabled:opacity-50">
                  {isLoading ? <RefreshCcw className="animate-spin ml-3" size={24} /> : <Download className="ml-3 group-hover:-translate-y-1 transition-transform" size={24} />}
                  استخراج وتحميل الإكسيل النظيف
                </button>
              </div>
            </GlassCard>

          </div>
        )}
      </main>

      {/* خلفية فنية */}
      <div className="fixed top-0 right-0 -z-10 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-400/20 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 -left-32 w-96 h-96 bg-emerald-400/20 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}

export default App;