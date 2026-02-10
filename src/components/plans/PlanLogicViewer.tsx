
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

  const { athleteAssessment, macroCycle, weeklyLogic } = reasoning;

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
                  <div className="flex h-full flex-col overflow-y-scroll bg-white dark:bg-gray-900 shadow-xl">
                    <div className="px-4 sm:px-6 py-6 bg-indigo-600">
                      <div className="flex items-start justify-between">
                        <Dialog.Title className="text-xl font-semibold leading-6 text-white flex items-center gap-2">
                          <LightBulbIcon className="h-6 w-6 text-yellow-300" />
                          Plan Logic & Reasoning
                        </Dialog.Title>
                        <div className="ml-3 flex h-7 items-center">
                          <button
                            type="button"
                            className="relative rounded-md text-indigo-200 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
                            onClick={onClose}
                          >
                            <span className="absolute -inset-2.5" />
                            <span className="sr-only">Close panel</span>
                            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-indigo-100">
                        Behind the scenes of your AI-generated training plan.
                      </p>
                    </div>

                    <div className="relative mt-6 flex-1 px-4 sm:px-6 space-y-8 pb-10">
                      {/* Section 1: Assessment */}
                      <section>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
                          1️⃣ Coach's Assessment
                        </h3>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                           <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div>
                                <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fitness Level</span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white mt-1 block">{athleteAssessment.fitnessLevel}</span>
                              </div>
                              <div>
                                <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Constraints</span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white mt-1 block">{athleteAssessment.constraints}</span>
                              </div>
                           </div>
                           
                           <div className="mt-4">
                              <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Strengths & Limiters</span>
                              <div className="flex flex-wrap gap-2">
                                {athleteAssessment.strengths.map((s, i) => (
                                  <span key={`str-${i}`} className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                                    Why: {s}
                                  </span>
                                ))}
                                {athleteAssessment.limiters.map((l, i) => (
                                  <span key={`lim-${i}`} className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                                    Fix: {l}
                                  </span>
                                ))}
                              </div>
                           </div>
                        </div>
                      </section>

                      {/* Section 2: Strategy */}
                      <section>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
                          2️⃣ Season Strategy: {macroCycle.strategy}
                        </h3>
                        <div className="space-y-4">
                          {macroCycle.phases.map((phase, idx) => (
                            <div key={idx} className="relative pl-6 border-l-2 border-indigo-200 dark:border-indigo-900 last:border-transparent">
                              <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-indigo-600 ring-4 ring-white dark:ring-gray-900"></div>
                              <div className="mb-2">
                                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{phase.name}</span>
                                <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">({phase.weeks})</span>
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300">{phase.goal}</p>
                            </div>
                          ))}
                        </div>
                      </section>

                      {/* Section 3: Weekly Logic */}
                      <section>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
                          3️⃣ Weekly Breakdown
                        </h3>
                        <div className="space-y-4">
                          {weeklyLogic.map((week) => (
                            <div key={week.week} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:border-indigo-300 transition-colors">
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-semibold text-gray-900 dark:text-white">Week {week.week}</h4>
                                <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                                  TSS: {week.targetTSS}
                                </span>
                              </div>
                              <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mb-1">{week.focus}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-300 italic">"{week.keyWorkoutLogic}"</p>
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
