export type ServicePlatform =
  | "Instagram"
  | "YouTube"
  | "TikTok"
  | "Twitter / X"
  | "LinkedIn"
  | "Spotify"
  | "Telegram"
  | "Other";

export type OrderStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "PENDING"
  | "PROCESSING"
  | "PAUSED"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED"
  | "CANCELLED"
  | "REQUIRES_RECONCILIATION";

export type StepStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUBMITTED"
  | "PARTIAL"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type OrganicPresetId =
  | "SLOW_BURN"
  | "TEST_BATCH_BREAKOUT"
  | "EVENING_SURGE"
  | "VIRAL_SPIKE"
  | "FRONT_LOADED_DECAY"
  | "DOUBLE_WAVE"
  | "HEARTBEAT"
  | "LATE_ROCKET"
  | "SLEEPER_HIT"
  | "LONG_TAIL";

export type SpikeIntensity = "off" | "low" | "medium" | "high";

export type ScheduleMode =
  | "INSTANT"
  | "EVEN_DRIP"
  | "FRONT_LOADED"
  | "GRADUAL_RAMP"
  | "CUSTOM"
  | OrganicPresetId;

export interface ProviderService {
  id: string; // matches "service" in API
  name: string;
  type?: string; // "Default", "Custom Comments", etc.
  platform: ServicePlatform;
  category: string;
  description: string;
  minQuantity: number;
  maxQuantity: number;
  ratePer1000: number; // in USD, parsed from "rate"
  refillSupported: boolean; // parsed from "refill"
  cancelSupported: boolean; // parsed from "cancel"
  dripFeedSupported: boolean;
  dripFeedMinInterval: number; // minutes
  dripFeedMaxInterval: number; // minutes
  restrictions?: string;
  isMock: boolean;
}

export interface CreateOrderParams {
  serviceExternalId: string;
  targetUrl: string;
  quantity: number;
  runs?: number;
  interval?: number; // minutes
}

export interface CreateOrderResult {
  success: boolean;
  providerOrderId?: string;
  error?: string;
  rawResponse?: Record<string, unknown>;
}

export interface OrderStatusResult {
  success: boolean;
  providerOrderId: string;
  status: OrderStatus;
  charge?: number;
  startCount?: number;
  deliveredQuantity?: number;
  remains?: number;
  currency?: string;
  error?: string;
}

export interface RefillResult {
  success: boolean;
  refillId?: string;
  error?: string;
}

export interface RefillStatusResult {
  success: boolean;
  status: "Pending" | "In progress" | "Completed" | "Rejected" | "Error";
  error?: string;
}

export interface CancelOrderResult {
  success: boolean;
  message?: string;
  error?: string;
}

export type SchedulingTimingMode = "MODE_A" | "MODE_B" | "CUSTOM";

export interface ScheduleStepPreview {
  stepNumber: number;
  scheduledTime: string; // ISO UTC
  scheduledTimeFormatted: string;
  intervalMinutesFromPrev: number; // minutes elapsed from previous batch (or 0 for step 1)
  elapsedMinutes: number; // minutes elapsed since timeline start
  quantity: number;
  cumulativeQuantity: number;
  percentOfTotal: number;
  stepCost: number;
  status: "Preview" | "Scheduled" | "Pending" | "Paused";
}

export interface ScheduleCalculationResult {
  valid: boolean;
  errorMessage?: string;
  serviceId: string;
  serviceName: string;
  targetUrl: string;
  totalQuantity: number;
  unitCost: number;
  totalCost: number;
  scheduleMode: ScheduleMode;
  timingMode: SchedulingTimingMode;
  stepCount: number;
  defaultIntervalMinutes: number;
  totalDurationMinutes: number;
  unallocatedQuantity: number;
  startTime: string;
  estimatedCompletionTime: string;
  steps: ScheduleStepPreview[];
  minQuantityPerStep: number;
  maxQuantityPerStep: number;
  assumptions: string[];
}

export interface BatchUpdateItem {
  stepNumber: number;
  quantity: number;
  intervalMinutesFromPrev?: number;
  scheduledTime?: string;
}
