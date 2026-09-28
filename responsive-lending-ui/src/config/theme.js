// Responsive Lending — design tokens
// Sourced from the live site (navy + gold, white/light-grey sections,
// rounded CTAs, soft shadows). Keep these centralised so the whole
// widget (and later, the embeddable loader) stays on-brand from one file.

export const theme = {
  color: {
    navy: '#12345B',
    navyDeep: '#0C2740',
    blue: '#1B416B',
    yellow: '#FFC400',
    yellowHover: '#EAAF00',
    white: '#FFFFFF',
    light: '#F5F6F8',
    border: '#E3E6EA',
    text: '#263238',
    muted: '#6B7280',
    success: '#1E8E5A',
    error: '#C4432B',
  },
  radius: {
    sm: '8px',
    md: '14px',
    lg: '20px',
    pill: '999px',
  },
  shadow: {
    sm: '0 2px 8px rgba(18, 52, 91, 0.08)',
    md: '0 8px 24px rgba(18, 52, 91, 0.14)',
    lg: '0 16px 40px rgba(18, 52, 91, 0.20)',
  },
  font: {
    family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
};

export default theme;
