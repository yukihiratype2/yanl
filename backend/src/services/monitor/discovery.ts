import {
  getActiveSubscriptions,
  getEpisodesBySubscription,
  createEpisode,
  Subscription,
} from "../../db/models";
import * as tmdb from "../tmdb";
import * as bgm from "../bgm";
import { logger } from "../logger";
import { getTodayISO } from "./utils";

export async function checkNewEpisodes() {
  const subscriptions = getActiveSubscriptions();

  for (const sub of subscriptions) {
    if (sub.source === "tvdb" && sub.media_type === "tv") {
      try {
        await processTVSubscription(sub);
      } catch (err) {
        logger.error({ subscription: sub.title, err }, "Error processing TV subscription");
      }
    }
    if (sub.source === "bgm" && sub.media_type !== "movie") {
      try {
        await processBgmSubscription(sub);
      } catch (err) {
        logger.error({ subscription: sub.title, err }, "Error processing BGM subscription");
      }
    }
    // Movies are single-item, handled by status check usually.
  }
}

async function processTVSubscription(sub: Subscription) {
  // If season_number is specified, only track that season.
  // Otherwise, track the latest aired season from TMDB.

  const today = getTodayISO();
  let seasonData;
  if (sub.season_number) {
    seasonData = await tmdb.getSeasonDetail(sub.source_id, sub.season_number);
  } else {
    const showDetail = await tmdb.getTVDetail(sub.source_id);
    const airedSeasons = showDetail.seasons
      .filter(
        (season) =>
          season.season_number > 0 && season.air_date && season.air_date <= today
      )
      .sort((a, b) => a.season_number - b.season_number);
    const latestAiredSeason = airedSeasons[airedSeasons.length - 1];
    const fallbackSeason = showDetail.seasons
      .filter((season) => season.season_number > 0)
      .sort((a, b) => a.season_number - b.season_number)
      .pop();
    const targetSeason = latestAiredSeason ?? fallbackSeason;
    if (targetSeason) {
      seasonData = await tmdb.getSeasonDetail(sub.source_id, targetSeason.season_number);
    }
  }

  if (!seasonData) return;

  const existingEpisodes = getEpisodesBySubscription(sub.id);
  const existingEpMap = new Set(
    existingEpisodes
      .filter((e) => e.season_number === seasonData.season_number)
      .map((e) => e.episode_number)
  );
  const legacyEpisodeAirDates = new Map<number, Set<string>>();
  for (const episode of existingEpisodes) {
    if (episode.season_number != null) continue;
    const set =
      legacyEpisodeAirDates.get(episode.episode_number) ?? new Set<string>();
    set.add(episode.air_date ?? "");
    legacyEpisodeAirDates.set(episode.episode_number, set);
  }

  for (const ep of seasonData.episodes) {
    const legacyAirDates = legacyEpisodeAirDates.get(ep.episode_number);
    const hasLegacyMatch = legacyAirDates?.has(ep.air_date ?? "") ?? false;
    if (
      ep.air_date &&
      ep.air_date <= today &&
      !existingEpMap.has(ep.episode_number) &&
      !hasLegacyMatch
    ) {
      logger.info(
        {
          subscription: sub.title,
          season: seasonData.season_number,
          episode: ep.episode_number,
        },
        "Found new episode"
      );
      createEpisode({
        subscription_id: sub.id,
        season_number: seasonData.season_number,
        episode_number: ep.episode_number,
        title: ep.name,
        air_date: ep.air_date,
        overview: ep.overview,
        still_path: ep.still_path,
        status: "pending",
        torrent_hash: null,
        file_path: null,
      });
    }
  }
}

async function processBgmSubscription(sub: Subscription) {
  const episodes = await bgm.getAllEpisodes(sub.source_id, { type: 0 });
  const existingEpisodes = getEpisodesBySubscription(sub.id);
  const existingEpMap = new Set(existingEpisodes.map((e) => e.episode_number));
  const today = getTodayISO();

  for (const ep of episodes) {
    const numberRaw = ep.ep ?? ep.sort;
    const episodeNumber = Number(numberRaw);
    if (!Number.isInteger(episodeNumber) || episodeNumber <= 0) continue;
    if (existingEpMap.has(episodeNumber)) continue;
    if (!ep.airdate || ep.airdate > today) continue;

    createEpisode({
      subscription_id: sub.id,
      season_number: null,
      episode_number: episodeNumber,
      title: ep.name_cn || ep.name || null,
      air_date: ep.airdate,
      overview: ep.desc || null,
      still_path: null,
      status: "pending",
      torrent_hash: null,
      file_path: null,
    });
  }
}
