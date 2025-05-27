import { DayPhase, SystemTime } from "./system-time";
/**
 * Manages sun and moon position, elevation, etc.
 * used to calculate shadows and lighting, among other things.
 */
export class SystemSunMoon {
  // Sun positioning
  public static angle = Math.PI / 4; // 45 degrees
  public static elevation: number = 0.5; // 0 to 1
  private static logging: boolean = false; // Enable logging for debugging

  /**
   * Update sun/moon position based on time of day
   */
  // Complete 180-degree cycle where:
  // - start: angle = 0 or 2π (0° or 360°) [WEST]
  // - mid: angle = π/2 (90°) [North]
  // - end: angle = π (180°) [EAST]
  public static turnUpdate() {
    if (SystemTime.isDayTime) {
      // Update sun angle based on time of day
      SystemSunMoon.updateSunPosition();
    } else {
      // Update moon position if needed (not implemented yet)
      SystemSunMoon.updateMoonPosition();
    }
  }

  /**
   * Update shadows during rendering (every frame)
   */
  public static renderUpdate(interpPercent: number, tiles: number[]) {}

  /**
   * Updates sun position based on time of day and season
   */
  private static updateSunPosition() {
    // Get time parameters
    const dayLength = SystemTime.dayLength;
    const currentTime = SystemTime.currentTime;
    const lightPhase = SystemTime.lightPhase;

    // Calculate day/night cycle progress
    const daytimeProgress = currentTime / dayLength; // 0 to 1 during day\

    // Calculate sun elevation using smoothed sine curve
    // Sun: highest at noon (daytime progress = 0.5)
    SystemSunMoon.elevation = Math.max(
      0.05,
      Math.sin(Math.PI * daytimeProgress)
    );

    // Calculate sun angle for CLOCKWISE motion
    SystemSunMoon.angle = Math.PI * daytimeProgress;

    SystemSunMoon.applySpecialModifiers(lightPhase);

    this.logPositionDetails();
  }

  /**
   * Updates moon position during nighttime
   */
  private static updateMoonPosition() {
    const nightLength = SystemTime.nightLength;
    const currentTime = SystemTime.currentTime;
    const dayLength = SystemTime.dayLength;

    // Calculate nighttime progress (0 at dusk, 1 at dawn)
    const nightProgress = (currentTime - dayLength) / nightLength;

    // Calculate moon elevation using smoothed sine curve
    // Moon: highest at midnight (night progress = 0.5)
    SystemSunMoon.elevation = Math.max(0.05, Math.sin(Math.PI * nightProgress));

    // Calculate moon angle for CLOCKWISE motion continuing from sunset
    SystemSunMoon.angle = Math.PI * nightProgress;
    this.logPositionDetails();
  }

  /**
   * Apply shadow enhancement for specific day phases
   * This function adjusts the sun's elevation based on the time of day
   * to create more dramatic and realistic shadow effects.
   */
  private static applySpecialModifiers(lightPhase: DayPhase) {
    // Special handling for evening shadows
    if (lightPhase === DayPhase.evening) {
      // Control parameters for the evening shadow transition
      const transitionSpeed = 2.0; // Higher values make the transition happen faster
      const initialShadowBoost = 0.0; // Starting boost at the beginning of evening phase

      // Calculate how far we are through the evening phase (0 to 1)
      const eveningProgress = 1 - SystemTime.remainingPhasePercent;

      // Create accelerating transition effect that starts slow and speeds up
      // This uses a power function to create a non-linear progression
      // The result ranges from initialShadowBoost (at start) to ~1.0 (at end)
      const quickTransition = Math.min(
        1.0,
        Math.pow(eveningProgress * transitionSpeed, 2) + initialShadowBoost
      );

      // Artificially lower the sun's elevation during evening to create longer shadows
      // This simulates the real-world phenomenon of longer shadows at sunset
      const minElevation = 0.05; // Prevent the sun from going completely flat
      const originalElevation = SystemSunMoon.elevation; // Store original calculated elevation

      // Reduce the sun's elevation proportionally to the evening's progression
      // The 0.8 factor controls how much to lower the sun (80% max reduction)
      SystemSunMoon.elevation = Math.max(
        minElevation,
        originalElevation * (1 - quickTransition * 0.8)
      );
    }

    // Could add similar enhancements for other phases as needed
  }

  private static logPositionDetails() {
    if (!this.logging) return; // Skip logging if disabled
    // Log celestial position details for debugging
    const currentTime = SystemTime.currentTime;
    const dayLength = SystemTime.dayLength;
    const nightLength = SystemTime.nightLength;
    const totalDayLength = dayLength + nightLength;
    const daytimeProgress = currentTime / dayLength; // 0 to 1 during day\
    const nighttimeProgress = (currentTime - dayLength) / nightLength; // 0 to 1 during night

    const progress = `progress: ${
      SystemTime.isDayTime
        ? daytimeProgress.toFixed(2)
        : nighttimeProgress.toFixed(2)
    }, `;
    console.log(
      `${SystemTime.isDayTime ? "Sun " : "moon "}` +
        `time=${currentTime}/${totalDayLength}, ` +
        progress +
        `Position: angle=${(SystemSunMoon.angle * 180) / Math.PI}°, ` +
        `elevation=${SystemSunMoon.elevation.toFixed(2)}`
    );
  }
}
