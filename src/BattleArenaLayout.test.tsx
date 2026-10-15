import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BattleArenaLayout } from './BattleArenaLayout'

const makeTeam = (team: 'A' | 'B') => Array.from({ length: 3 }, (_, i) => (
  <div key={`${team}-${i}`} data-testid={`fighter-${team}-${i}`}>
    Fighter {team}{i + 1}
  </div>
))

describe('BattleArenaLayout', () => {
  it('renders the arena with team A and team B sections', () => {
    const { container } = render(
      <BattleArenaLayout participantsPerTeam={3} format="3v3" makeTeam={makeTeam} />,
    )
    expect(container.querySelector('.mai-live-wars-arena')).toBeTruthy()
    expect(screen.getAllByText('TEAM A').length).toBeGreaterThan(0)
    expect(screen.getAllByText('TEAM B').length).toBeGreaterThan(0)
  })

  it('displays the correct fighter count label for each team', () => {
    render(
      <BattleArenaLayout participantsPerTeam={1} format="1v1" makeTeam={makeTeam} />,
    )
    const labels = screen.getAllByText('1 FIGHTER')
    expect(labels).toHaveLength(2)
  })

  it('displays plural fighter label when participantsPerTeam > 1', () => {
    render(
      <BattleArenaLayout participantsPerTeam={6} format="6v6" makeTeam={makeTeam} />,
    )
    const labels = screen.getAllByText('6 FIGHTERS')
    expect(labels).toHaveLength(2)
  })

  it('renders the correct number of fighter elements per team', () => {
    render(
      <BattleArenaLayout participantsPerTeam={2} format="2v2" makeTeam={makeTeam} />,
    )
    expect(screen.getAllByTestId('fighter-A-0')).toHaveLength(1)
    expect(screen.getAllByTestId('fighter-A-1')).toHaveLength(1)
    expect(screen.getAllByTestId('fighter-B-0')).toHaveLength(1)
    expect(screen.getAllByTestId('fighter-B-1')).toHaveLength(1)
  })

  it('displays the MAI LIVE WARS brand', () => {
    render(
      <BattleArenaLayout participantsPerTeam={1} format="1v1" makeTeam={makeTeam} />,
    )
    expect(screen.getByText('MAI')).toBeTruthy()
    expect(screen.getByText('LIVE WARS')).toBeTruthy()
  })

  it('displays the arena clock with 03:00', () => {
    render(
      <BattleArenaLayout participantsPerTeam={1} format="1v1" makeTeam={makeTeam} />,
    )
    expect(screen.getByText('03:00')).toBeTruthy()
  })

  it('displays the scoreboard with VS divider', () => {
    render(
      <BattleArenaLayout participantsPerTeam={1} format="1v1" makeTeam={makeTeam} />,
    )
    const vsElements = screen.getAllByText('VS')
    expect(vsElements.length).toBeGreaterThanOrEqual(1)
  })

  it('applies a safe format class to the arena', () => {
    const { container } = render(
      <BattleArenaLayout participantsPerTeam={1} format="1v1" makeTeam={makeTeam} />,
    )
    expect(container.querySelector('.format-1v1')).toBeTruthy()
  })

  it('sanitizes special characters in the format class', () => {
    const { container } = render(
      <BattleArenaLayout participantsPerTeam={1} format="Bad@Format!" makeTeam={makeTeam} />,
    )
    expect(container.querySelector('.format-badformat')).toBeTruthy()
  })
})