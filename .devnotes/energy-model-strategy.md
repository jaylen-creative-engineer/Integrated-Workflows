
### 1. Inputs

From WHOOP:

* `sleep.start` (ISO datetime)
* `sleep.end` (ISO datetime)
* `sleep.timezone_offset` (e.g. `"-05:00"`)
* `sleep.score.stage_[summary.total](http://summary.total)_in_bed_time_milli`
* `sleep.score.stage_[summary.total](http://summary.total)_awake_time_milli`
* `sleep.score.sleep_needed.baseline_milli`
* `sleep.score.sleep_needed.need_from_sleep_debt_milli`
* `sleep.score.sleep_performance_percentage` (0–100)
* `sleep.score.sleep_efficiency_percentage` (0–100)
* `sleep.score.sleep_consistency_percentage` (0–100)

From Recovery:

* `recovery.score.recovery_score` (0–100)
* `recovery.score.hrv_rmssd_milli` (optional)
* `recovery.score.resting_heart_rate` (optional)

Config / user prefs:

* `chronotypeOffsetHours`
  * e.g. `-0.5` early type, `0` neutral, `+0.5` late type
* `dayDate`
  * So you can clamp everything to “today” in local time.


---

### 2. Derived base metrics

Compute:

```tsx
wakeTime = sleep.end (with timezone_offset applied)
sleepDurationHours = (sleep.end - sleep.start) / 3_600_000

// Rough debt and quality
sleepDebtHours = sleep.score.sleep_needed.need_from_sleep_debt_milli / 3_600_000
sleepPerf = sleep.score.sleep_performance_percentage      // 0–100
sleepEfficiency = sleep.score.sleep_efficiency_percentage // 0–100
recoveryScore = recovery.score.recovery_score            // 0–100
```

You can turn these into normalized “factors”:

```tsx
// Clamp helper
const clamp = (x, min, max) => Math.max(min, Math.min(max, x))

// 0 (terrible) → 1 (great)
qualityFactor = clamp(
  0.5 * (sleepPerf / 100) +
  0.5 * (recoveryScore / 100),
  0, 1
)

// 0 (no debt) → 1 (very high debt, say 3+ h)
debtFactor = clamp(sleepDebtHours / 3, 0, 1)
```

These two scalars drive the peak/dip shaping.


---

### 3. Base circadian schedule (before modulation)

Define “ideal” offsets *relative to internal wake*:

```tsx
const WAKE_TO_GROGGY_END   = 1.5  // h
const WAKE_TO_MORNING_PEAK_END = 5.0
const WAKE_TO_AFTERNOON_DIP_END = 8.0
const WAKE_TO_EVENING_PEAK_END = 11.0
const WAKE_TO_WIND_DOWN_END    = 13.0
```

Apply chronotype shift:

```tsx
internalWake = wakeTime + chronotypeOffsetHours
```

Base windows:

```tsx
groggy = {
  label: "Groggy",
  type: "groggy",
  start: internalWake,
  end: internalWake + 1.5h
}

morningPeak = {
  label: "Morning Peak",
  type: "peak",
  start: groggy.end,
  end: internalWake + 5h
}

afternoonDip = {
  label: "Afternoon Dip",
  type: "dip",
  start: morningPeak.end,
  end: internalWake + 8h
}

eveningPeak = {
  label: "Evening Peak",
  type: "peak",
  start: afternoonDip.end,
  end: internalWake + 11h
}

windDown = {
  label: "Wind‑Down",
  type: "wind_down",
  start: eveningPeak.end,
  end: internalWake + 13h
}

// Melatonin window roughly overlaps late wind-down
melatoninWindow = {
  label: "Melatonin Window",
  type: "melatonin",
  start: windDown.start - 1.5h,
  end: windDown.end
}
```

This gives you a simple sequence: **groggy → peak → dip → peak → wind‑down / melatonin**.


---

### 4. Modulation rules (sleep & recovery–aware)

Now apply the rules you called out.

### 4.1 Delay or shrink peaks on low sleep performance / red recovery

Define a “penalty” from quality:

```tsx
// 0 (great) → 1 (bad)
fatigueFactor = 1 - qualityFactor
```

Use it to:

* **Delay peaks** (everything shifts later)
* **Shrink peak duration** (less usable high‑energy time)

Example:

```tsx
// At fatigueFactor=0.5, delay peaks by ~30 minutes
peakDelayHours = 0.5 * fatigueFactor  // max 0.5 h

// Shorten peak windows by up to 30%
peakShrinkRatio = 1 - 0.3 * fatigueFactor  // between 0.7 and 1
```

Apply to morning and evening peaks:

```tsx
function adjustPeak(window) {
  const duration = window.end - window.start
  const newDuration = duration * peakShrinkRatio

  const shiftedStart = window.start + peakDelayHours
  return {
    ...window,
    start: shiftedStart,
    end: shiftedStart + newDuration
  }
}

morningPeak = adjustPeak(morningPeak)
eveningPeak = adjustPeak(eveningPeak)
```

This keeps the *shape* but reflects “less engine, a bit later.”

### 4.2 Extend groggy / dip windows when sleep debt is high

Use `debtFactor` to lengthen low‑energy windows:

```tsx
// Up to +50% duration extension for high debt
lowEnergyExtendRatio = 1 + 0.5 * debtFactor
```

For groggy and afternoon dip:

```tsx
function extendLowEnergy(window) {
  const duration = window.end - window.start
  const newDuration = duration * lowEnergyExtendRatio
  return {
    ...window,
    end: window.start + newDuration
  }
}

groggy = extendLowEnergy(groggy)
afternoonDip = extendLowEnergy(afternoonDip)
```

After you modify these, you may want a simple **re‑seating pass** to ensure windows stay contiguous and ordered (start of next == end of previous). That can be a small helper that walks the array and snaps `start` to prior `end` if needed.

### 4.3 Energy scores per window

Assign an “energy potential” so your brief can rank tasks:

```tsx
// Baseline scores
let energyScores = {
  groggy: 0.3,
  morningPeak: 0.9,
  afternoonDip: 0.4,
  eveningPeak: 0.8,
  windDown: 0.3,
  melatonin: 0.2
}

// Downscale by fatigue, further downscale low-energy when debt is high
const scale = (base, isLowEnergy) => {
  let x = base * qualityFactor
  if (isLowEnergy) {
    x *= (1 - 0.3 * debtFactor) // debt makes lows even “lower”
  }
  return clamp(x, 0, 1)
}

[groggy.energy](http://groggy.energy)       = scale(energyScores.groggy, true)
[morningPeak.energy](http://morningPeak.energy)  = scale(energyScores.morningPeak, false)
[afternoonDip.energy](http://afternoonDip.energy) = scale(energyScores.afternoonDip, true)
[eveningPeak.energy](http://eveningPeak.energy)  = scale(energyScores.eveningPeak, false)
[windDown.energy](http://windDown.energy)     = scale(energyScores.windDown, true)
[melatoninWindow.energy](http://melatoninWindow.energy) = scale(energyScores.melatonin, true)
```

Now each segment has:

* `start`, `end`, `type`, `label`, `energy (0–1)`.

Your brief logic can say:

* Deep work → segments with `type === "peak"` and `energy >= 0.7`.
* Admin / light comms → `type === "dip"` or low energy.
* Wind‑down rituals → `type === "wind_down" | "melatonin"`.


---

### 5. “Push vs conservation day” blurb

You can drive this off the same `qualityFactor` and `debtFactor`.

Example scoring:

```tsx
// 0–100-like score
overallCapacity = clamp(
  100 * (
    0.5 * qualityFactor +
    0.3 * (1 - debtFactor) +
    0.2 * (sleepConsistency / 100)
  ),
  0, 100
)
```

Then map to categories:

```tsx
let dayMode
if (overallCapacity >= 75)      dayMode = "push"
else if (overallCapacity >= 55) dayMode = "balanced"
else                            dayMode = "conserve"
```

Blurb examples you can generate right at the top of the brief:

* **Push day**
  * “Today looks like a **push day**. Morning and evening peaks are strong; aim to move 1–2 hard things in those windows.”
* **Balanced day**
  * “Today is a **balanced day**. Use your peaks for one focused block each, and keep dips for admin or lighter creative work.”
* **Conservation day**
  * “Today is a **conservation day**. Peaks are shorter and grogginess/dips are extended. Protect the small high‑energy windows, and lower the bar elsewhere.”

The brief can also show the underlying numbers (`sleepPerf`, `recoveryScore`, `sleepDebtHours`) so it feels transparent, not mystical.


---

### 6. Output shape

All of this can roll up into a clean return value:

```tsx
type EnergySegmentType =
  | "groggy"
  | "peak"
  | "dip"
  | "wind_down"
  | "melatonin"

type EnergySegment = {
  label: string
  type: EnergySegmentType
  start: string // ISO
  end: string   // ISO
  energy: number // 0–1
}

type DayMode = "push" | "balanced" | "conserve"

type EnergyModelOutput = {
  wakeTime: string
  sleepDurationHours: number
  sleepDebtHours: number
  sleepPerf: number
  recoveryScore: number
  dayMode: DayMode
  overallCapacity: number // 0–100
  segments: EnergySegment[]
}
```


