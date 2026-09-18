const features = [
  {
    icon: "⚡",
    title: "Smart study plans",
    text: "Build personalized learning sequences that fit your schedule, goals, and current progress every day.",
  },
  {
    icon: "🧠",
    title: "AI tutoring",
    text: "Ask questions, get explanations, and receive follow-up practice that adapts to how you learn best.",
  },
  {
    icon: "📈",
    title: "Progress tracking",
    text: "Monitor mastery, streaks, achievements, and momentum with simple visual insights you can act on.",
  },
  {
    icon: "✅",
    title: "Confidence checks",
    text: "Turn revision into quick wins with quizzes, summaries, and review loops that reinforce memory.",
  },
];

const stats = [
  { value: "92%", label: "Learners report higher retention" },
  { value: "6x", label: "More consistent revision habits" },
  { value: "24/7", label: "Support for your study routine" },
];

const flow = [
  {
    step: "01",
    title: "Set your goal",
    text: "Choose a subject, timeline, or exam target and let EduMate shape a study roadmap around it.",
  },
  {
    step: "02",
    title: "Learn with guidance",
    text: "Follow adaptive lessons, receive answers in plain language, and work through practice tasks.",
  },
  {
    step: "03",
    title: "Review and improve",
    text: "Track your score, revisit weak topics, and keep building habits that stick over time.",
  },
];

export function LandingPage() {
  return (
    <div className="page-shell">
      <div
        className="background-glow background-glow--purple"
        aria-hidden="true"
      />
      <div
        className="background-glow background-glow--green"
        aria-hidden="true"
      />

      <header className="topbar">
        <div className="topbar__inner">
          <div className="brand" aria-label="EduMate AI home">
            <span className="brand-mark">E</span>
            <span>EduMate AI</span>
          </div>

          <nav className="nav" aria-label="Main navigation">
            <a href="#features" className="nav__link">
              Features
            </a>
            <a href="#how-it-works" className="nav__link">
              How it works
            </a>
            <a href="#impact" className="nav__link">
              Impact
            </a>
            <a href="#pricing" className="nav__link">
              Pricing
            </a>
          </nav>

          <div className="header-actions">
            <button type="button" className="secondary-button">
              Log in
            </button>
            <button type="button" className="primary-button">
              Get started
            </button>
          </div>
        </div>
      </header>

      <main className="page-main">
        <section className="hero">
          <div className="hero__grid">
            <div>
              <div className="badge" aria-label="Live learning support badge">
                <span className="badge__dot" />
                Study smarter, not harder
              </div>

              <h1 className="hero__title">
                Learn faster with your
                <span className="hero__highlight"> AI study partner.</span>
              </h1>

              <p className="hero__description">
                Personalized lessons, instant feedback, revision planning, and
                daily motivation in one responsive learning dashboard built to
                keep your momentum high.
              </p>

              <div className="hero__actions">
                <button type="button" className="primary-button">
                  Start learning
                </button>
                <button type="button" className="secondary-button">
                  Watch demo
                </button>
              </div>

              <div className="hero__meta">
                <div className="metric-pill">
                  <span className="metric-pill__value">3.8k+</span>
                  <span className="metric-pill__label">Active learners</span>
                </div>
                <div className="metric-pill">
                  <span className="metric-pill__value">4.9/5</span>
                  <span className="metric-pill__label">Student rating</span>
                </div>
              </div>
            </div>

            <div
              className="dashboard-card"
              aria-label="Learning dashboard preview"
            >
              <div className="dashboard-card__top">
                <span className="dashboard-card__title">
                  Learning dashboard
                </span>
                <span className="status-pill">
                  <span className="status-pill__dot" />
                  On track
                </span>
              </div>

              <div className="kpi-grid">
                <div className="kpi-card">
                  <span className="kpi-card__label">Streak</span>
                  <span className="kpi-card__value">18d</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-card__label">XP</span>
                  <span className="kpi-card__value">2.4k</span>
                </div>
              </div>

              <div className="progress-panel">
                <div className="progress-panel__header">
                  <span>Weekly progress</span>
                  <strong>78%</strong>
                </div>
                <div className="progress-bar" aria-label="Weekly progress bar">
                  <span />
                </div>
              </div>

              <div className="trend-list">
                <div className="trend-item">
                  <span className="trend-item__name">Math mastery</span>
                  <span className="trend-item__right">
                    <span className="trend-item__tag" />
                    +14%
                  </span>
                </div>
                <div className="trend-item">
                  <span className="trend-item__name">Science flashcards</span>
                  <span className="trend-item__right">
                    <span className="trend-item__tag" />
                    +9%
                  </span>
                </div>
                <div className="trend-item">
                  <span className="trend-item__name">Essay practice</span>
                  <span className="trend-item__right">
                    <span className="trend-item__tag" />
                    +11%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="features">
          <div className="section__header">
            <span className="section__eyebrow">Features</span>
            <h2 className="section__title">
              Everything your learning routine needs.
            </h2>
            <p className="section__text">
              Designed to help students stay focused, organized, and
              confident—from planning a revision schedule to checking
              understanding in real time.
            </p>
          </div>

          <div className="features-grid">
            {features.map((feature) => (
              <article key={feature.title} className="feature-card">
                <div className="feature-card__icon" aria-hidden="true">
                  {feature.icon}
                </div>
                <h3 className="feature-card__title">{feature.title}</h3>
                <p className="feature-card__text">{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="impact">
          <div className="stats-strip">
            {stats.map((stat) => (
              <div key={stat.label} className="stat-card">
                <div className="stat-card__value">{stat.value}</div>
                <div className="stat-card__label">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="section" id="how-it-works">
          <div className="section__header">
            <span className="section__eyebrow">How it works</span>
            <h2 className="section__title">
              A simple path to better study habits.
            </h2>
          </div>

          <div className="learning-flow">
            {flow.map((item) => (
              <article key={item.step} className="flow-card">
                <span className="flow-card__step">{item.step}</span>
                <h3 className="flow-card__title">{item.title}</h3>
                <p className="flow-card__text">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="pricing">
          <div className="cta-banner">
            <div>
              <h2 className="cta-banner__title">
                Turn every study session into meaningful progress.
              </h2>
              <p className="cta-banner__text">
                Join learners who use AI-guided routines to stay on track,
                retain more information, and feel more confident before tests,
                deadlines, and school goals.
              </p>
            </div>

            <button type="button" className="ghost-button">
              Start free
            </button>
          </div>
        </section>
      </main>

      <footer className="footer">
        © 2026 EduMate AI. Built for focused learning everywhere.
      </footer>
    </div>
  );
}
