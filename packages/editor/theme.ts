/** Match the website's Theme ◐ toggle; follow the system until explicitly switched. */
export function initializeTheme(button: HTMLButtonElement) {
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let override: boolean | undefined;
  const apply = () => {
    const dark = override ?? system.matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    button.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
  };
  button.addEventListener('click', () => {
    override = !(override ?? system.matches);
    apply();
  });
  system.addEventListener('change', apply);
  apply();
}
