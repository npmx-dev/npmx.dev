const VIEW_WIDTH = 900
const VIEW_HEIGHT = 360
const POINTER_REPULSION_DISTANCE = 100
const POINTER_REPULSION_FACTOR = 1.0
const VELOCITY_DAMPENING_FACTOR = 0.92
// Increase to push emojis further away from each other.
const COLLISION_MARGIN = 1
// The minimum x- or y-distance we bother to translate a sprite, scaled to
// the current view. Allows skipping sprite.style.translation = "..." assignments.
const MIN_SPRITE_MOVEMENT = 0.25

// Each glyph is built from 1-n parts.
// Each part has an associated set of 1-m possible emojis and a polyline path.
//
// The assumption is that there are no empty paths, zero length segments or
// other such shenanigans.
const GLYPH_CONFIG = [
  // dot
  {
    emojiSize: 48,
    parts: [
      {
        emojiSet: 'hearts',
        emojiCount: 1,
        path: polyline(24, 254, 25, 254),
      },
    ],
  },
  // slash
  {
    emojiSize: 36,
    parts: [
      {
        emojiSet: 'faces',
        emojiCount: 8,
        path: polyline(80, 320, 170, 18),
      },
    ],
  },
  // n
  {
    emojiSize: 20,
    parts: [
      {
        emojiSet: 'green',
        emojiCount: 19,
        path: polyline(216, 260, 216, 125, 206, 120),
      },
      {
        emojiSet: 'green',
        emojiCount: 24,
        path: polyline(233, 155, 241, 140, 269, 125, 300, 137, 322, 153, 322, 259),
      },
    ],
  },
  // p
  {
    emojiSize: 20,
    parts: [
      {
        emojiSet: 'gold',
        emojiCount: 22,
        path: polyline(384, 115, 384, 330),
      },
      {
        emojiSet: 'gold',
        emojiCount: 25,
        path: polyline(404, 135, 434, 117, 476, 133, 496, 179, 478, 220, 437, 238, 394, 232),
      },
    ],
  },
  // m
  {
    emojiSize: 20,
    parts: [
      {
        emojiSet: 'earth',
        emojiCount: 17,
        path: polyline(550, 257, 550, 125, 540, 115),
      },
      {
        emojiSet: 'earth',
        emojiCount: 18,
        path: polyline(569, 130, 592, 123, 613, 136, 628, 168, 628, 257),
      },
      {
        emojiSet: 'themed',
        emojiCount: 24,
        path: polyline(628, 155, 649, 129, 673, 123, 695, 136, 710, 168, 710, 257),
      },
    ],
  },
  // x
  {
    emojiSize: 20,
    parts: [
      {
        emojiSet: 'blue',
        emojiCount: 21,
        path: polyline(760, 118, 820, 184, 880, 118),
      },
      {
        emojiSet: 'red',
        emojiCount: 21,
        path: polyline(760, 259, 820, 194, 880, 259),
      },
    ],
  },
]

export function init(sizer, emojiSetImages) {
  const area = document.createElement('div')

  Object.assign(area.style, {
    'display': 'block',
    'position': 'absolute',
    'width': `${VIEW_WIDTH}px`,
    'height': `${VIEW_HEIGHT}px`,
    'transform-origin': '0 0',
  })
  sizer.appendChild(area)

  const resizeObserver = new ResizeObserver(() => {
    const rect = sizer.getBoundingClientRect()
    const scale = rect.width / VIEW_WIDTH
    if (scale < 1) {
      area.style.transform = `scale(${scale}, ${scale})`
    } else {
      area.style.transform = ''
    }
  })
  resizeObserver.observe(sizer)

  let pointer = undefined
  function onPointerMove(event) {
    const rect = area.getBoundingClientRect()
    pointer = {
      x: ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT,
    }
  }
  area.addEventListener('pointerenter', onPointerMove)
  area.addEventListener('pointermove', onPointerMove)
  area.addEventListener('pointerout', () => {
    pointer = undefined
  })

  const emojiSets = new Map(
    Object.entries(emojiSetImages).map(([name, image]) => {
      const width = image.width
      const count = Math.floor(image.height / width)
      const indexes = shuffle(Array.from(Array(count), (_, i) => i))

      return [
        name,
        {
          createSprite(size) {
            const index = indexes.shift()
            indexes.push(index)

            // Render emoji at double resolution.
            const realSize = Math.min(2 * size, width)

            const sprite = document.createElement('canvas')
            sprite.width = realSize
            sprite.height = realSize
            Object.assign(sprite.style, {
              position: 'absolute',
              left: `-${size / 2}px`,
              top: `-${size / 2}px`,
              width: `${size}px`,
              height: `${size}px`,
            })

            const ctx = sprite.getContext('2d')
            ctx.drawImage(image, 0, width * index, width, width, 0, 0, realSize, realSize)

            return sprite
          },
        },
      ]
    }),
  )

  const glyphs = GLYPH_CONFIG.map(config => ({
    config: config,
    parts: config.parts.map(part => {
      const emoji = []
      for (let i = 0; i < part.emojiCount; i++) {
        const x = VIEW_WIDTH / 2
        const y = VIEW_HEIGHT / 2

        const sprite = emojiSets.get(part.emojiSet).createSprite(config.emojiSize)
        sprite.style.transform = `translate3d(${x}px, ${y}px, 0)`
        area.appendChild(sprite)

        emoji.push({
          sprite,

          // Emoji's current position.
          x,
          y,

          // Emoji sprite's current translation.
          sx: x,
          sy: y,

          // Emoji's current velocity.
          // Dampened by VELOCITY_DAMPENING_FACTOR * dampFactor on each frame.
          vx: (Math.random() - 0.5) * VIEW_WIDTH * 0.5,
          vy: (Math.random() - 0.5) * VIEW_HEIGHT * 0.5,

          // The current forces affecting this emoji.
          // Zeroed at the beginning of each frame.
          fx: 0,
          fy: 0,

          // If there are no significant forces affecting this emoji,
          // then decrease this to avoid micro-jitters.
          dampFactor: 1.0,
        })
      }

      const totalLength = part.path.reduce((total, segment) => total + segment.length, 0)
      let startsAtLength = 0
      return {
        emoji,
        totalLength,
        path: part.path.map(segment => {
          const result = { ...segment, startsAtLength }
          startsAtLength += segment.length
          return result
        }),
      }
    }),
  }))

  let prevNow
  let animationFrame

  function render(now) {
    // This is coded on a 120Hz display and I'm lazy.
    const timeStep = clamp((now - (prevNow ?? now)) / 8.3333, -1, 10)
    prevNow = now

    for (const glyph of glyphs) {
      for (const part of glyph.parts) {
        for (const emoji of part.emoji) {
          emoji.fx = 0
          emoji.fy = 0
        }

        // Figure out where each emoji would be on the path if they were spread equally
        // based on their closest point on the path. Pull each emoji towards this position.
        part.emoji
          .map(emoji => ({
            t: projectPoint(part, emoji),
            emoji,
          }))
          .sort((a, b) => a.t - b.t)
          .forEach(({ t, emoji }, index) => {
            const point = pointAt(part, index / Math.max(part.emoji.length - 1, 2))
            emoji.fx += point.x - emoji.x
            emoji.fy += point.y - emoji.y

            // Also pull each emoji a bit towards the current closest point on the path. As a treat.
            const p = pointAt(part, t)
            emoji.fx += (p.x - emoji.x) * 0.5
            emoji.fy += (p.y - emoji.y) * 0.5
          })
      }

      // All emojis in a glyph repel each other if they're too close.
      const collisionSize = glyph.config.emojiSize + COLLISION_MARGIN
      const glyphEmojis = glyph.parts.flatMap(part => part.emoji)
      for (let i = 0; i < glyphEmojis.length; i++) {
        const a = glyphEmojis[i]

        for (let j = i + 1; j < glyphEmojis.length; j++) {
          const b = glyphEmojis[j]
          let dx = b.x - a.x
          let dy = b.y - a.y
          let d = Math.sqrt(dx ** 2 + dy ** 2)
          while (d < Number.EPSILON) {
            dx = Math.random() - 0.5
            dy = Math.random() - 0.5
            d = Math.sqrt(dx ** 2 + dy ** 2)
          }

          const f = 5 * Math.max(collisionSize - d, 0)
          a.fx += (-dx * f) / d
          a.fy += (-dy * f) / d
          b.fx += (dx * f) / d
          b.fy += (dy * f) / d
        }
      }

      // Push emojis away from the pointer.
      if (pointer) {
        const rect = area.getBoundingClientRect()
        const repulsionDistance = POINTER_REPULSION_DISTANCE / (rect.width / VIEW_WIDTH) ** 0.5

        for (const emoji of glyphEmojis) {
          let dx = emoji.x - pointer.x
          let dy = emoji.y - pointer.y
          let d = Math.sqrt(dx ** 2 + dy ** 2)
          while (d < Number.EPSILON) {
            dx = Math.random() - 0.5
            dy = Math.random() - 0.5
            d = Math.sqrt(dx ** 2 + dy ** 2)
          }

          const f = Math.max(repulsionDistance - d, 0) * POINTER_REPULSION_FACTOR
          emoji.fx += (dx / d) * f
          emoji.fy += (dy / d) * f
        }
      }

      for (const emoji of glyphEmojis) {
        // If there are no significant enough forces affecting the emoji,
        // then let it settle down a bit.
        if (emoji.fx ** 2 + emoji.fy ** 2 < 10) {
          emoji.dampFactor *= 0.95 ** timeStep
        } else {
          emoji.dampFactor = 1
        }

        emoji.vx += emoji.fx * 0.05 * timeStep
        emoji.vy += emoji.fy * 0.05 * timeStep
        emoji.vx *= (VELOCITY_DAMPENING_FACTOR * emoji.dampFactor) ** timeStep
        emoji.vy *= (VELOCITY_DAMPENING_FACTOR * emoji.dampFactor) ** timeStep

        emoji.x += emoji.vx * 0.1 * timeStep
        emoji.y += emoji.vy * 0.1 * timeStep
      }
    }

    const { width, height } = area.getBoundingClientRect()
    const minX = (MIN_SPRITE_MOVEMENT * VIEW_WIDTH) / width / window.devicePixelRatio
    const minY = (MIN_SPRITE_MOVEMENT * VIEW_HEIGHT) / height / window.devicePixelRatio
    for (const glyph of glyphs) {
      for (const part of glyph.parts) {
        for (const emoji of part.emoji) {
          const { x, y, sx, sy, sprite } = emoji
          if (Math.abs(sx - x) >= minX || Math.abs(sy - y) >= minY) {
            emoji.sx = x
            emoji.sy = y
            sprite.style.transform = `translate3d(${x}px, ${y}px, 0)`
          }
        }
      }
    }

    animationFrame = requestAnimationFrame(render)
  }

  return {
    start() {
      if (animationFrame === undefined) {
        prevNow = undefined
        render(document.timeline?.currentTime ?? 0)
      }
    },
    pause() {
      if (animationFrame !== undefined) {
        cancelAnimationFrame(animationFrame)
        animationFrame = undefined
      }
    },
    destroy() {
      this.pause()

      resizeObserver.disconnect()
      area.remove()
    },
  }
}

function clamp(x, min, max) {
  if (x < min) {
    return min
  } else if (x > max) {
    return max
  } else {
    return x
  }
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = array[j]
    array[j] = array[i]
    array[i] = tmp
  }
  return array
}

function polyline(x, y, ...coords) {
  let x0 = x
  let y0 = y

  const path = []
  for (let i = 0; i < coords.length; i += 2) {
    let x1 = coords[i]
    let y1 = coords[i + 1]
    const dx = x1 - x0
    const dy = y1 - y0
    path.push({ x0, y0, x1, y1, dx, dy, length: Math.sqrt(dx ** 2 + dy ** 2) })
    x0 = x1
    y0 = y1
  }
  return path
}

function pointAt(part, t) {
  const targetLength = part.totalLength * t

  let lo = 0
  let hi = part.path.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    const segment = part.path[mid]
    if (segment.startsAtLength < targetLength) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }

  const segment = part.path[Math.max(lo - 1, 0)]
  const st = (targetLength - segment.startsAtLength) / segment.length
  return {
    x: segment.x0 + segment.dx * st,
    y: segment.y0 + segment.dy * st,
  }
}

function projectPoint(part, { x, y }) {
  let smallestDistance = Infinity
  let result = 0

  for (const { x0, y0, dx, dy, length, startsAtLength } of part.path) {
    const dot = (x - x0) * dx + (y - y0) * dy
    const t = clamp(dot / length ** 2, 0, 1)
    const distance = Math.sqrt((x - (x0 + dx * t)) ** 2 + (y - (y0 + dy * t)) ** 2)
    if (distance < smallestDistance) {
      result = (t * length + startsAtLength) / part.totalLength
      smallestDistance = distance
    }
  }

  return result
}
