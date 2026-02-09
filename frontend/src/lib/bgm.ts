export interface BgmWeekday {
  en: string;
  cn: string;
  ja: string;
  id: number;
}

export interface BgmSubjectSmall {
  id: number;
  url: string;
  type: number;
  name: string;
  name_cn?: string;
  summary?: string;
  air_date?: string;
  air_weekday?: number;
  images?: {
    large?: string;
    common?: string;
    medium?: string;
    small?: string;
    grid?: string;
  };
  eps?: number;
  eps_count?: number;
  rating?: {
    total?: number;
    score?: number;
  };
  rank?: number;
}

export interface BgmCalendarDay {
  weekday: BgmWeekday;
  items: BgmSubjectSmall[];
}

export interface BgmSubjectTag {
  name: string;
  count: number;
}

export interface BgmSubjectInfoboxItem {
  key: string;
  value:
    | string
    | {
        k?: string;
        v: string;
      }[];
}

export interface BgmSubjectDetail {
  id: number;
  type?: number;
  name: string;
  name_cn: string;
  summary: string;
  date?: string;
  platform?: string;
  images?: {
    large?: string;
    common?: string;
    medium?: string;
    small?: string;
    grid?: string;
  };
  eps?: number;
  total_episodes?: number;
  rating?: {
    rank?: number;
    total?: number;
    score?: number;
  };
  tags?: BgmSubjectTag[];
  meta_tags?: string[];
  infobox?: BgmSubjectInfoboxItem[];
  collection?: {
    wish: number;
    collect: number;
    doing: number;
    on_hold: number;
    dropped: number;
  };
}

export async function getBgmCalendar(): Promise<BgmCalendarDay[]> {
  const response = await fetch("/internal-api/bgm/calendar", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `BGM API error: ${response.status}`);
  }

  return response.json() as Promise<BgmCalendarDay[]>;
}

export async function getBgmSubject(
  id: number
): Promise<BgmSubjectDetail> {
  const response = await fetch(`/internal-api/bgm/subjects/${id}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `BGM API error: ${response.status}`);
  }

  return response.json() as Promise<BgmSubjectDetail>;
}
