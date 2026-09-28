import AssistantWidget from './components/widget/AssistantWidget';
import logo from './assets/responsive-lending-logo.png';
import transportIcon from './assets/transport.png';
import manIcon from './assets/man.png';
import skylineIcon from './assets/skyline.png';
import motorbikeIcon from './assets/motorbike.png';
import rightCorner from './assets/right-corner-png.png';
import './App.css';

const LOAN_CARDS = [
  {
    title: 'Car Loans',
    icon: transportIcon,
    accent: 'yellow',
    active: true,
  },
  {
    title: 'Personal Loans',
    icon: manIcon,
    accent: 'blue',
  },
  {
    title: 'Commercial Loans',
    icon: skylineIcon,
    accent: 'green',
  },
  {
    title: 'Motorbike Loans',
    icon: motorbikeIcon,
    accent: 'purple',
  },
];

const TRUST_POINTS = [
  {
    title: 'Quick & Easy',
    body: 'Simple application process with fast turnaround.',
    icon: 'bolt',
  },
  {
    title: 'No Obligation',
    body: 'Free quotes with zero pressure.',
    icon: 'shield',
  },
  {
    title: 'Competitive Rates',
    body: 'Access to 40+ trusted lenders.',
    icon: 'percent',
  },
  {
    title: 'Your Privacy Matters',
    body: 'Your information is safe and secure.',
    icon: 'lock',
  },
];

function TrustIcon({ name }) {
  switch (name) {
    case 'bolt':
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3 5 6v5c0 4.6 3 8.4 7 10 4-1.6 7-5.4 7-10V6l-7-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="m9 12 2 2 4-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'percent':
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="17" cy="17" r="2.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M6 18 18 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'lock':
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="5" y="11" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h13M13 6l7 6-7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function App() {
  return (
    <div className="host">
      <section className="host__hero">
        <div className="host__hero-glow" aria-hidden="true" />

        <div className="host__hero-inner">
          <div className="host__hero-content">
            <img src={logo} alt="Responsive Lending" className="host__logo" />

            <div className="host__eyebrow">
              <span>Your financial journey, our priority</span>
              <i />
            </div>

            <h1 className="host__headline">
              Responsive loans to
              <br />
              <span className="host__headline--accent">unlock your future</span>
            </h1>

            <p className="host__lede">
              Compare over 40 lenders with Responsive Lending to find the best
              finance option for you. Quote enquiries are obligation free,
              cost free and don&apos;t impact your credit score.
            </p>

            <button type="button" className="host__cta">
              Get My Free Quote
              <ArrowIcon />
            </button>
          </div>

          <div className="host__hero-art">
            <img src={rightCorner} alt="" aria-hidden="true" className="host__hero-art-img" />
          </div>
        </div>

        <div className="host__cards">
          {LOAN_CARDS.map((card) => (
            <article
              key={card.title}
              className={`host__card host__card--${card.accent} ${card.active ? 'is-active' : ''}`}
            >
              <span className="host__card-icon">
                <img src={card.icon} alt="" aria-hidden="true" />
              </span>
              <h3>{card.title}</h3>
              <p>Fast, obligation-free assessments tailored to your situation.</p>
              <span className="host__card-arrow">
                <ArrowIcon />
              </span>
            </article>
          ))}
        </div>

        <div className="host__trustbar">
          {TRUST_POINTS.map((point) => (
            <div className="host__trust" key={point.title}>
              <span className="host__trust-icon">
                <TrustIcon name={point.icon} />
              </span>
              <div>
                <h4>{point.title}</h4>
                <p>{point.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="host__footer">
        <p>Head Office — Burleigh Heads, QLD 4220 — ABN 72 157 765 047</p>
      </footer>

      <AssistantWidget />
    </div>
  );
}

export default App;