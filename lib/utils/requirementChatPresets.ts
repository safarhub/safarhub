export const REQUIREMENT_CHAT_PRESETS_CUSTOMER = {
  PRICE_HIGH: "Your offer is high for my budget. Please reduce it.",
  NEED_BETTER_PRICE: "Please share your best possible price.",
  PLEASE_CONFIRM_FINAL: "If this works for you, please confirm this final amount.",
  ACCEPT_OFFER: "I am okay with this offer. Please proceed.",
  NEED_DRIVE_LINK: "Please share files using a Google Drive link.",
  THANK_YOU: "Thank you. I will proceed once confirmed.",
} as const;

export const REQUIREMENT_CHAT_PRESETS_VENDOR = {
  BEST_PRICE: "This is my best possible price.",
  FLEXIBLE_PRICE: "I can revise the price slightly based on your final scope.",
  PLEASE_CONFIRM: "If this works for you, please confirm the amount.",
  READY_TO_PROCEED: "Once you confirm, I will start immediately.",
  DRIVE_LINK_SHARED: "I will share all files through a Google Drive link.",
  THANK_YOU: "Thank you for your response.",
} as const;

export const REQUIREMENT_CHAT_PRESET_VALUES: Set<string> = new Set(
  [
    ...Object.values(REQUIREMENT_CHAT_PRESETS_CUSTOMER),
    ...Object.values(REQUIREMENT_CHAT_PRESETS_VENDOR),
  ] as string[]
);
