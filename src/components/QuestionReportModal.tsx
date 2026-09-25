import React, { useState, useEffect } from 'react';
import { QuizQuestion, QuizCategory } from '../types';
import { FormattedText } from './FormattedText';
import { getSubmissionTargetId } from '../utils/crypto';
import {
  X,
  Send,
  ExternalLink,
  Check,
  AlertCircle,
  Flag,
  Loader2,
} from 'lucide-react';

export interface QuestionReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: QuizQuestion | null;
  category?: QuizCategory | null;
  categoryTitle?: string;
}

export const GOOGLE_FORM_VIEW_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScarli5hXQ2t_aKZSZr_bCxB9wFqdfsp4E1uphkfWHH1E8WtQ/viewform';
export const GOOGLE_FORM_RESPONSE_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScarli5hXQ2t_aKZSZr_bCxB9wFqdfsp4E1uphkfWHH1E8WtQ/formResponse';

export const FORM_ENTRY_ID = 'entry.1180797943'; // id
export const FORM_ENTRY_ASSESSMENT = 'entry.429753334'; // assessment: 'good' | 'bad'
export const FORM_ENTRY_REPORT = 'entry.85167298'; // report: 長文回答

const REPORT_PRESETS = [
  '解答が間違っている',
  '問題文に誤字・脱字がある',
  '問題文が不鮮明・分かりにくい',
  '解説を改善してほしい',
];

export function QuestionReportModal({
  isOpen,
  onClose,
  question,
  category,
  categoryTitle,
}: QuestionReportModalProps) {
  const [reportText, setReportText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && question) {
      setReportText('');
      setIsSubmitting(false);
      setSubmitSuccess(false);
      setSubmitError(null);
    }
  }, [isOpen, question?.id]);

  if (!isOpen || !question) return null;

  const getPrefilledUrl = () => {
    const targetId = getSubmissionTargetId(question, category);
    const params = new URLSearchParams();
    params.set(FORM_ENTRY_ID, targetId);
    if (reportText.trim()) {
      params.set(FORM_ENTRY_REPORT, reportText.trim());
    }
    return `${GOOGLE_FORM_VIEW_URL}?${params.toString()}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportText.trim()) {
      setSubmitError('報告内容（長文回答）を入力してください。');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const targetId = getSubmissionTargetId(question, category);
      const formData = new URLSearchParams();
      formData.append(FORM_ENTRY_ID, targetId);
      formData.append(FORM_ENTRY_REPORT, reportText.trim());

      // Include existing assessment if user already voted good/bad
      const savedAssessment = localStorage.getItem(`assessment_${question.id}`);
      if (savedAssessment === 'good' || savedAssessment === 'bad') {
        formData.append(FORM_ENTRY_ASSESSMENT, savedAssessment);
      }

      await fetch(GOOGLE_FORM_RESPONSE_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      setSubmitSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      console.error('Failed to submit report:', err);
      setSubmitError('送信中にエラーが発生しました。外部フォームから送信することもできます。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePresetClick = (preset: string) => {
    if (reportText.includes(preset)) return;
    setReportText((prev) => (prev.trim() ? `${prev.trim()}\n${preset}` : preset));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300">
              <Flag className="w-4 h-4 text-rose-500" />
            </span>
            <div>
              <h3 id="report-modal-title" className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                問題の報告
              </h3>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate max-w-[220px]">
                {categoryTitle ? `${categoryTitle} • ` : ''}ID: {question.id}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        {submitSuccess ? (
          <div className="p-6 text-center space-y-2.5 animate-fadeIn">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              報告を送信しました
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              ご協力ありがとうございます。内容を確認して改善いたします。
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 text-xs">
            {/* Target Question Summary */}
            <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60">
              <div className="flex items-center justify-between text-[10px] text-neutral-400 dark:text-neutral-500 mb-1">
                <span>対象問題</span>
                <span className="font-mono font-semibold text-neutral-600 dark:text-neutral-300">
                  ID: {question.id} (自動入力)
                </span>
              </div>
              <p className="text-neutral-800 dark:text-neutral-200 font-medium line-clamp-2 leading-relaxed">
                <FormattedText text={question.question} />
              </p>
            </div>

            {/* Long Text Answer (entry.85167298) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                  報告内容（長文回答） <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-neutral-400">entry.85167298</span>
              </div>

              {/* Quick Tags */}
              <div className="flex flex-wrap gap-1 mb-2">
                {REPORT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400 transition-colors cursor-pointer"
                  >
                    + {preset}
                  </button>
                ))}
              </div>

              <textarea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="問題の誤り、解説の間違い、改善要望などを入力してください..."
                rows={4}
                required
                className="w-full p-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 text-xs focus:outline-hidden focus:ring-1 focus:ring-neutral-400"
              />
            </div>

            {submitError && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-1 space-y-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 rounded-xl font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>送信中...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>報告を送信する</span>
                  </>
                )}
              </button>

              <div className="text-center">
                <a
                  href={getPrefilledUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:underline pt-0.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Googleフォームを直接開く</span>
                </a>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default QuestionReportModal;
