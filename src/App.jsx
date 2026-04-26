import React, { useState } from 'react';
import { Scissors, PenTool, FileSpreadsheet, ChevronLeft, Sparkles, ArrowLeft, ListOrdered } from 'lucide-react';
import ExcelSplitter from './components/ExcelSplitter';
import ExcelMapper from './components/ExcelMapper';
import ManualSplitter from './components/ManualSplitter';

// ─── Landing Page ───
function LandingPage({ onSelect }) {
  return (
    <div className="min-h-screen grid-bg flex flex-col" dir="rtl">
      {/* Ambient Glow Blobs */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-0 -left-40 w-[400px] h-[400px] bg-cyan-500/8 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '2s' }} />
      </div>

      {/* Nav */}
      <nav className="w-full px-4 md:px-8 py-5 flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
            <FileSpreadsheet size={20} className="text-emerald-400" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">
            exel<span className="text-gradient">&#123;ar&#125;</span>
          </h1>
        </div>
        <span className="text-xs font-bold text-slate-600 hidden sm:block">أدوات إكسيل ذكية</span>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
        <div className="text-center mb-12 md:mb-16 animate-slide-up max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 text-xs font-bold px-4 py-1.5 rounded-full mb-6">
            <Sparkles size={14} /> أدوات متقدمة لمعالجة البيانات
          </div>
          <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight mb-5">
            بياناتك، <span className="text-gradient">بشكل أفضل</span>
          </h2>
          <p className="text-slate-400 text-sm md:text-base font-bold max-w-lg mx-auto leading-relaxed">
            قسّم ملفاتك الضخمة أو أعِد تنظيم بياناتك الفوضوية — كل ذلك من المتصفح مباشرة.
          </p>
        </div>

        {/* Path Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 w-full max-w-5xl animate-slide-up stagger-2">
          {/* Path A: Split */}
          <button
            onClick={() => onSelect('split')}
            className="group glass-card rounded-2xl md:rounded-3xl p-6 md:p-8 text-right transition-all duration-300 hover:border-emerald-500/30 hover:shadow-[0_0_60px_-15px_rgba(16,185,129,0.25)] active:scale-[0.98] cursor-pointer"
          >
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all">
              <Scissors size={28} className="text-emerald-400" />
            </div>
            <h3 className="text-xl md:text-2xl font-black text-white mb-2">تقسيم الإكسيل</h3>
            <p className="text-slate-500 text-sm font-bold leading-relaxed mb-5">
              قسّم ملف إكسيل كبير إلى ملفات صغيرة حسب عدد الصفوف أو قيمة عمود معيّن.
            </p>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-black group-hover:gap-3 transition-all">
              ابدأ الآن <ChevronLeft size={16} />
            </div>
          </button>

          {/* Path B: Renew */}
          <button
            onClick={() => onSelect('mapper')}
            className="group glass-card rounded-2xl md:rounded-3xl p-6 md:p-8 text-right transition-all duration-300 hover:border-cyan-500/30 hover:shadow-[0_0_60px_-15px_rgba(6,182,212,0.25)] active:scale-[0.98] cursor-pointer"
          >
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/15 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-cyan-500/20 transition-all">
              <PenTool size={28} className="text-cyan-400" />
            </div>
            <h3 className="text-xl md:text-2xl font-black text-white mb-2">تجديد البيانات</h3>
            <p className="text-slate-500 text-sm font-bold leading-relaxed mb-5">
              نظّم بيانات الإكسيل الفوضوية وطابقها مع تمبليت جديد ونظيف.
            </p>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-black group-hover:gap-3 transition-all">
              ابدأ الآن <ChevronLeft size={16} />
            </div>
          </button>

          {/* Path C: Manual Split */}
          <button
            onClick={() => onSelect('manual')}
            className="group glass-card rounded-2xl md:rounded-3xl p-6 md:p-8 text-right transition-all duration-300 hover:border-amber-500/30 hover:shadow-[0_0_60px_-15px_rgba(245,158,11,0.25)] active:scale-[0.98] cursor-pointer"
          >
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-amber-500/20 transition-all">
              <ListOrdered size={28} className="text-amber-400" />
            </div>
            <h3 className="text-xl md:text-2xl font-black text-white mb-2">تقسيم يدوي</h3>
            <p className="text-slate-500 text-sm font-bold leading-relaxed mb-5">
              حدد نطاقات الصفوف يدوياً وسمّي كل ملف ناتج بنفسك.
            </p>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-black group-hover:gap-3 transition-all">
              ابدأ الآن <ChevronLeft size={16} />
            </div>
          </button>
        </div>

        {/* Decorative Grid Cells */}
        <div className="mt-16 grid grid-cols-4 gap-1 opacity-20 animate-fade-in stagger-4">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className={`w-6 h-6 md:w-8 md:h-8 rounded border border-emerald-500/20 ${i % 5 === 0 ? 'animate-cell-highlight' : ''}`} />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-slate-600 text-xs font-bold animate-fade-in">
        made by zik&#123;ar&#125;❤️
      </footer>
    </div>
  );
}

// ─── App Router ───
export default function App() {
  const [view, setView] = useState('home');

  if (view === 'split') return <ExcelSplitter onGoHome={() => setView('home')} />;
  if (view === 'mapper') return <ExcelMapper onGoHome={() => setView('home')} />;
  if (view === 'manual') return <ManualSplitter onGoHome={() => setView('home')} />;
  return <LandingPage onSelect={setView} />;
}