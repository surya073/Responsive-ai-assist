export default function VoiceOrb({ state = 'idle' }) {
  return (
    <div className={`rl-orb rl-orb--${state}`} aria-hidden="true">
      <span className="rl-orb__ring rl-orb__ring--outer" />
      <span className="rl-orb__ring rl-orb__ring--inner" />
      <span className="rl-orb__core" />
    </div>
  );
}