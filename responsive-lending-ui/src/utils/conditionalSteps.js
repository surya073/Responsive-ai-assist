// Resolves which configured steps are actually "live" given the answers
// collected so far. Keeps conditional logic (e.g. skip visa questions for
// citizens) out of the UI components entirely — components just render
// whatever the engine says is the current step.

export function getVisibleSteps(allSteps, answers) {
  return allSteps.filter((step) =>
    typeof step.condition === 'function' ? step.condition(answers) : true
  );
}

export function getNextStepIndex(allSteps, currentIndex, answers) {
  for (let i = currentIndex + 1; i < allSteps.length; i += 1) {
    const step = allSteps[i];
    if (typeof step.condition !== 'function' || step.condition(answers)) {
      return i;
    }
  }
  return -1; // no more steps -> ready for summary
}

export function getPreviousStepIndex(allSteps, currentIndex, answers) {
  for (let i = currentIndex - 1; i >= 0; i -= 1) {
    const step = allSteps[i];
    if (typeof step.condition !== 'function' || step.condition(answers)) {
      return i;
    }
  }
  return -1; // back to welcome screen
}
