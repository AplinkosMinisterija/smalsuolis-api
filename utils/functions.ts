import { Frequency, QueryObject } from '../types';
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
