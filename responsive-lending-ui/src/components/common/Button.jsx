export default function Button({
  variant = 'primary',
  block = false,
  children,
  className = '',
  ...rest
}) {
  const classes = [
    'rl-btn',
    `rl-btn--${variant}`,
    block ? 'rl-btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
