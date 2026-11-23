import React from 'react';
import { X } from 'lucide-react';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4">
      <div className="hud-surface w-full max-w-md rounded-2xl p-6 text-slate-100">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-700/70">
          <h2 className="font-display text-lg font-bold text-amber-300">
            바스티온 크라운 조작 안내
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs sm:text-sm text-slate-300">
          <div className="flex justify-between gap-4 py-1 border-b border-slate-800">
            <span className="text-slate-400">적 직접 타격 (천벌 낙뢰)</span>
            <span className="font-medium text-slate-100">전장의 적 클릭</span>
          </div>
          <div className="flex justify-between gap-4 py-1 border-b border-slate-800">
            <span className="text-slate-400">수비대 슬롯 선택</span>
            <span className="font-medium text-slate-100">성채 위 원형 슬롯 클릭</span>
          </div>
          <div className="flex justify-between gap-4 py-1 border-b border-slate-800">
            <span className="text-slate-400">액티브 스킬 발동</span>
            <span className="font-mono-num font-medium text-amber-300">키보드 1 / 2 / 3</span>
          </div>
          <div className="flex justify-between gap-4 py-1 border-b border-slate-800">
            <span className="text-slate-400">다음 웨이브 시작</span>
            <span className="font-mono-num font-medium text-amber-300">Space</span>
          </div>
          <div className="flex justify-between gap-4 py-1">
            <span className="text-slate-400">하단 컨트롤 숨기기/열기</span>
            <span className="font-mono-num font-medium text-amber-300">H</span>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-400 leading-relaxed">
          성벽을 증축할수록 성채가 2층 천수각과 황금 첨탑으로 성장하며, 최대 6개의 성벽 수비대 슬롯이 열립니다.
        </p>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
          >
            전장으로 복귀
          </button>
        </div>
      </div>
    </div>
  );
};
