import { useState, useRef, useCallback } from 'react';
import { format, addDays, nextMonday } from 'date-fns';
import {
  Upload, X, ChevronRight, ChevronLeft, AlertCircle, CheckCircle2,
  Bike, TrendingUp, Activity, Heart, Leaf, Mountain, Circle,
} from 'lucide-react';
import { parseWorkoutFile, mapToScheduledWorkouts } from '../../utils/workoutImporter';
import type { RawImportWorkout, MappedWorkout, ImportedPlanMeta } from '../../utils/workoutImporter';
import type { Workout } from '../../types';
import { trainingPlansService } from '../../services/trainingPlansService';

interface WorkoutImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  onImportSuccess: () => void;
}

type Step = 'upload' | 'configure' | 'preview';

const TYPE_ICONS: Record<string, React.ElementType> = {
  bike: Bike,
  run: TrendingUp,
  swim: Activity,
  strength: Heart,
  yoga: Leaf,
  hiking: Mountain,
  rest: Circle,
};

const INTENSITY_COLORS: Record<string, string> = {
  recovery: 'bg-blue-500/20 text-blue-300',
  easy: 'bg-green-500/20 text-green-300',
  moderate: 'bg-yellow-500/20 text-yellow-300',
  hard: 'bg-red-500/20 text-red-300',
};

function getDefaultStartDate(): string {
  const today = new Date();
  const monday = nextMonday(today);
  return format(monday, 'yyyy-MM-dd');
}

export function WorkoutImportModal({ isOpen, onClose, planId, onImportSuccess }: WorkoutImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [valid, setValid] = useState<RawImportWorkout[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [hasExplicitDates, setHasExplicitDates] = useState(false);
  const [importedPlan, setImportedPlan] = useState<ImportedPlanMeta | undefined>(undefined);
  const [startDateStr, setStartDateStr] = useState(getDefaultStartDate);
  const [mapped, setMapped] = useState<MappedWorkout[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processFile = (file: File) => {
    if (!file.name.endsWith('.json')) {
      setParseErrors(['Please upload a .json file.']);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseWorkoutFile(text);
      setValid(result.valid);
      setParseErrors(result.errors);
      setHasExplicitDates(result.hasExplicitDates);
      setImportedPlan(result.importedPlan);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleConfigureNext = () => {
    const startDate = new Date(startDateStr + 'T00:00:00');
    setMapped(mapToScheduledWorkouts(valid, startDate));
    setStep('preview');
  };

  const handleImport = async () => {
    setImporting(true);
    setImportError(null);
    try {
      if (importedPlan) {
        // Build full Workout objects for createPlan (id is a placeholder; Supabase generates the real one)
        const workouts: Workout[] = mapped.map((w, i) => ({
          id: `import-${i}`,
          name: w.name,
          type: w.type as Workout['type'],
          description: w.description,
          duration: w.duration,
          distance: w.distance,
          intensity: w.intensity as Workout['intensity'],
          scheduledDate: w.scheduledDate,
          completed: false,
          status: 'planned',
          activity_metadata: w.activity_metadata as Workout['activity_metadata'],
        }));

        const dates = mapped.map(w => w.scheduledDate.getTime());
        const startDate = new Date(Math.min(...dates));
        const endDate = importedPlan.eventDate ?? new Date(Math.max(...dates));

        await trainingPlansService.createPlan({
          name: importedPlan.title,
          goal: importedPlan.goal,
          description: importedPlan.description ?? '',
          startDate,
          endDate,
          workouts,
        });
      } else {
        await trainingPlansService.addWorkoutsToPlan(planId, mapped);
      }
      onImportSuccess();
    } catch (err) {
      setImportError((err as Error).message || 'Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    // Reset state on close
    setStep('upload');
    setValid([]);
    setParseErrors([]);
    setHasExplicitDates(false);
    setImportedPlan(undefined);
    setStartDateStr(getDefaultStartDate());
    setMapped([]);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const lastWorkoutDate =
    valid.length > 0
      ? addDays(
          new Date(startDateStr + 'T00:00:00'),
          valid[valid.length - 1].dayOffset ?? valid.length - 1
        )
      : null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Upload className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Import Workouts</h2>
              <p className="text-slate-500 text-xs">
                {step === 'upload' && 'Upload a JSON file'}
                {step === 'configure' && 'Set a start date'}
                {step === 'preview' && 'Review & confirm'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-800 shrink-0">
          {(['upload', 'configure', 'preview'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  s === step
                    ? 'bg-indigo-500 text-white'
                    : step === 'preview' || (step === 'configure' && i === 0)
                    ? 'bg-indigo-500/30 text-indigo-400'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {i + 1}
              </div>
              {i < 2 && <div className="w-8 h-px bg-slate-700" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ── Step 1: Upload ── */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-indigo-400 bg-indigo-500/10'
                    : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50'
                }`}
              >
                <Upload className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-300 text-sm font-medium">Drop your JSON file here</p>
                <p className="text-slate-500 text-xs mt-1">or click to browse</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Errors */}
              {parseErrors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="text-red-400 text-xs font-medium">
                      {parseErrors.length} issue{parseErrors.length !== 1 ? 's' : ''} found
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {parseErrors.map((e, i) => (
                      <li key={i} className="text-red-300 text-xs pl-5">{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Valid count */}
              {valid.length > 0 && (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  <span className="text-green-300 text-xs font-medium">
                    Found {valid.length} valid workout{valid.length !== 1 ? 's' : ''}
                    {parseErrors.length > 0 && ` (${parseErrors.length} skipped)`}
                  </span>
                </div>
              )}

              {/* Format hint */}
              <details className="group">
                <summary className="text-slate-500 text-xs cursor-pointer hover:text-slate-400 transition-colors">
                  Expected JSON format
                </summary>
                <pre className="mt-2 bg-slate-950 rounded-lg p-3 text-xs text-slate-400 overflow-x-auto">
{`[
  {
    "name": "4x8m Threshold",
    "type": "bike",
    "duration": 60,
    "intensity": "hard",
    "dayOffset": 0,
    "description": "..."
  }
]`}
                </pre>
              </details>
            </div>
          )}

          {/* ── Step 2: Configure ── */}
          {step === 'configure' && (
            <div className="space-y-5">
              {importedPlan && (
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-3 py-2.5">
                  <p className="text-indigo-300 text-xs font-medium mb-0.5">Creating new plan</p>
                  <p className="text-white text-sm font-semibold">{importedPlan.title}</p>
                  {importedPlan.goal && (
                    <p className="text-slate-400 text-xs mt-0.5">Goal: {importedPlan.goal}</p>
                  )}
                </div>
              )}
              <p className="text-slate-300 text-sm">
                <span className="font-semibold text-white">{valid.length}</span> workout{valid.length !== 1 ? 's' : ''} ready to schedule.
              </p>

              {hasExplicitDates ? (
                <div className="flex items-start gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-indigo-300 text-xs">
                    All workouts have explicit dates from the file and will be scheduled as provided. The date picker below is not needed but can be used to shift workouts without explicit dates.
                  </p>
                </div>
              ) : (
                <div>
                  <label htmlFor="import-start-date" className="block text-slate-400 text-xs font-medium mb-1.5">
                    Block start date
                  </label>
                  <input
                    id="import-start-date"
                    type="date"
                    value={startDateStr}
                    onChange={e => setStartDateStr(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
                  />
                </div>
              )}

              {!hasExplicitDates && lastWorkoutDate && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2.5">
                  <p className="text-slate-400 text-xs">
                    This block will span{' '}
                    <span className="text-white font-medium">
                      {format(new Date(startDateStr + 'T00:00:00'), 'MMM d')}
                    </span>
                    {' → '}
                    <span className="text-white font-medium">
                      {format(lastWorkoutDate, 'MMM d, yyyy')}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Preview ── */}
          {step === 'preview' && (
            <div className="space-y-3">
              <p className="text-slate-400 text-xs">
                Review the {mapped.length} workout{mapped.length !== 1 ? 's' : ''} below before importing.
              </p>
              <div className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">
                {mapped.map((w, i) => {
                  const Icon = TYPE_ICONS[w.type] ?? Activity;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5"
                    >
                      <div className="shrink-0 text-slate-400">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">{w.name}</p>
                        <p className="text-slate-500 text-xs">
                          {format(w.scheduledDate, 'EEE, MMM d')} · {w.duration}min
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                          INTENSITY_COLORS[w.intensity] ?? 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {w.intensity}
                      </span>
                    </div>
                  );
                })}
              </div>

              {importError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-300 text-xs">{importError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 shrink-0">
          {step === 'upload' && (
            <>
              <button onClick={handleClose} className="text-slate-400 hover:text-white text-sm transition-colors">
                Cancel
              </button>
              <button
                onClick={() => setStep('configure')}
                disabled={valid.length === 0}
                className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {step === 'configure' && (
            <>
              <button
                onClick={() => setStep('upload')}
                className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                onClick={handleConfigureNext}
                disabled={!startDateStr}
                className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Preview <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('configure')}
                disabled={importing}
                className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {importing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    {importedPlan
                      ? `Create Plan (${mapped.length} workout${mapped.length !== 1 ? 's' : ''})`
                      : `Import ${mapped.length} Workout${mapped.length !== 1 ? 's' : ''}`}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
