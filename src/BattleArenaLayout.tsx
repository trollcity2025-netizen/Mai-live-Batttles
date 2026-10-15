
import type { CSSProperties, ReactElement } from 'react'

interface BattleArenaLayoutProps {
  participantsPerTeam: number
  format: string
  makeTeam: (team: 'A' | 'B') => ReactElement[]
}

const styles = `
.mai-live-wars-arena {
  --cyan: #00e5ff;
  --purple: #d500ff;
  --panel: #080e1c;
  position: relative;
  isolation: isolate;
  width: 100%;
  min-height: 560px;
  overflow: hidden;
  box-sizing: border-box;
  padding: clamp(16px, 3vw, 34px);
  color: #f4f8ff;
  background:
    radial-gradient(ellipse at 50% 5%, rgba(0, 170, 255, .13), transparent 42%),
    radial-gradient(ellipse at 15% 85%, rgba(0, 229, 255, .06), transparent 36%),
    radial-gradient(ellipse at 85% 85%, rgba(213, 0, 255, .06), transparent 36%),
    #040711;
  border: 1px solid rgba(100, 160, 255, .17);
  border-radius: 18px;
  font-family: Inter, system-ui, sans-serif;
}

.mai-live-wars-arena *,
.mai-live-wars-arena *::before,
.mai-live-wars-arena *::after {
  box-sizing: border-box;
}

.mlw-arena-backdrop {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(55, 105, 160, .035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(55, 105, 160, .035) 1px, transparent 1px);
  background-size: 28px 28px;
}

.mlw-arena-vignette {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: radial-gradient(ellipse, transparent 35%, rgba(0, 0, 0, .48) 100%);
}

.mlw-arena-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
  margin-bottom: 22px;
}

.mlw-arena-eyebrow {
  margin-bottom: 6px;
  color: #8b9bb7;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .2em;
  text-transform: uppercase;
}

.mlw-arena-heading {
  margin: 0;
  font-size: clamp(21px, 3vw, 34px);
  font-weight: 950;
  letter-spacing: -.055em;
  line-height: 1.05;
}

.mlw-arena-heading span {
  color: var(--cyan);
}

.mlw-arena-brand {
  text-align: center;
}

.mlw-arena-brand strong {
  display: block;
  font-size: clamp(23px, 3.4vw, 43px);
  font-style: italic;
  font-weight: 1000;
  letter-spacing: -.06em;
  line-height: .95;
  text-shadow: 0 0 24px rgba(0, 229, 255, .22);
}

.mlw-arena-brand strong span {
  display: block;
  margin-top: 4px;
  color: var(--purple);
  text-shadow: 0 0 22px rgba(213, 0, 255, .4);
}

.mlw-arena-brand small {
  display: block;
  margin-top: 9px;
  color: #c1cce0;
  font-size: 8px;
  font-weight: 900;
  letter-spacing: .3em;
}

.mlw-arena-clock {
  justify-self: end;
  min-width: 104px;
  padding: 13px 15px;
  text-align: center;
  background: linear-gradient(145deg, #101c31, #080d19);
  border: 1px solid rgba(0, 229, 255, .23);
  border-radius: 12px;
  box-shadow: 0 0 24px rgba(0, 145, 255, .07);
}

.mlw-arena-clock small,
.mlw-arena-clock span {
  display: block;
  color: #8497b5;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: .16em;
}

.mlw-arena-clock strong {
  display: block;
  margin: 4px 0;
  color: white;
  font-size: 27px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.mlw-scoreboard {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;
  padding: 13px 18px;
  background: rgba(12, 19, 35, .9);
  border: 1px solid rgba(130, 160, 210, .13);
  border-radius: 11px;
}

.mlw-score-team {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .12em;
}

.mlw-score-team:last-child {
  justify-content: flex-end;
}

.mlw-score-team strong {
  color: var(--cyan);
  font-size: 23px;
  font-variant-numeric: tabular-nums;
}

.mlw-score-team:last-child strong {
  color: #e879ff;
}

.mlw-score-vs {
  color: #cbd6ec;
  font-size: 12px;
  font-weight: 1000;
  font-style: italic;
}

.mlw-arena-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 15px;
  padding: 11px 13px;
  color: #9caec9;
  background: rgba(8, 16, 29, .8);
  border: 1px solid rgba(110, 150, 210, .12);
  border-radius: 9px;
  font-size: 10px;
}

.mlw-status-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  background: #00e6a0;
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(0, 230, 160, .6);
}

.mlw-arena-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px minmax(0, 1fr);
  align-items: stretch;
  gap: 8px;
}

.mlw-team-stage {
  min-width: 0;
  padding: 13px;
  background: linear-gradient(180deg, rgba(8, 18, 35, .97), rgba(5, 10, 23, .97));
  border: 1px solid rgba(0, 229, 255, .48);
  border-radius: 12px;
  box-shadow: inset 0 0 30px rgba(0, 150, 255, .035), 0 0 20px rgba(0, 150, 255, .05);
}

.mlw-team-b {
  border-color: rgba(213, 0, 255, .5);
  box-shadow: inset 0 0 30px rgba(213, 0, 255, .035), 0 0 20px rgba(213, 0, 255, .05);
}

.mlw-team-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 13px;
  font-size: 11px;
  font-weight: 950;
  letter-spacing: .12em;
}

.mlw-team-title small {
  margin-left: auto;
  color: #a9bad5;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: .04em;
  white-space: nowrap;
}

.mlw-team-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  background: var(--cyan);
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(0, 229, 255, .6);
}

.mlw-team-b .mlw-team-dot {
  background: var(--purple);
  box-shadow: 0 0 10px rgba(213, 0, 255, .6);
}

.mlw-team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 130px), 1fr));
  align-content: start;
  gap: 10px;
  min-height: 250px;
}

.mlw-team-grid > * {
  min-width: 0;
}

.mlw-vs-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  position: relative;
  z-index: 1;
}

.mlw-vs-divider::before,
.mlw-vs-divider::after {
  content: "";
  position: absolute;
  left: 50%;
  width: 1px;
  height: 35%;
  background: linear-gradient(transparent, rgba(0, 229, 255, .55), transparent);
}

.mlw-vs-divider::before {
  bottom: 62%;
}

.mlw-vs-divider::after {
  top: 62%;
  background: linear-gradient(transparent, rgba(213, 0, 255, .55), transparent);
}

.mlw-vs-divider span {
  color: white;
  font-size: 19px;
  font-weight: 1000;
  font-style: italic;
  text-shadow: 0 0 15px var(--cyan), 0 0 28px var(--purple);
}

.mlw-arena-footer {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 14px;
  color: #9aabc5;
  font-size: 10px;
  line-height: 1.5;
}

@media (max-width: 650px) {
  .mai-live-wars-arena {
    min-height: 0;
    padding: 13px;
    border-radius: 12px;
  }

  .mlw-arena-header {
    grid-template-columns: 1fr auto;
    gap: 12px;
    margin-bottom: 15px;
  }

  .mlw-arena-brand {
    grid-column: 1 / -1;
    grid-row: 2;
    padding: 8px 0;
  }

  .mlw-arena-clock {
    grid-column: 2;
    grid-row: 1;
    min-width: 88px;
    padding: 10px;
  }

  .mlw-arena-clock strong {
    font-size: 23px;
  }

  .mlw-scoreboard {
    gap: 8px;
    padding: 11px;
  }

  .mlw-score-team {
    gap: 6px;
    font-size: 8px;
    letter-spacing: .05em;
  }

  .mlw-score-team strong {
    font-size: 19px;
  }

  .mlw-arena-content {
    grid-template-columns: minmax(0, 1fr) 25px minmax(0, 1fr);
    gap: 5px;
  }

  .mlw-team-stage {
    padding: 8px;
    border-radius: 9px;
  }

  .mlw-team-title {
    flex-wrap: wrap;
    gap: 5px;
    font-size: 9px;
    letter-spacing: .04em;
  }

  .mlw-team-title small {
    width: 100%;
    margin-left: 13px;
    font-size: 7px;
  }

  .mlw-team-grid {
    grid-template-columns: minmax(0, 1fr);
    min-height: 180px;
    gap: 7px;
  }

  .mlw-vs-divider span {
    font-size: 14px;
  }

  .mlw-arena-footer {
    font-size: 9px;
  }
}
`

export function BattleArenaLayout({
  participantsPerTeam,
  format,
  makeTeam,
}: BattleArenaLayoutProps) {
  const fighterLabel = `${participantsPerTeam} ${
    participantsPerTeam === 1 ? 'FIGHTER' : 'FIGHTERS'
  }`

  const safeFormat = format.toLowerCase().replace(/[^a-z0-9-]/g, '')
  const arenaStyle: CSSProperties = { width: '100%' }

  return (
    <>
      <style>{styles}</style>

      <main
        className={`mai-live-wars-arena format-${safeFormat}`}
        style={arenaStyle}
        aria-label="MAI Live Wars battle arena"
      >
        <div className="mlw-arena-backdrop" aria-hidden="true" />
        <div className="mlw-arena-vignette" aria-hidden="true" />

        <header className="mlw-arena-header">
          <div>
            <div className="mlw-arena-eyebrow">LIVE BATTLE</div>
            <h1 className="mlw-arena-heading">
              THE <span>ARENA.</span>
            </h1>
          </div>

          <div className="mlw-arena-brand">
            <strong>
              MAI
              <span>LIVE WARS</span>
            </strong>
            <small>CREATOR VS CREATOR</small>
          </div>

          <div className="mlw-arena-clock">
            <small>TIME REMAINING</small>
            <strong>03:00</strong>
            <span>STANDARD CLOCK</span>
          </div>
        </header>

        <section className="mlw-scoreboard" aria-label="Battle score">
          <div className="mlw-score-team">
            TEAM A <strong>00</strong>
          </div>
          <div className="mlw-score-vs">VS</div>
          <div className="mlw-score-team">
            TEAM B <strong>00</strong>
          </div>
        </section>

        <div className="mlw-arena-status">
          <span className="mlw-status-dot" />
          <span>Battle arena ready</span>
          <span>•</span>
          <span>{fighterLabel} PER TEAM</span>
        </div>

        <div className="mlw-arena-content">
          <section
            className="mlw-team-stage mlw-team-a"
            aria-label="Team A"
          >
            <div className="mlw-team-title">
              <span className="mlw-team-dot" />
              TEAM A
              <small>{fighterLabel}</small>
            </div>

            <div className="mlw-team-grid">{makeTeam('A')}</div>
          </section>

          <div className="mlw-vs-divider" aria-label="versus">
            <span>VS</span>
          </div>

          <section
            className="mlw-team-stage mlw-team-b"
            aria-label="Team B"
          >
            <div className="mlw-team-title">
              <span className="mlw-team-dot" />
              TEAM B
              <small>{fighterLabel}</small>
            </div>

            <div className="mlw-team-grid">{makeTeam('B')}</div>
          </section>
        </div>

        <footer className="mlw-arena-footer">
          <span className="mlw-status-dot" />
          <span>
            Your battle arena is ready. Participant video, team assignment,
            and battle state remain controlled by the existing battle system.
          </span>
        </footer>
      </main>
    </>
  )
}
