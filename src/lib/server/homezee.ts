import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { asIso, asStringArray, num } from "@/lib/utils";
import {
  AGENT_FEE_RATE,
  EMPTY_TASTE,
  FREE_DAILY_SWIPES,
  PLATFORM_FEE_RATE,
  type AgentApplication,
  type ChatMessage,
  type Conversation,
  type Listing,
  type NotificationData,
  type NotificationRow,
  type Offer,
  type Profile,
  type PropertyType,
  type TasteProfile,
  type TransactionRow,
  type Visit,
} from "@/lib/types";
import {
  buildMarketSnapshots,
  SEED_AGENTS,
  SEED_LISTINGS,
  SEED_SELLERS,
} from "./seed-data";

function parseTaste(v: unknown): TasteProfile {
  let raw: unknown = v;
  if (typeof v === "string") {
    try {
      raw = JSON.parse(v);
    } catch {
      return { ...EMPTY_TASTE, cities: {}, types: {}, styles: {}, prices: [], sqfts: [], bedrooms: [], skippedCities: {} };
    }
  }
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_TASTE, cities: {}, types: {}, styles: {}, prices: [], sqfts: [], bedrooms: [], skippedCities: {} };
  }
  const o = raw as Partial<TasteProfile>;
  return {
    cities: o.cities ?? {},
    types: o.types ?? {},
    styles: o.styles ?? {},
    prices: Array.isArray(o.prices) ? o.prices.map(Number).filter(Number.isFinite) : [],
    sqfts: Array.isArray(o.sqfts) ? o.sqfts.map(Number).filter(Number.isFinite) : [],
    bedrooms: Array.isArray(o.bedrooms) ? o.bedrooms.map(Number).filter(Number.isFinite) : [],
    skippedCities: o.skippedCities ?? {},
    sampleCount: num(o.sampleCount),
  };
}

function avg(xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function bump(map: Record<string, number>, key: string, n = 1) {
  map[key] = (map[key] ?? 0) + n;
}

function applyTaste(taste: TasteProfile, listing: Listing, action: "left" | "right" | "up"): TasteProfile {
  const next: TasteProfile = {
    cities: { ...taste.cities },
    types: { ...taste.types },
    styles: { ...taste.styles },
    prices: [...taste.prices],
    sqfts: [...taste.sqfts],
    bedrooms: [...taste.bedrooms],
    skippedCities: { ...taste.skippedCities },
    sampleCount: taste.sampleCount + 1,
  };
  if (action === "left") {
    bump(next.skippedCities, listing.city);
    return next;
  }
  const weight = action === "up" ? 2 : 1;
  bump(next.cities, listing.city, weight);
  bump(next.types, listing.propertyType, weight);
  bump(next.styles, listing.style, weight);
  next.prices.push(listing.price);
  next.sqfts.push(listing.sqft);
  next.bedrooms.push(listing.bedrooms);
  if (next.prices.length > 24) next.prices = next.prices.slice(-24);
  if (next.sqfts.length > 24) next.sqfts = next.sqfts.slice(-24);
  if (next.bedrooms.length > 24) next.bedrooms = next.bedrooms.slice(-24);
  return next;
}

function maxVal(map: Record<string, number>) {
  const vals = Object.values(map);
  return vals.length ? Math.max(...vals) : 1;
}

export function scoreListing(listing: Listing, taste: TasteProfile, cityAvg: number | null): number {
  let score = listing.promoted ? 42 : 0;
  if (taste.sampleCount === 0) return score;
  const cMax = maxVal(taste.cities);
  const tMax = maxVal(taste.types);
  const sMax = maxVal(taste.styles);
  if (taste.cities[listing.city]) score += 32 * (taste.cities[listing.city]! / cMax);
  if (taste.types[listing.propertyType]) score += 22 * (taste.types[listing.propertyType]! / tMax);
  if (taste.styles[listing.style]) score += 12 * (taste.styles[listing.style]! / sMax);
  const p = avg(taste.prices);
  if (p) score += 24 * Math.max(0, 1 - Math.abs(listing.price - p) / p);
  const sq = avg(taste.sqfts);
  if (sq) score += 8 * Math.max(0, 1 - Math.abs(listing.sqft - sq) / sq);
  const bd = avg(taste.bedrooms);
  if (bd) score += 8 * Math.max(0, 1 - Math.abs(listing.bedrooms - bd) / 4);
  if (taste.skippedCities[listing.city] && !taste.cities[listing.city]) score -= 12;
  if (cityAvg && listing.price < cityAvg * 0.88) score += 14;
  return score;
}

function mapListing(row: Record<string, unknown>, extra: Partial<Listing> = {}): Listing {
  return {
    id: num(row.id),
    sellerId: String(row.seller_id ?? ""),
    sellerName: String(row.seller_name ?? extra.sellerName ?? "Seller"),
    sellerAvatar: row.seller_avatar ? String(row.seller_avatar) : extra.sellerAvatar ?? null,
    title: String(row.title ?? ""),
    address: String(row.address ?? ""),
    city: String(row.city ?? ""),
    neighborhood: String(row.neighborhood ?? ""),
    state: String(row.state ?? ""),
    price: num(row.price),
    bedrooms: num(row.bedrooms),
    bathrooms: num(row.bathrooms),
    sqft: num(row.sqft),
    lotSqft: row.lot_sqft == null ? null : num(row.lot_sqft),
    yearBuilt: row.year_built == null ? null : num(row.year_built),
    propertyType: String(row.property_type ?? "house") as PropertyType,
    style: String(row.style ?? "modern"),
    description: String(row.description ?? ""),
    status: String(row.status ?? "active") as Listing["status"],
    promoted: Boolean(row.promoted),
    photos: asStringArray(row.photos),
    saleHandling: (row.sale_handling as Listing["saleHandling"]) ?? null,
    createdAt: asIso(row.created_at),
    origin: row.origin === "external" ? "external" : "homezee",
    source: String(row.source ?? "Homezee"),
    sourceUrl: row.source_url ? String(row.source_url) : undefined,
    mapQuery: String(row.map_query || `${row.address ?? ""}, ${row.city ?? ""}, Portugal`),
    geo: row.geo as Listing["geo"],
    isDemo: Boolean(row.is_demo),
    bedsUnknown: Boolean(row.bedrooms_unknown) || row.bedrooms == null,
    areaUnknown: Boolean(row.area_unknown) || !num(row.sqft),
    ...extra,
  };
}

function mapProfile(
  row: Record<string, unknown>,
  agentStatus: Profile["agentStatus"],
): Profile {
  const swipeDate = row.swipe_date ? String(row.swipe_date).slice(0, 10) : null;
  return {
    userId: String(row.user_id),
    displayName: String(row.display_name ?? ""),
    bio: String(row.bio ?? ""),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    role: (row.role as Profile["role"]) ?? "buyer",
    isAdmin: Boolean(row.is_admin),
    isPro: Boolean(row.is_pro),
    proPlan: (row.pro_plan as Profile["proPlan"]) ?? null,
    onboarded: Boolean(row.onboarded),
    isSeed: Boolean(row.is_seed),
    swipeCountToday: num(row.swipe_count_today),
    swipeDate,
    filterLocation: String(row.filter_location ?? ""),
    filterMaxPrice: row.filter_max_price == null ? null : num(row.filter_max_price),
    filterPropertyType: String(row.filter_property_type ?? "any"),
    filterMinBedrooms: num(row.filter_min_bedrooms),
    taste: parseTaste(row.taste),
    createdAt: asIso(row.created_at),
    isAgent: agentStatus === "approved",
    agentStatus,
  };
}

function parseNotificationData(v: unknown): NotificationData {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  const out: NotificationData = {};
  if (typeof o.listingId === "number") out.listingId = o.listingId;
  if (typeof o.visitId === "number") out.visitId = o.visitId;
  if (typeof o.conversationId === "number") out.conversationId = o.conversationId;
  if (typeof o.offerId === "number") out.offerId = o.offerId;
  if (typeof o.buyerId === "string") out.buyerId = o.buyerId;
  if (typeof o.userId === "string") out.userId = o.userId;
  if (typeof o.salePrice === "number") out.salePrice = o.salePrice;
  return out;
}

function slotsFromJson(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v) as unknown;
      if (Array.isArray(p)) return p.map(String);
    } catch {
      return [];
    }
  }
  return [];
}

async function notify(
  sql: Sql,
  userId: string,
  type: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
) {
  await sql.query(
    `insert into notifications (user_id, type, title, body, data) values ($1,$2,$3,$4,$5::jsonb)`,
    [userId, type, title, body, JSON.stringify(data)],
  );
}

let seedPromise: Promise<void> | null = null;

async function ensureSeed() {
  if (process.env.HOMEZEE_DEMO !== "true") return;
  if (!seedPromise) {
    seedPromise = (async () => {
      const sql = await getSql();
      const rows = await sql<{ c: number }>`select count(*)::int as c from listings`;
      if (num(rows[0]?.c) > 0) return;
      for (const s of SEED_SELLERS) {
        await sql.query(
          `insert into profiles (user_id, display_name, bio, avatar_url, role, onboarded, is_seed)
           values ($1,$2,$3,$4,'seller', true, true)
           on conflict (user_id) do nothing`,
          [s.userId, s.displayName, s.bio, s.avatarUrl],
        );
      }
      for (const a of SEED_AGENTS) {
        await sql.query(
          `insert into profiles (user_id, display_name, bio, avatar_url, role, onboarded, is_seed)
           values ($1,$2,$3,$4,'agent', true, true)
           on conflict (user_id) do nothing`,
          [a.userId, a.displayName, a.bio, a.avatarUrl],
        );
        await sql.query(
          `insert into agent_applications (user_id, license_number, coverage_area, specialty, status)
           values ($1,$2,$3,$4,'approved')
           on conflict (user_id) do nothing`,
          [a.userId, a.licenseNumber, a.coverageArea, a.specialty],
        );
      }
      for (const [index, original] of SEED_LISTINGS.entries()) {
        const cities = ["Braga", "Porto", "Lisboa", "Guimarães", "Aveiro", "Coimbra"];
        const l = { ...original, city: cities[index % cities.length]!, state: "Portugal", address: "Zona de demonstração", neighborhood: "", title: `${original.propertyType === "house" ? "Moradia" : "Apartamento"} T${original.bedrooms} · demonstração`, price: Math.round(original.price / 3), sqft: Math.round(original.sqft * 0.092903), lotSqft: original.lotSqft ? Math.round(original.lotSqft * 0.092903) : null, description: "Casa de demonstração para experimentar a Homezee. Fotografias ilustrativas; não é um anúncio real." };
        await sql.query(
          `insert into listings (
             seller_id, title, address, city, neighborhood, state, price, bedrooms, bathrooms,
             sqft, lot_sqft, year_built, property_type, style, description, promoted, photos
           ) values (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, string_to_array($17, '|||')
           )`,
          [
            l.sellerId,
            l.title,
            l.address,
            l.city,
            l.neighborhood,
            l.state,
            l.price,
            l.bedrooms,
            l.bathrooms,
            l.sqft,
            l.lotSqft,
            l.yearBuilt,
            l.propertyType,
            l.style,
            l.description,
            l.promoted,
            l.photos.join("|||"),
          ],
        );
      }
      await sql`update listings set is_demo = true where seller_id like 'seed-seller-%'`;
      const snaps = buildMarketSnapshots();
      for (const s of snaps) {
        await sql.query(
          `insert into market_snapshots (city, month, avg_price, listing_count, avg_psf)
           values ($1,$2,$3,$4,$5)`,
          [s.city, s.month, s.avgPrice, s.listingCount, s.avgPsf],
        );
      }
    })().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  await seedPromise;
}

async function loadProfile(sql: Sql, userId: string): Promise<Profile | null> {
  const rows = await sql<Record<string, unknown>>`select * from profiles where user_id = ${userId}`;
  if (!rows[0]) return null;
  const ag = await sql<{ status: string }>`select status from agent_applications where user_id = ${userId}`;
  return mapProfile(rows[0], (ag[0]?.status as Profile["agentStatus"]) ?? null);
}

async function ensureProfileRow(
  sql: Sql,
  userId: string,
  hint: { displayName?: string | null; avatarUrl?: string | null },
): Promise<Profile> {
  const existing = await loadProfile(sql, userId);
  if (existing) return existing;
  const name = hint.displayName?.trim() || "New member";
  await sql.query(
    `insert into profiles (user_id, display_name, avatar_url) values ($1,$2,$3)
     on conflict (user_id) do nothing`,
    [userId, name, hint.avatarUrl ?? null],
  );
  const created = await loadProfile(sql, userId);
  if (!created) throw new Error("Could not create profile");
  return created;
}

async function resetSwipeWindow(sql: Sql, profile: Profile): Promise<Profile> {
  const today = new Date().toISOString().slice(0, 10);
  if (profile.swipeDate === today) return profile;
  await sql.query(
    `update profiles set swipe_count_today = 0, swipe_date = $1::date where user_id = $2`,
    [today, profile.userId],
  );
  return { ...profile, swipeCountToday: 0, swipeDate: today };
}

const listingSelect = `
  l.*, p.display_name as seller_name, p.avatar_url as seller_avatar
`;

async function cityAverages(sql: Sql): Promise<Record<string, number>> {
  const rows = await sql<{ city: string; avg: number }>`
    select city, avg(price)::int as avg from listings where status = 'active' group by city
  `;
  const map: Record<string, number> = {};
  for (const r of rows) map[r.city] = num(r.avg);
  return map;
}

function matchesFilters(l: Listing, profile: Profile) {
  if (profile.filterLocation) {
    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const q = normalize(profile.filterLocation);
    const hay = normalize(`${l.city} ${l.neighborhood} ${l.state} ${l.address}`);
    if (!hay.includes(q)) return false;
  }
  if (profile.filterMaxPrice != null && l.price > profile.filterMaxPrice) return false;
  if (profile.filterPropertyType && profile.filterPropertyType !== "any") {
    if (l.propertyType !== profile.filterPropertyType && !(profile.filterPropertyType === "condo" && l.propertyType === "apartment") && !(profile.filterPropertyType === "townhouse" && l.propertyType === "house")) return false;
  }
  if (profile.filterMinBedrooms > 0 && l.bedrooms < profile.filterMinBedrooms) return false;
  return true;
}

async function getOrCreateConvo(sql: Sql, listingId: number, buyerId: string, sellerId: string) {
  const existing = await sql<{ id: number }>`
    select id from conversations where listing_id = ${listingId} and buyer_id = ${buyerId} and seller_id = ${sellerId}
  `;
  if (existing[0]) return num(existing[0].id);
  const inserted = await sql<{ id: number }>`
    insert into conversations (listing_id, buyer_id, seller_id)
    values (${listingId}, ${buyerId}, ${sellerId})
    returning id
  `;
  return num(inserted[0]!.id);
}

function upcomingSlots(): string[] {
  const out: string[] = [];
  const base = new Date();
  const hours = [10, 14, 11];
  for (let i = 0; i < 3; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + 1 + Math.floor(i / 2));
    d.setHours(hours[i]!, 0, 0, 0);
    out.push(d.toISOString());
  }
  return out;
}

export const bootstrap = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { displayName?: string | null; avatarUrl?: string | null }) => data)
  .handler(async ({ context, data }) => {
    await ensureSeed();
    const sql = await getSql();
    let profile = await ensureProfileRow(sql, context.userId, data);
    profile = await resetSwipeWindow(sql, profile);
    const unread = await sql<{ c: number }>`
      select count(*)::int as c from notifications where user_id = ${context.userId} and read = false
    `;
    const remaining = profile.isPro
      ? null
      : Math.max(0, FREE_DAILY_SWIPES - profile.swipeCountToday);
    return { profile, unread: num(unread[0]?.c), remaining };
  });

export const saveOnboarding = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      displayName: string;
      role: "buyer" | "seller" | "agent";
      filterLocation: string;
      filterMaxPrice: number | null;
      filterPropertyType: string;
      filterMinBedrooms: number;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      `update profiles set
         display_name = $1, role = $2, onboarded = true,
         filter_location = $3, filter_max_price = $4,
         filter_property_type = $5, filter_min_bedrooms = $6
       where user_id = $7`,
      [
        data.displayName.trim() || "Member",
        data.role,
        data.filterLocation.trim(),
        data.filterMaxPrice,
        data.filterPropertyType,
        data.filterMinBedrooms,
        context.userId,
      ],
    );
    const profile = await loadProfile(sql, context.userId);
    return profile!;
  });

export const updateFilters = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      filterLocation: string;
      filterMaxPrice: number | null;
      filterPropertyType: string;
      filterMinBedrooms: number;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      `update profiles set filter_location = $1, filter_max_price = $2,
         filter_property_type = $3, filter_min_bedrooms = $4
       where user_id = $5`,
      [
        data.filterLocation.trim(),
        data.filterMaxPrice,
        data.filterPropertyType,
        data.filterMinBedrooms,
        context.userId,
      ],
    );
    return { ok: true };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { displayName: string; bio: string; role: "buyer" | "seller" | "agent" }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      `update profiles set display_name = $1, bio = $2, role = $3 where user_id = $4`,
      [data.displayName.trim(), data.bio, data.role, context.userId],
    );
    return loadProfile(sql, context.userId);
  });

export const getFeed = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureSeed();
    const sql = await getSql();
    let profile = await ensureProfileRow(sql, context.userId, {});
    profile = await resetSwipeWindow(sql, profile);
    const remaining = profile.isPro
      ? null
      : Math.max(0, FREE_DAILY_SWIPES - profile.swipeCountToday);
    if (remaining === 0) {
      return { listings: [] as Listing[], remaining, capped: true, isPro: profile.isPro };
    }
    const raw = await sql.query<Record<string, unknown>>(
      `select ${listingSelect}
       from listings l
       join profiles p on p.user_id = l.seller_id
       where l.status = 'active' and l.origin = 'homezee'
         and l.id not in (select listing_id from swipes where user_id = $1)
       order by l.promoted desc, l.created_at desc`,
      [context.userId],
    );
    const portal = await searchPortals(sql, profile);
    const avgs = await cityAverages(sql);
    let listings = raw.map((r) => {
      const listing = mapListing(r);
      const cityAvg = avgs[listing.city] ?? null;
      listing.isGoodDeal = cityAvg != null && listing.price < cityAvg * 0.88;
      listing.tasteScore = scoreListing(listing, profile.taste, cityAvg);
      return listing;
    });
    listings.push(...portal.listings.map(l => ({ ...l, tasteScore: scoreListing(l, profile.taste, null) })));
    listings = listings.filter((l) => matchesFilters(l, profile));
    listings.sort((a, b) => (b.tasteScore ?? 0) - (a.tasteScore ?? 0));
    return { listings: listings.slice(0, 24), remaining, capped: false, isPro: profile.isPro, portal: portal.status };
  });

export const getSuggestions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const profile = await loadProfile(sql, context.userId);
    if (!profile) throw new Error("No profile");
    if (!profile.isPro) return { locked: true as const, listings: [] as Listing[] };
    const raw = await sql.query<Record<string, unknown>>(
      `select ${listingSelect}
       from listings l
       join profiles p on p.user_id = l.seller_id
       where l.status = 'active' and l.origin = 'homezee'
         and l.id not in (select listing_id from swipes where user_id = $1)`,
      [context.userId],
    );
    const avgs = await cityAverages(sql);
    const scored = raw
      .map((r) => {
        const listing = mapListing(r);
        const cityAvg = avgs[listing.city] ?? null;
        listing.isGoodDeal = cityAvg != null && listing.price < cityAvg * 0.88;
        listing.tasteScore = scoreListing(listing, profile.taste, cityAvg);
        return listing;
      })
      .filter((l) => !matchesFilters(l, profile) || (l.tasteScore ?? 0) > 20)
      .sort((a, b) => (b.tasteScore ?? 0) - (a.tasteScore ?? 0))
      .slice(0, 12);
    return { locked: false as const, listings: scored };
  });

export const getListing = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const sql = await getSql();
    const raw = await sql.query<Record<string, unknown>>(
      `select ${listingSelect}
       from listings l join profiles p on p.user_id = l.seller_id
       where l.id = $1`,
      [id],
    );
    if (!raw[0]) return null;
    return mapListing(raw[0]);
  });

export const recordSwipe = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { listingId: number; action: "left" | "right" | "up" }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    let profile = await ensureProfileRow(sql, context.userId, {});
    profile = await resetSwipeWindow(sql, profile);
    if (!profile.isPro && profile.swipeCountToday >= FREE_DAILY_SWIPES) {
      return { ok: false as const, capped: true, visitId: null as number | null };
    }
    const listingRows = await sql.query<Record<string, unknown>>(
      `select ${listingSelect} from listings l join profiles p on p.user_id = l.seller_id where l.id = $1`,
      [data.listingId],
    );
    const listingRow = listingRows[0];
    if (!listingRow) return { ok: false as const, capped: false, visitId: null };
    const listing = mapListing(listingRow);

    await sql.query(
      `insert into swipes (user_id, listing_id, action) values ($1,$2,$3)
       on conflict (user_id, listing_id) do update set action = excluded.action`,
      [context.userId, data.listingId, data.action],
    );
    if (data.action === "right" || data.action === "up") {
      await sql.query(
        `insert into favorites (user_id, listing_id) values ($1,$2) on conflict do nothing`,
        [context.userId, data.listingId],
      );
    }
    const taste = applyTaste(profile.taste, listing, data.action);
    await sql.query(
      `update profiles set taste = $1::jsonb, swipe_count_today = swipe_count_today + 1, swipe_date = current_date
       where user_id = $2`,
      [JSON.stringify(taste), context.userId],
    );

    let visitId: number | null = null;
    if (data.action === "up" && listing.origin !== "external") {
      visitId = await createVisitInternal(sql, profile, listing);
    }
    return { ok: true as const, capped: false, visitId };
  });

async function createVisitInternal(sql: Sql, profile: Profile, listing: Listing): Promise<number> {
  if (listing.origin === "external") throw new Error("A visita é pedida no portal original.");
  if (listing.status !== "active") throw new Error("Esta casa já não está disponível.");
  const existing = await sql<{ id: number; status: string }>`
    select id, status from visits
    where listing_id = ${listing.id} and buyer_id = ${profile.userId}
      and status not in ('declined','cancelled')
    order by id desc limit 1
  `;
  if (existing[0] && existing[0].status !== "completed") return num(existing[0].id);

  const inserted = await sql<{ id: number }>`
    insert into visits (listing_id, buyer_id, seller_id, status)
    values (${listing.id}, ${profile.userId}, ${listing.sellerId}, 'requested')
    returning id
  `;
  const visitId = num(inserted[0]!.id);
  await notify(
    sql,
    listing.sellerId,
    "visit_request",
    "Visit request",
    `${profile.displayName} wants to tour ${listing.title}.`,
    { visitId, listingId: listing.id, buyerId: profile.userId },
  );
  const convoId = await getOrCreateConvo(sql, listing.id, profile.userId, listing.sellerId);
  await sql.query(
    `insert into messages (conversation_id, sender_id, body) values ($1,$2,$3)`,
    [
      convoId,
      profile.userId,
      `Hi — I'd like to schedule a visit at ${listing.title}. I'll confirm a time in the in-app scheduler.`,
    ],
  );

  const seller = await loadProfile(sql, listing.sellerId);
  if (seller?.isSeed) {
    const slots = upcomingSlots();
    await sql.query(
      `update visits set status = 'slots_proposed', proposed_slots = $1::jsonb, updated_at = now() where id = $2`,
      [JSON.stringify(slots), visitId],
    );
    await notify(
      sql,
      profile.userId,
      "visit_slots",
      "Times proposed",
      `${seller.displayName} proposed visit times for ${listing.title}. Pick one to confirm.`,
      { visitId, listingId: listing.id },
    );
    await sql.query(
      `insert into messages (conversation_id, sender_id, body) values ($1,$2,$3)`,
      [
        convoId,
        listing.sellerId,
        "Thanks for the interest — I proposed a few times. Chat isn't enough to lock a visit; pick a slot in Visits so we're both on the calendar.",
      ],
    );
  }
  return visitId;
}

export const requestVisit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((listingId: number) => listingId)
  .handler(async ({ context, data: listingId }) => {
    const sql = await getSql();
    const profile = await ensureProfileRow(sql, context.userId, {});
    const raw = await sql.query<Record<string, unknown>>(
      `select ${listingSelect} from listings l join profiles p on p.user_id = l.seller_id where l.id = $1`,
      [listingId],
    );
    if (!raw[0]) throw new Error("Listing not found");
    const id = await createVisitInternal(sql, profile, mapListing(raw[0]));
    return { visitId: id };
  });

export const listFavorites = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const raw = await sql.query<Record<string, unknown>>(
      `select ${listingSelect}
       from favorites f
       join listings l on l.id = f.listing_id
       join profiles p on p.user_id = l.seller_id
       where f.user_id = $1
       order by f.created_at desc`,
      [context.userId],
    );
    return raw.map((r) => mapListing(r));
  });

export const listVisits = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    // Completion requires an explicit confirmation from a participant.
    const raw = await sql.query<Record<string, unknown>>(
      `select v.*, l.title as listing_title, l.address as listing_address, l.price as listing_price,
              l.photos[1] as listing_photo,
              bp.display_name as buyer_name, bp.avatar_url as buyer_avatar,
              sp.display_name as seller_name
       from visits v
       join listings l on l.id = v.listing_id
       join profiles bp on bp.user_id = v.buyer_id
       join profiles sp on sp.user_id = v.seller_id
       where v.buyer_id = $1 or v.seller_id = $1
       order by v.created_at desc`,
      [context.userId],
    );
    return raw.map(
      (r): Visit => ({
        id: num(r.id),
        listingId: num(r.listing_id),
        listingTitle: String(r.listing_title),
        listingPhoto: r.listing_photo ? String(r.listing_photo) : null,
        listingAddress: String(r.listing_address),
        listingPrice: num(r.listing_price),
        buyerId: String(r.buyer_id),
        buyerName: String(r.buyer_name),
        buyerAvatar: r.buyer_avatar ? String(r.buyer_avatar) : null,
        sellerId: String(r.seller_id),
        sellerName: String(r.seller_name),
        status: r.status as Visit["status"],
        proposedSlots: slotsFromJson(r.proposed_slots),
        confirmedSlot: r.confirmed_slot ? asIso(r.confirmed_slot) : null,
        createdAt: asIso(r.created_at),
      }),
    );
  });

export const proposeVisitSlots = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { visitId: number; slots: string[] }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`select * from visits where id = ${data.visitId} and seller_id = ${context.userId}`;
    if (!rows[0]) throw new Error("Visit not found");
    const slots = data.slots.filter(Boolean).slice(0, 5);
    if (slots.length < 2) throw new Error("Propose at least two times");
    await sql.query(
      `update visits set status = 'slots_proposed', proposed_slots = $1::jsonb, updated_at = now() where id = $2`,
      [JSON.stringify(slots), data.visitId],
    );
    const listing = await sql<{ title: string }>`select title from listings where id = ${num(rows[0].listing_id)}`;
    const me = await loadProfile(sql, context.userId);
    await notify(
      sql,
      String(rows[0].buyer_id),
      "visit_slots",
      "Times proposed",
      `${me?.displayName ?? "Seller"} proposed times for ${listing[0]?.title ?? "the home"}.`,
      { visitId: data.visitId },
    );
    return { ok: true };
  });

export const declineVisit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((visitId: number) => visitId)
  .handler(async ({ context, data: visitId }) => {
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`select * from visits where id = ${visitId} and seller_id = ${context.userId}`;
    if (!rows[0]) throw new Error("Visit not found");
    await sql`update visits set status = 'declined', updated_at = now() where id = ${visitId}`;
    await notify(sql, String(rows[0].buyer_id), "visit_declined", "Visit declined", "The seller declined this visit request.", {
      visitId,
    });
    return { ok: true };
  });

export const pickVisitSlot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { visitId: number; slot: string }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`select * from visits where id = ${data.visitId} and buyer_id = ${context.userId}`;
    if (!rows[0]) throw new Error("Visit not found");
    if (rows[0].status !== "slots_proposed" || !slotsFromJson(rows[0].proposed_slots).some(s => new Date(s).getTime() === new Date(data.slot).getTime()) || new Date(data.slot).getTime() <= Date.now()) throw new Error("Escolhe um dos horários futuros propostos.");
    await sql.query(
      `update visits set status = 'confirmed', confirmed_slot = $1::timestamptz, updated_at = now() where id = $2`,
      [data.slot, data.visitId],
    );
    const me = await loadProfile(sql, context.userId);
    await notify(
      sql,
      String(rows[0].seller_id),
      "visit_confirmed",
      "Visit confirmed",
      `${me?.displayName ?? "Buyer"} confirmed a visit time.`,
      { visitId: data.visitId },
    );
    return { ok: true };
  });

export const completeVisit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((visitId: number) => visitId)
  .handler(async ({ context, data: visitId }) => {
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`
      select * from visits where id = ${visitId} and (buyer_id = ${context.userId} or seller_id = ${context.userId})
    `;
    if (!rows[0]) throw new Error("Visit not found");
    if (rows[0].status !== "confirmed" || !rows[0].confirmed_slot || new Date(String(rows[0].confirmed_slot)).getTime() > Date.now()) throw new Error("Confirma a realização após o horário da visita.");
    await sql`update visits set status = 'completed', updated_at = now() where id = ${visitId} and status = 'confirmed'`;
    return { ok: true };
  });

export const listConversations = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const raw = await sql.query<Record<string, unknown>>(
      `select c.*, l.title as listing_title, l.photos[1] as listing_photo,
              case when c.buyer_id = $1 then sp.display_name else bp.display_name end as other_name,
              case when c.buyer_id = $1 then sp.avatar_url else bp.avatar_url end as other_avatar,
              (select body from messages m where m.conversation_id = c.id order by id desc limit 1) as last_message,
              (select created_at from messages m where m.conversation_id = c.id order by id desc limit 1) as last_at
       from conversations c
       join listings l on l.id = c.listing_id
       join profiles bp on bp.user_id = c.buyer_id
       join profiles sp on sp.user_id = c.seller_id
       where c.buyer_id = $1 or c.seller_id = $1
       order by last_at desc nulls last, c.id desc`,
      [context.userId],
    );
    return raw.map(
      (r): Conversation => ({
        id: num(r.id),
        listingId: num(r.listing_id),
        listingTitle: String(r.listing_title),
        listingPhoto: r.listing_photo ? String(r.listing_photo) : null,
        buyerId: String(r.buyer_id),
        sellerId: String(r.seller_id),
        otherName: String(r.other_name ?? "Member"),
        otherAvatar: r.other_avatar ? String(r.other_avatar) : null,
        lastMessage: r.last_message ? String(r.last_message) : null,
        lastAt: r.last_at ? asIso(r.last_at) : null,
        unread: 0,
      }),
    );
  });

export const openConversation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((listingId: number) => listingId)
  .handler(async ({ context, data: listingId }) => {
    const sql = await getSql();
    const listing = await sql<{ seller_id: string; origin: string }>`select seller_id, origin from listings where id = ${listingId}`;
    if (!listing[0]) throw new Error("Listing not found");
    if (listing[0].origin === "external") throw new Error("Contacta o anunciante no portal original.");
    const sellerId = listing[0].seller_id;
    if (sellerId === context.userId) throw new Error("You listed this home");
    const id = await getOrCreateConvo(sql, listingId, context.userId, sellerId);
    return { conversationId: id };
  });

export const getMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((conversationId: number) => conversationId)
  .handler(async ({ context, data: conversationId }) => {
    const sql = await getSql();
    const convo = await sql<Record<string, unknown>>`
      select c.*, l.title as listing_title, l.id as lid
      from conversations c join listings l on l.id = c.listing_id
      where c.id = ${conversationId} and (c.buyer_id = ${context.userId} or c.seller_id = ${context.userId})
    `;
    if (!convo[0]) throw new Error("Conversation not found");
    const msgs = await sql<Record<string, unknown>>`
      select * from messages where conversation_id = ${conversationId} order by id asc
    `;
    const otherId =
      String(convo[0].buyer_id) === context.userId
        ? String(convo[0].seller_id)
        : String(convo[0].buyer_id);
    const other = await loadProfile(sql, otherId);
    return {
      conversation: {
        id: conversationId,
        listingId: num(convo[0].listing_id),
        listingTitle: String(convo[0].listing_title),
        otherName: other?.displayName ?? "Member",
        otherAvatar: other?.avatarUrl ?? null,
        buyerId: String(convo[0].buyer_id),
        sellerId: String(convo[0].seller_id),
      },
      messages: msgs.map(
        (m): ChatMessage => ({
          id: num(m.id),
          conversationId: num(m.conversation_id),
          senderId: String(m.sender_id),
          body: String(m.body),
          createdAt: asIso(m.created_at),
        }),
      ),
    };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { conversationId: number; body: string }) => data)
  .handler(async ({ context, data }) => {
    const body = data.body.trim();
    if (!body) throw new Error("Message is empty");
    const sql = await getSql();
    const convo = await sql<Record<string, unknown>>`
      select * from conversations where id = ${data.conversationId}
        and (buyer_id = ${context.userId} or seller_id = ${context.userId})
    `;
    if (!convo[0]) throw new Error("Conversation not found");
    const inserted = await sql<Record<string, unknown>>`
      insert into messages (conversation_id, sender_id, body)
      values (${data.conversationId}, ${context.userId}, ${body})
      returning *
    `;
    const otherId =
      String(convo[0].buyer_id) === context.userId
        ? String(convo[0].seller_id)
        : String(convo[0].buyer_id);
    const me = await loadProfile(sql, context.userId);
    await notify(sql, otherId, "new_message", "New message", `${me?.displayName ?? "Someone"}: ${body.slice(0, 80)}`, {
      conversationId: data.conversationId,
    });
    const other = await loadProfile(sql, otherId);
    if (other?.isSeed) {
      const prior = await sql<{ c: number }>`
        select count(*)::int as c from messages
        where conversation_id = ${data.conversationId} and sender_id = ${otherId}
      `;
      if (num(prior[0]?.c) < 2) {
        await sql.query(
          `insert into messages (conversation_id, sender_id, body) values ($1,$2,$3)`,
          [
            data.conversationId,
            otherId,
            "Got it — happy to chat here. Visit times still have to be confirmed in the scheduler so both calendars stay in sync.",
          ],
        );
      }
    }
    return {
      id: num(inserted[0]!.id),
      conversationId: data.conversationId,
      senderId: context.userId,
      body,
      createdAt: asIso(inserted[0]!.created_at),
    } satisfies ChatMessage;
  });

export const submitOffer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { listingId: number; amount: number }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const visit = await sql<Record<string, unknown>>`
      select * from visits
      where listing_id = ${data.listingId} and buyer_id = ${context.userId} and status = 'completed'
      order by id desc limit 1
    `;
    if (!visit[0]) throw new Error("Offers unlock after a completed visit");
    const listing = await sql<{ seller_id: string; title: string; status: string }>`
      select seller_id, title, status from listings where id = ${data.listingId}
    `;
    if (!listing[0] || listing[0].status === "sold") throw new Error("Listing unavailable");
    const amount = Math.round(data.amount);
    if (amount < 1000) throw new Error("Offer is too low");
    const inserted = await sql<{ id: number }>`
      insert into offers (listing_id, buyer_id, seller_id, visit_id, amount, status)
      values (${data.listingId}, ${context.userId}, ${listing[0].seller_id}, ${num(visit[0].id)}, ${amount}, 'pending')
      returning id
    `;
    await sql`update listings set status = 'under_offer' where id = ${data.listingId} and status = 'active'`;
    const me = await loadProfile(sql, context.userId);
    await notify(
      sql,
      listing[0].seller_id,
      "offer_received",
      "New offer",
      `${me?.displayName ?? "A buyer"} offered on ${listing[0].title}.`,
      { offerId: num(inserted[0]!.id), listingId: data.listingId },
    );
    return { offerId: num(inserted[0]!.id) };
  });

export const listOffers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const raw = await sql.query<Record<string, unknown>>(
      `select o.*, l.title as listing_title, l.photos[1] as listing_photo, l.price as listing_price,
              bp.display_name as buyer_name, sp.display_name as seller_name
       from offers o
       join listings l on l.id = o.listing_id
       join profiles bp on bp.user_id = o.buyer_id
       join profiles sp on sp.user_id = o.seller_id
       where o.buyer_id = $1 or o.seller_id = $1
       order by o.created_at desc`,
      [context.userId],
    );
    return raw.map(
      (r): Offer => ({
        id: num(r.id),
        listingId: num(r.listing_id),
        listingTitle: String(r.listing_title),
        listingPhoto: r.listing_photo ? String(r.listing_photo) : null,
        listingPrice: num(r.listing_price),
        buyerId: String(r.buyer_id),
        buyerName: String(r.buyer_name),
        sellerId: String(r.seller_id),
        sellerName: String(r.seller_name),
        visitId: num(r.visit_id),
        amount: num(r.amount),
        status: r.status as Offer["status"],
        counterAmount: r.counter_amount == null ? null : num(r.counter_amount),
        createdAt: asIso(r.created_at),
      }),
    );
  });

async function matchAgent(sql: Sql, listing: { city: string; property_type: string }) {
  const rows = await sql.query<{ user_id: string; display_name: string }>(
    `select a.user_id, p.display_name
     from agent_applications a
     join profiles p on p.user_id = a.user_id
     where a.status = 'approved'
       and (lower(a.coverage_area) = 'any' or a.coverage_area ilike '%' || $1 || '%')
       and (a.specialty = 'any' or a.specialty = $2)
     order by random()
     limit 1`,
    [listing.city, listing.property_type],
  );
  return rows[0] ?? null;
}

export const respondOffer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: { offerId: number; action: "accept" | "reject" | "counter"; counterAmount?: number }) =>
      data,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`select * from offers where id = ${data.offerId}`;
    const offer = rows[0];
    if (!offer) throw new Error("Offer not found");
    const isSeller = String(offer.seller_id) === context.userId;
    const isBuyer = String(offer.buyer_id) === context.userId;
    if (data.action === "counter") {
      if (!isSeller) throw new Error("Only the seller can counter");
      const amt = Math.round(data.counterAmount ?? 0);
      if (amt < 1000) throw new Error("Counter is too low");
      await sql.query(
        `update offers set status = 'countered', counter_amount = $1, updated_at = now() where id = $2`,
        [amt, data.offerId],
      );
      await notify(sql, String(offer.buyer_id), "offer_update", "Counter offer", "The seller sent a counter offer.", {
        offerId: data.offerId,
      });
      return { ok: true };
    }
    if (data.action === "reject") {
      if (!isSeller && !isBuyer) throw new Error("Not allowed");
      await sql`update offers set status = 'rejected', updated_at = now() where id = ${data.offerId}`;
      const other = isSeller ? String(offer.buyer_id) : String(offer.seller_id);
      await notify(sql, other, "offer_update", "Offer rejected", "An offer was rejected.", { offerId: data.offerId });
      const open = await sql<{ c: number }>`
        select count(*)::int as c from offers
        where listing_id = ${num(offer.listing_id)} and status in ('pending','countered')
      `;
      if (num(open[0]?.c) === 0) {
        await sql`update listings set status = 'active' where id = ${num(offer.listing_id)} and status = 'under_offer'`;
      }
      return { ok: true };
    }
    if (data.action === "accept") {
      const listing = await sql<Record<string, unknown>>`select * from listings where id = ${num(offer.listing_id)}`;
      const L = listing[0];
      if (!L) throw new Error("Listing missing");
      if (String(offer.status) === "countered") {
        if (!isBuyer) throw new Error("Buyer accepts the counter");
      } else if (!isSeller) {
        throw new Error("Seller accepts the offer");
      }
      const salePrice =
        String(offer.status) === "countered" && offer.counter_amount != null
          ? num(offer.counter_amount)
          : num(offer.amount);
      await sql`update offers set status = 'accepted', updated_at = now() where id = ${data.offerId}`;
      await sql`update listings set status = 'under_offer' where id = ${num(offer.listing_id)}`;
      const handling = L.sale_handling === "in_app" ? "in_app" : L.sale_handling === "independent" ? "independent" : null;
      if (handling === "in_app") {
        const agent = await matchAgent(sql, {
          city: String(L.city),
          property_type: String(L.property_type),
        });
        const platformFee = Math.round(salePrice * PLATFORM_FEE_RATE);
        const agentFee = agent ? Math.round(salePrice * AGENT_FEE_RATE) : 0;
        await sql.query(
          `insert into transactions (listing_id, buyer_id, seller_id, offer_id, sale_price, handle_independently, platform_fee, agent_fee, agent_id, status)
           values ($1,$2,$3,$4,$5,false,$6,$7,$8,'pending')`,
          [
            num(offer.listing_id),
            String(offer.buyer_id),
            String(offer.seller_id),
            data.offerId,
            salePrice,
            platformFee,
            agent ? agentFee : agentFee,
            agent?.user_id ?? null,
          ],
        );
        if (agent) {
          await notify(
            sql,
            agent.user_id,
            "agent_match",
            "You were matched to a closing",
            `Processo de venda pendente para ${String(L.title)}. Comissão prevista após conclusão.`,
            { listingId: num(L.id), salePrice },
          );
        }
      } else {
        await sql.query(
          `insert into transactions (listing_id, buyer_id, seller_id, offer_id, sale_price, handle_independently, platform_fee, agent_fee, status)
           values ($1,$2,$3,$4,$5,true,0,0,'pending')`,
          [
            num(offer.listing_id),
            String(offer.buyer_id),
            String(offer.seller_id),
            data.offerId,
            salePrice,
          ],
        );
      }
      await notify(sql, String(offer.buyer_id), "offer_update", "Offer accepted", "The offer was accepted.", {
        offerId: data.offerId,
      });
      await notify(sql, String(offer.seller_id), "offer_update", "Offer accepted", "The offer was accepted.", {
        offerId: data.offerId,
      });
      return { ok: true };
    }
    return { ok: true };
  });

export const setSaleHandling = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { listingId: number; handling: "independent" | "in_app" }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const res = await sql`
      update listings set sale_handling = ${data.handling}
      where id = ${data.listingId} and seller_id = ${context.userId}
      returning id
    `;
    if (!res[0]) throw new Error("Listing not found");
    return { ok: true };
  });

export const myListings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const raw = await sql.query<Record<string, unknown>>(
      `select ${listingSelect}
       from listings l join profiles p on p.user_id = l.seller_id
       where l.seller_id = $1
       order by l.created_at desc`,
      [context.userId],
    );
    return raw.map((r) => mapListing(r));
  });

export const listingAnalytics = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((listingId: number) => listingId)
  .handler(async ({ context, data: listingId }) => {
    const sql = await getSql();
    const owned = await sql<{ id: number }>`select id from listings where id = ${listingId} and seller_id = ${context.userId}`;
    if (!owned[0]) throw new Error("Listing not found");
    const [swipes, rights, ups, favs, visits] = await Promise.all([
      sql<{ c: number }>`select count(*)::int as c from swipes where listing_id = ${listingId}`,
      sql<{ c: number }>`select count(*)::int as c from swipes where listing_id = ${listingId} and action = 'right'`,
      sql<{ c: number }>`select count(*)::int as c from swipes where listing_id = ${listingId} and action = 'up'`,
      sql<{ c: number }>`select count(*)::int as c from favorites where listing_id = ${listingId}`,
      sql<{ c: number }>`select count(*)::int as c from visits where listing_id = ${listingId}`,
    ]);
    return {
      swipes: num(swipes[0]?.c),
      likes: num(rights[0]?.c),
      visitSwipes: num(ups[0]?.c),
      favorites: num(favs[0]?.c),
      visitRequests: num(visits[0]?.c),
    };
  });

export const createListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
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
      photos: string[];
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const photos = data.photos.filter(Boolean).slice(0, 8);
    if (photos.length === 0) throw new Error("Adiciona pelo menos uma fotografia.");
    if (photos.some(p => p.length > 4500000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p) && !/^https:\/\//.test(p))) throw new Error("Fotografia inválida.");
    if (!data.title.trim() || !data.city.trim() || !Number.isFinite(data.price) || data.price <= 0 || !Number.isFinite(data.sqft) || data.sqft <= 0) throw new Error("Indica título, cidade, preço e área válidos.");
    const inserted = await sql.query<{ id: number }>(
      `insert into listings (
         seller_id, title, address, city, neighborhood, state, price, bedrooms, bathrooms,
         sqft, lot_sqft, year_built, property_type, style, description, photos
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, string_to_array($16,'|||'))
       returning id`,
      [
        context.userId,
        data.title.trim(),
        data.address.trim(),
        data.city.trim(),
        data.neighborhood.trim(),
        data.state.trim(),
        Math.round(data.price),
        data.bedrooms,
        data.bathrooms,
        data.sqft,
        data.lotSqft,
        data.yearBuilt,
        data.propertyType,
        data.style.trim() || "modern",
        data.description.trim(),
        photos.join("|||"),
      ],
    );
    const listingId = num(inserted[0]!.id);
    const listing = mapListing({
      id: listingId,
      seller_id: context.userId,
      ...data,
      property_type: data.propertyType,
      year_built: data.yearBuilt,
      lot_sqft: data.lotSqft,
      status: "active",
      promoted: false,
      photos,
    });
    const me = await loadProfile(sql, context.userId);
    if (me) {
      const buyers = await sql<{ user_id: string; is_pro: boolean; taste: unknown; filter_location: string; filter_max_price: number | null; filter_property_type: string; filter_min_bedrooms: number }>`
        select user_id, is_pro, taste, filter_location, filter_max_price, filter_property_type, filter_min_bedrooms
        from profiles where onboarded = true and user_id <> ${context.userId} and is_seed = false
      `;
      const avgs = await cityAverages(sql);
      for (const b of buyers) {
        if (!b.is_pro) continue;
        const fake: Profile = {
          ...(await ensureProfileRow(sql, b.user_id, {})),
          filterLocation: b.filter_location,
          filterMaxPrice: b.filter_max_price,
          filterPropertyType: b.filter_property_type,
          filterMinBedrooms: num(b.filter_min_bedrooms),
          taste: parseTaste(b.taste),
          isPro: true,
        };
        const cityAvg = avgs[listing.city] ?? null;
        const goodDeal = cityAvg != null && listing.price < cityAvg * 0.88;
        const tasteHit = scoreListing(listing, fake.taste, cityAvg) >= 24;
        const filterHit = matchesFilters(listing, fake);
        if (tasteHit || filterHit || goodDeal) {
          const reason = goodDeal ? "Looks like a good deal in this market." : tasteHit ? "Matches your taste profile." : "Fits your saved filters.";
          await notify(sql, b.user_id, "smart_match", "New listing for you", `${listing.title} in ${listing.city}. ${reason}`, {
            listingId,
          });
        }
      }
    }
    return { listingId };
  });

export const updateListingStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { listingId: number; status: Listing["status"] }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const res = await sql`
      update listings set status = ${data.status}
      where id = ${data.listingId} and seller_id = ${context.userId}
      returning id
    `;
    if (!res[0]) throw new Error("Listing not found");
    return { ok: true };
  });

export const boostListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((listingId: number) => listingId)
  .handler(async ({ context, data: listingId }) => {
    if (process.env.HOMEZEE_DEMO !== "true") throw new Error("Os pagamentos ainda não estão disponíveis nesta versão.");
    const sql = await getSql();
    const res = await sql`
      update listings set promoted = true, promoted_until = now() + interval '7 days'
      where id = ${listingId} and seller_id = ${context.userId}
      returning id
    `;
    if (!res[0]) throw new Error("Listing not found");
    return { ok: true };
  });

export const activatePro = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((plan: "monthly" | "yearly") => plan)
  .handler(async ({ context, data: plan }) => {
    if (process.env.HOMEZEE_DEMO !== "true") throw new Error("Os pagamentos ainda não estão disponíveis nesta versão.");
    const sql = await getSql();
    await sql.query(
      `update profiles set is_pro = true, pro_plan = $1 where user_id = $2`,
      [plan, context.userId],
    );
    await notify(
      sql,
      context.userId,
      "pro",
      "You're Pro",
      "Unlimited swipes, Smart Suggestions, Smart Notifications, and full market stats are on.",
      {},
    );
    const listings = await sql.query<Record<string, unknown>>(
      `select ${listingSelect} from listings l join profiles p on p.user_id = l.seller_id where l.status = 'active' limit 8`,
    );
    const profile = await loadProfile(sql, context.userId);
    if (profile) {
      const avgs = await cityAverages(sql);
      for (const r of listings) {
        const listing = mapListing(r);
        const cityAvg = avgs[listing.city] ?? null;
        if (cityAvg && listing.price < cityAvg * 0.88) {
          await notify(
            sql,
            context.userId,
            "good_deal",
            "Good deal nearby",
            `${listing.title} in ${listing.city} is priced below the local average.`,
            { listingId: listing.id },
          );
        }
      }
    }
    return loadProfile(sql, context.userId);
  });

export const applyAgent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { licenseNumber: string; coverageArea: string; specialty: string }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      `insert into agent_applications (user_id, license_number, coverage_area, specialty, status)
       values ($1,$2,$3,$4,'pending')
       on conflict (user_id) do update set
         license_number = excluded.license_number,
         coverage_area = excluded.coverage_area,
         specialty = excluded.specialty,
         status = 'pending'`,
      [context.userId, data.licenseNumber.trim(), data.coverageArea.trim(), data.specialty],
    );
    await sql`update profiles set role = 'agent' where user_id = ${context.userId}`;
    const admins = await sql<{ user_id: string }>`select user_id from profiles where is_admin = true`;
    for (const a of admins) {
      await notify(sql, a.user_id, "agent_application", "Agent application", "A new agent application needs review.", {
        userId: context.userId,
      });
    }
    return loadProfile(sql, context.userId);
  });

export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (process.env.HOMEZEE_ADMIN_USER_ID !== context.userId) throw new Error("Acesso reservado à administração.");
    const sql = await getSql();
    const existing = await sql<{ c: number }>`select count(*)::int as c from profiles where is_admin = true`;
    if (num(existing[0]?.c) === 0) {
      await sql`update profiles set is_admin = true where user_id = ${context.userId}`;
    }
    return loadProfile(sql, context.userId);
  });

export const listAgentApplications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const me = await loadProfile(sql, context.userId);
    if (!me?.isAdmin) throw new Error("Admin only");
    const raw = await sql<Record<string, unknown>>`
      select a.*, p.display_name
      from agent_applications a
      join profiles p on p.user_id = a.user_id
      order by a.created_at desc
    `;
    return raw.map(
      (r): AgentApplication => ({
        id: num(r.id),
        userId: String(r.user_id),
        displayName: String(r.display_name),
        licenseNumber: String(r.license_number),
        coverageArea: String(r.coverage_area),
        specialty: String(r.specialty),
        status: r.status as AgentApplication["status"],
        createdAt: asIso(r.created_at),
      }),
    );
  });

export const reviewAgent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { applicationId: number; status: "approved" | "rejected" }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await loadProfile(sql, context.userId);
    if (!me?.isAdmin) throw new Error("Admin only");
    const app = await sql<{ user_id: string }>`
      update agent_applications set status = ${data.status} where id = ${data.applicationId}
      returning user_id
    `;
    if (!app[0]) throw new Error("Not found");
    await notify(
      sql,
      app[0].user_id,
      "agent_review",
      data.status === "approved" ? "You're verified" : "Application update",
      data.status === "approved"
        ? "Your agent application was approved. Eligible closings can now match you for a 1% fee share."
        : "Your agent application was not approved.",
      {},
    );
    return { ok: true };
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const raw = await sql<Record<string, unknown>>`
      select * from notifications where user_id = ${context.userId} order by id desc limit 50
    `;
    return raw.map(
      (r): NotificationRow => ({
        id: num(r.id),
        type: String(r.type),
        title: String(r.title),
        body: String(r.body),
        data: parseNotificationData(r.data),
        read: Boolean(r.read),
        createdAt: asIso(r.created_at),
      }),
    );
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`update notifications set read = true where user_id = ${context.userId}`;
    return { ok: true };
  });

export const marketStats = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureSeed();
    const sql = await getSql();
    const profile = await loadProfile(sql, context.userId);
    const snaps = await sql<{ city: string; month: string; avg_price: number; listing_count: number; avg_psf: number }>`
      select city, month, avg_price, listing_count, avg_psf from market_snapshots order by month asc
    `;
    const live = await sql<{ city: string; avg_price: number; n: number; avg_psf: number }>`
      select city,
             avg(price)::int as avg_price,
             count(*)::int as n,
             avg(price / greatest(sqft,1))::int as avg_psf
      from listings
      where status in ('active','under_offer','sold')
      group by city
      order by avg_price desc
    `;
    const volume = await sql<{ status: string; n: number }>`
      select status, count(*)::int as n from listings group by status
    `;
    const deals = await sql<{ c: number }>`select count(*)::int as c from transactions`;
    const avgs = await cityAverages(sql);
    const goodDeals = await sql.query<Record<string, unknown>>(
      `select ${listingSelect} from listings l join profiles p on p.user_id = l.seller_id where l.status = 'active'`,
    );
    const good = goodDeals
      .map((r) => mapListing(r))
      .filter((l) => avgs[l.city] && l.price < avgs[l.city]! * 0.88)
      .slice(0, 6);
    return {
      isPro: Boolean(profile?.isPro),
      snapshots: snaps.map((s) => ({
        city: s.city,
        month: s.month,
        avgPrice: num(s.avg_price),
        listingCount: num(s.listing_count),
        avgPsf: num(s.avg_psf),
      })),
      byCity: live.map((r) => ({
        city: r.city,
        avgPrice: num(r.avg_price),
        count: num(r.n),
        avgPsf: num(r.avg_psf),
      })),
      volume: volume.map((v) => ({ status: v.status, count: num(v.n) })),
      closings: num(deals[0]?.c),
      goodDeals: good,
    };
  });

export const myTransactions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const me = await loadProfile(sql, context.userId);
    const raw = await sql.query<Record<string, unknown>>(
      `select t.*, l.title as listing_title, ap.display_name as agent_name
       from transactions t
       join listings l on l.id = t.listing_id
       left join profiles ap on ap.user_id = t.agent_id
       where t.buyer_id = $1 or t.seller_id = $1 or t.agent_id = $1
       order by t.created_at desc`,
      [context.userId],
    );
    return {
      isAgent: Boolean(me?.isAgent),
      rows: raw.map(
        (r): TransactionRow => ({
          id: num(r.id),
          listingId: num(r.listing_id),
          listingTitle: String(r.listing_title),
          salePrice: num(r.sale_price),
          handleIndependently: Boolean(r.handle_independently),
          platformFee: num(r.platform_fee),
          agentFee: num(r.agent_fee),
          agentName: r.agent_name ? String(r.agent_name) : null,
          status: String(r.status),
          createdAt: asIso(r.created_at),
        }),
      ),
    };
  });

// The collector only fetches fixed public portal hosts; URLs are never supplied by the client.
async function searchPortals(sql: Sql, profile: Profile): Promise<{listings: Listing[]; status: {searching: boolean; errors: string[]; received: number}}> {
  const typeMap: Record<string, string> = { any: "Todos", house: "Moradia", townhouse: "Moradia", apartment: "Apartamento", condo: "Apartamento", land: "Terreno", farm: "Quinta" };
  const city = profile.filterLocation.trim();
  const empty = { listings: [] as Listing[], status: {searching: false, errors: [] as string[], received: 0} };
  if (!city) return empty;
  try {
    const port = Number(process.env.COLLECTOR_PORT || 8090);
    const params = new URLSearchParams({city, type: typeMap[profile.filterPropertyType] || "Todos", maxPrice: String(profile.filterMaxPrice || 0), beds: String(profile.filterMinBedrooms || 0)});
    const response = await fetch(`http://127.0.0.1:${port}/api/listings?${params}`, {signal: AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error("Pesquisa temporariamente indisponível");
    const result = await response.json() as {listings: {title: string; city: string; address: string; type: string; price: number; beds: number | null; size: number | null; photos: string[]; url: string; source: string; desc: string; mapQuery?: string; geo?: Listing["geo"]}[]; searching: boolean; sync: {errors?: string[]}};
    const out: Listing[] = [];
    for (const item of result.listings) {
      const url = new URL(item.url);
      if (url.protocol !== "https:" || !["www.imovirtual.com", "www.idealista.pt"].includes(url.hostname)) continue;
      const sellerId = `portal-${item.source.toLowerCase()}`;
      await sql.query("insert into profiles (user_id, display_name, onboarded, role) values ($1,$2,true,'seller') on conflict do nothing", [sellerId,item.source]);
      const type = ({Moradia: "house", Apartamento: "apartment", Terreno: "land", Quinta: "farm"} as Record<string,string>)[item.type] || "apartment";
      const rows = await sql.query<Record<string,unknown>>(`insert into listings (seller_id,title,address,city,state,price,bedrooms,bathrooms,sqft,property_type,description,photos,origin,source,source_url,map_query,geo,bedrooms_unknown,area_unknown,observed_at)
        values ($1,$2,$3,$4,'Portugal',$5,$6,0,$7,$8,$9,string_to_array($10,'|||'),'external',$11,$12,$13,$14::jsonb,$15,$16,now())
        on conflict (source_url) do update set price=excluded.price,title=excluded.title,photos=excluded.photos,observed_at=now(),map_query=excluded.map_query,geo=excluded.geo,bedrooms_unknown=excluded.bedrooms_unknown,area_unknown=excluded.area_unknown
        returning *`, [sellerId,item.title,item.address,item.city,Math.round(item.price),item.beds ?? 0,item.size ?? 0,type,item.desc,item.photos.join('|||'),item.source,item.url,item.mapQuery || `${item.address}, ${item.city}, Portugal`,JSON.stringify(item.geo || null),item.beds == null,item.size == null]);
      if (!rows[0]) continue;
      const seen = await sql.query("select 1 from swipes where user_id=$1 and listing_id=$2",[profile.userId,rows[0].id]);
      if (!seen.length) out.push(mapListing(rows[0], {sellerName:item.source, bedsUnknown:item.beds == null, areaUnknown:item.size == null}));
    }
    return {listings:out,status:{searching:result.searching,errors:result.sync.errors || [],received:result.listings.length}};
  } catch {
    return { ...empty, status: {...empty.status, errors:["Não foi possível contactar os portais. Tenta novamente dentro de instantes."]}};
  }
}
