import { useCallback, useMemo, useState } from 'react';
import applicationSteps from '../config/applicationSteps';
import { getNextStepIndex, getPreviousStepIndex, getVisibleSteps } from '../utils/conditionalSteps';
import { validateStepValue } from '../utils/validation';

export const SESSION_STAGE = {
  WELCOME: 'welcome',
  IN_PROGRESS: 'in_progress',
  SUMMARY: 'summary',
  SUBMITTED: 'submitted',
};

// This hook IS the "deterministic application state machine" described in
// the build spec: it owns current step, completed answers, validation,
// next/previous navigation, and readiness for submission. Nothing about
// the AI or the UI is allowed to decide step order — they only read from
// and dispatch into this hook.
export function useApplicationSession() {
  const [stage, setStage] = useState(SESSION_STAGE.WELCOME);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [fieldError, setFieldError] = useState(null);

  const visibleSteps = useMemo(() => getVisibleSteps(applicationSteps, answers), [answers]);
  const currentStep = applicationSteps[currentIndex] ?? null;
  const currentVisiblePosition = useMemo(
    () => visibleSteps.findIndex((s) => s.id === currentStep?.id),
    [visibleSteps, currentStep]
  );

  const start = useCallback(() => {
    setStage(SESSION_STAGE.IN_PROGRESS);
    setCurrentIndex(0);
    setFieldError(null);
  }, []);

  const submitAnswer = useCallback(
    (rawValue) => {
      if (!currentStep) return { valid: false, error: 'No active step.' };
      const result = validateStepValue(currentStep, rawValue);
      if (!result.valid) {
        setFieldError(result.error);
        return result;
      }
      setFieldError(null);

      const nextAnswers = { ...answers, [currentStep.id]: result.value };
      setAnswers(nextAnswers);

      const nextIndex = getNextStepIndex(applicationSteps, currentIndex, nextAnswers);
      if (nextIndex === -1) {
        setStage(SESSION_STAGE.SUMMARY);
      } else {
        setCurrentIndex(nextIndex);
      }
      return result;
    },
    [answers, currentIndex, currentStep]
  );

  const goToPrevious = useCallback(() => {
    setFieldError(null);
    const prevIndex = getPreviousStepIndex(applicationSteps, currentIndex, answers);
    if (prevIndex === -1) {
      setStage(SESSION_STAGE.WELCOME);
    } else {
      setCurrentIndex(prevIndex);
      setStage(SESSION_STAGE.IN_PROGRESS);
    }
  }, [currentIndex, answers]);

  // Used from the summary screen's "Edit" action — jump straight to a
  // step by id, then resume the normal forward flow from there.
  const editStep = useCallback((stepId) => {
    const idx = applicationSteps.findIndex((s) => s.id === stepId);
    if (idx === -1) return;
    setFieldError(null);
    setCurrentIndex(idx);
    setStage(SESSION_STAGE.IN_PROGRESS);
  }, []);

  const goToSummary = useCallback(() => setStage(SESSION_STAGE.SUMMARY), []);

  const markSubmitted = useCallback(() => setStage(SESSION_STAGE.SUBMITTED), []);

  const reset = useCallback(() => {
    setStage(SESSION_STAGE.WELCOME);
    setCurrentIndex(0);
    setAnswers({});
    setFieldError(null);
  }, []);

  return {
    stage,
    currentStep,
    currentIndex,
    answers,
    fieldError,
    visibleSteps,
    totalSteps: visibleSteps.length,
    currentStepNumber: currentVisiblePosition === -1 ? visibleSteps.length : currentVisiblePosition + 1,
    start,
    submitAnswer,
    goToPrevious,
    editStep,
    goToSummary,
    markSubmitted,
    reset,
  };
}

export default useApplicationSession;
