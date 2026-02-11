import React from 'react';
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, LightBulbIcon } from '@heroicons/react/24/outline';
import { PlanReasoning } from '../../types';

interface PlanLogicViewerProps {
  isOpen: boolean;
  onClose: () => void;
  reasoning?: PlanReasoning;
}

const PlanLogicViewer: React.FC<PlanLogicViewerProps> = ({ isOpen, onClose, reasoning }) => {
  if (!reasoning) return null;

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-500"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-500"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-500 sm:duration-700"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500 sm:duration-700"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-2xl">
                  <div className="flex h-full flex-col overflow-y-scroll bg-slate-900 shadow-xl border-l border-white/10">
                    <div className="px-6 py-6 bg-indigo-500/10 border-b border-white/10">
                      <div className="flex items-start justify-between">
                        <Dialog.Title className="text-xl font-semibold leading-6 text-white flex items-center gap-2">
                          <LightBulbIcon className="h-6 w-6 text-indigo-400" />
                          Plan Logic & Reasoning
                        </Dialog.Title>
                        <div className="ml-3 flex h-7 items-center">
                          <button
                            type="button"
                            className="relative rounded-md text-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
                            onClick={onClose}
                          >
                            <span className="absolute -inset-2.5" />
                            <span className="sr-only">Close panel</span>
                            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        Behind the scenes of your AI-generated training plan.
                      </p>
                    </div>

                    <div className="relative mt-6 flex-1 px-4 sm:px-6 space-y-8 pb-10">
                      {/* Section 1: Assessment */}
                      <section className="bg-slate-950/50 rounded-lg p-5 border border-white/5">
                        <h3 className="flex items-center gap-2 text-white font-medium mb-4">
                          <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">1</div>
                          Coach's Assessment
                        </h3>
                        
                        <div className="grid md:grid-cols-2 gap-6 text-sm">
                          <div>
                            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Fitness Level</span>
                            <p className="mt-1 text-slate-300">{reasoning.athleteAssessment.fitnessLevel}</p>
                          </div>
                          <div>
                            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Constraints</span>
                            <p className="mt-1 text-slate-300">{reasoning.athleteAssessment.constraints}</p>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/5">
                            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold block mb-2">Strengths & Limiters</span>
                            <div className="flex flex-wrap gap-2">
                                {reasoning.athleteAssessment.strengths.map(s => (
                                    <span key={s} className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded border border-green-500/20">{s}</span>
                                ))}
                                {reasoning.athleteAssessment.limiters.map(l => (
                                    <span key={l} className="px-2 py-1 bg-orange-500/10 text-orange-400 text-xs rounded border border-orange-500/20">{l}</span>
                                ))}
                            </div>
                        </div>
                      </section>

                      {/* Section 2: Strategy */}
                      <section>
                         <h3 className="flex items-center gap-2 text-white font-medium mb-4">
                          <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">2</div>
                          Season Strategy: {reasoning.macroCycle.strategy}
                        </h3>

                        <div className="pl-3 border-l-2 border-slate-800 space-y-6 ml-3">
                            {reasoning.macroCycle.phases.map((phase, i) => (
                                <div key={i} className="relative pl-6">
                                    <div className="absolute -left-[21px] top-1 w-4 h-4 rounded-full bg-indigo-500 border-2 border-slate-900"></div>
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="text-indigo-400 font-medium">{phase.name}</span>
                                        <span className="text-xs text-slate-500">({phase.weeks})</span>
                                    </div>
                                    <p className="text-sm text-slate-300">{phase.goal}</p>
                                </div>
                            ))}
                        </div>
                      </section>

                      {/* Section 3: Weekly Logic */}
                      <section>
                        <h3 className="flex items-center gap-2 text-white font-medium mb-4">
                          <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">3</div>
                          Weekly Breakdown
                        </h3>
                        
                        <div className="space-y-4">
                            {reasoning.weeklyLogic.map((week) => (
                                <div key={week.week} className="bg-slate-950/30 rounded border border-white/5 p-4 hover:border-white/10 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-medium text-white">Week {week.week}</h4>
                                        <span className="text-xs bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">TSS: {week.targetTSS}</span>
                                    </div>
                                    <div className="text-sm text-slate-300">
                                        <strong className="text-indigo-400">Focus: {week.focus}</strong>
                                        <p className="mt-1 text-slate-400 text-xs">{week.keyWorkoutLogic}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                      </section>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default PlanLogicViewer;
