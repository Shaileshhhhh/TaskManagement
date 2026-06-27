/**
 * App-wide constants. Keep magic numbers and shared literals here.
 */

/** Standard working hours in a day. Anything beyond this counts as "extra". */
export const STANDARD_DAILY_HOURS = 8;

/** Seconds in one standard working day — used in hours/extra math. */
export const STANDARD_DAILY_SECONDS = STANDARD_DAILY_HOURS * 3600;

/** IANA timezone all attendance/calendar math is displayed in. */
export const APP_TIMEZONE = "Asia/Kolkata";
