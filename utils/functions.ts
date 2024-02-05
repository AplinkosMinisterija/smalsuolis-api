import { Frequency } from '../types';
import { Subscription } from '../services/subscriptions.service';
import { intersectsQuery } from 'moleculer-postgis';

type QueryObject = { [key: string]: any };

export function parseToJsonIfNeeded(query: QueryObject | string): QueryObject {
  if (!query) return;

  if (typeof query === 'string') {
    try {
      query = JSON.parse(query);
    } catch (err) {}
  }

  return query as QueryObject;
}

export function emailCanBeSent() {
  return ['production'].includes(process.env.NODE_ENV);
}

export function getDateByFrequency(frequency: Frequency): Date {
  const currentDate = new Date();
  switch (frequency) {
    case Frequency.DAY: {
      return new Date(currentDate.setDate(currentDate.getDate() - 1));
    }
    case Frequency.WEEK: {
      return new Date(currentDate.setDate(currentDate.getDate() - 7));
    }
    case Frequency.MONTH: {
      return new Date(currentDate.setMonth(currentDate.getMonth() - 1));
    }
    default:
      return new Date();
  }
}

export function truncateString(text: string, num: number) {
  if (text.length > num) {
    return text.slice(0, num) + '...';
  } else {
    return text;
  }
}

// returns query with apps and geom filtering based on provided subscriptions.
export async function applyNewsfeedFilters(query: QueryObject, subscriptions: Subscription[]) {
  if (!subscriptions?.length) {
    query.$or = { app: { $in: [] } };
    return query;
  }
  const subscriptionQuery = subscriptions.map((subscription) => ({
    ...(!!subscription.apps?.length && { app: { $in: subscription.apps } }),
    $raw: intersectsQuery('geom', subscription.geom, 3346),
  }));
  if (query?.$or) {
    query.$and = [query?.$or, { $or: subscriptionQuery }];
    delete query?.$or;
  } else {
    query.$or = subscriptionQuery;
  }
  return query;
}
