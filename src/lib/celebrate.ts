import confetti from "canvas-confetti"

const bursts = [
  () => confetti({ particleCount: 90, spread: 72, startVelocity: 32, origin: { y: 0.65 }, zIndex: 2000, colors: ["#da702c", "#f4a15a", "#fffcf0", "#e8883a"] }),
  () => {
    const side = { particleCount: 60, spread: 58, startVelocity: 42, zIndex: 2000, colors: ["#d97757", "#f3e7e0", "#c25f3c", "#fff"] }
    confetti({ ...side, angle: 60, origin: { x: 0, y: 0.7 } })
    confetti({ ...side, angle: 120, origin: { x: 1, y: 0.7 } })
  },
  () => confetti({ particleCount: 36, spread: 360, startVelocity: 18, gravity: 0.45, scalar: 1.15, ticks: 90, shapes: ["star"], origin: { y: 0.45 }, zIndex: 2000, colors: ["#f5a623", "#ffd27a", "#fff4df", "#e07a2f"] }),
  () => {
    const end = Date.now() + 700
    const frame = () => {
      confetti({ particleCount: 4, angle: 60, spread: 50, origin: { x: 0, y: 0.65 }, startVelocity: 48, zIndex: 2000, colors: ["#7c52e0", "#d97757", "#f8f0ec"] })
      confetti({ particleCount: 4, angle: 120, spread: 50, origin: { x: 1, y: 0.65 }, startVelocity: 48, zIndex: 2000, colors: ["#7c52e0", "#d97757", "#f8f0ec"] })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  },
  () => {
    for (let i = 0; i < 4; i += 1) {
      window.setTimeout(() => {
        confetti({
          particleCount: 26,
          startVelocity: 26,
          spread: 360,
          ticks: 80,
          gravity: 0.7,
          scalar: 0.85,
          zIndex: 2000,
          origin: { x: 0.2 + Math.random() * 0.6, y: 0.15 + Math.random() * 0.35 },
          colors: ["#ff6b3d", "#ffd166", "#fff", "#ef476f"],
        })
      }, i * 160)
    }
  },
  () => confetti({ particleCount: 80, spread: 110, gravity: 1, scalar: 0.65, drift: 0.4, shapes: ["circle"], origin: { y: 0.2 }, zIndex: 2000, colors: ["#8ecae6", "#ffb703", "#fb8500", "#fff"] }),
]

export function celebrate() {
  const burst = bursts[Math.floor(Math.random() * bursts.length)]
  burst?.()
}
