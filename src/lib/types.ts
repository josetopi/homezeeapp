export type PropertyType = "house" | "condo" | "townhouse" | "apartment" | "land" | "farm";
export type ListingStatus = "active" | "under_offer" | "sold" | "paused";
export type SwipeAction = "left" | "right" | "up";
export type VisitStatus =
  | "requested"
  | "slots_proposed"
  | "confirmed"
  | "completed"
  | "declined"
  | "cancelled";
export type OfferStatus = "pending" | "accepted" | "countered" | "rejected";
export type AgentAppStatus = "pending" | "approved" | "rejected";

export type TasteProfile = {
  cities: Record<string, number>;
  types: Record<string, number>;
  styles: Record<string, number>;
  prices: number[];
  sqfts: number[];
  bedrooms: number[];
  skippedCities: Record<string, number>;
  sampleCount: number;
};

export type Profile = {
  userId: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  role: "buyer" | "seller" | "agent";
  isAdmin: boolean;
  isPro: boolean;
  proPlan: "monthly" | "yearly" | null;
  onboarded: boolean;
  isSeed: boolean;
  swipeCountToday: number;
  swipeDate: string | null;
  filterLocation: string;
  filterMaxPrice: number | null;
  filterPropertyType: string;
  filterMinBedrooms: number;
  taste: TasteProfile;
  createdAt: string;
  isAgent: boolean;
  agentStatus: AgentAppStatus | null;
};

export type Listing = {
  id: number;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string | null;
  title: string;
  address: string;
  city: string;
  neighborhood: string;
  state: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  lotSqft: number | null;
  yearBuilt: number | null;
  propertyType: PropertyType;
  style: string;
  description: string;
  status: ListingStatus;
  promoted: boolean;
  photos: string[];
  saleHandling: "independent" | "in_app" | null;
  createdAt: string;
  origin?: "homezee" | "external";
  source?: string;
  sourceUrl?: string;
  mapQuery?: string;
  geo?: { lat: number; lon: number; approximate?: boolean };
  isDemo?: boolean;
  bedsUnknown?: boolean;
  areaUnknown?: boolean;
  tasteScore?: number;
  isGoodDeal?: boolean;
};

export type Visit = {
  id: number;
  listingId: number;
  listingTitle: string;
  listingPhoto: string | null;
  listingAddress: string;
  listingPrice: number;
  buyerId: string;
  buyerName: string;
  buyerAvatar: string | null;
  sellerId: string;
  sellerName: string;
  status: VisitStatus;
  proposedSlots: string[];
  confirmedSlot: string | null;
  createdAt: string;
};

export type Conversation = {
  id: number;
  listingId: number;
  listingTitle: string;
  listingPhoto: string | null;
  buyerId: string;
  sellerId: string;
  otherName: string;
  otherAvatar: string | null;
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
};

export type ChatMessage = {
  id: number;
  conversationId: number;
  senderId: string;
  body: string;
  createdAt: string;
};

export type Offer = {
  id: number;
  listingId: number;
  listingTitle: string;
  listingPhoto: string | null;
  listingPrice: number;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  visitId: number;
  amount: number;
  status: OfferStatus;
  counterAmount: number | null;
  createdAt: string;
};

export type TransactionRow = {
  id: number;
  listingId: number;
  listingTitle: string;
  salePrice: number;
  handleIndependently: boolean;
  platformFee: number;
  agentFee: number;
  agentName: string | null;
  status: string;
  createdAt: string;
};

export type NotificationData = {
  listingId?: number;
  visitId?: number;
  conversationId?: number;
  offerId?: number;
  buyerId?: string;
  userId?: string;
  salePrice?: number;
};

export type NotificationRow = {
  id: number;
  type: string;
  title: string;
  body: string;
  data: NotificationData;
  read: boolean;
  createdAt: string;
};

export type AgentApplication = {
  id: number;
  userId: string;
  displayName: string;
  licenseNumber: string;
  coverageArea: string;
  specialty: string;
  status: AgentAppStatus;
  createdAt: string;
};

export const EMPTY_TASTE: TasteProfile = {
  cities: {},
  types: {},
  styles: {},
  prices: [],
  sqfts: [],
  bedrooms: [],
  skippedCities: {},
  sampleCount: 0,
};

export const FREE_DAILY_SWIPES = 100;
export const PLATFORM_FEE_RATE = 0.015;
export const AGENT_FEE_RATE = 0.01;
export const TOTAL_FEE_RATE = 0.025;
