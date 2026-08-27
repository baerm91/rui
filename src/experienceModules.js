let experienceUiPromise;

export const loadExperienceUi = () => {
  experienceUiPromise ??= import('./App.jsx');
  return experienceUiPromise;
};
