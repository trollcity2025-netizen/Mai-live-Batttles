let audioContext: AudioContext | null = null

export function playUiSound(kind: 'tap' | 'success' | 'battle' | 'warning' = 'tap') {
  try {
    const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextConstructor) return
    audioContext ??= new AudioContextConstructor()
    if (audioContext.state === 'suspended') void audioContext.resume()
    const context = audioContext
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const settings = {
      tap: { frequency: 540, duration: 0.055, type: 'sine' as OscillatorType },
      success: { frequency: 820, duration: 0.12, type: 'triangle' as OscillatorType },
      battle: { frequency: 240, duration: 0.16, type: 'sawtooth' as OscillatorType },
      warning: { frequency: 390, duration: 0.12, type: 'square' as OscillatorType },
    }[kind]
    oscillator.type = settings.type
    oscillator.frequency.setValueAtTime(settings.frequency, context.currentTime)
    if (kind === 'success') oscillator.frequency.exponentialRampToValueAtTime(1120, context.currentTime + settings.duration)
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + settings.duration)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + settings.duration + 0.01)
  } catch {
    // Audio is an enhancement; blocked or unavailable audio must never interrupt an action.
  }
}
