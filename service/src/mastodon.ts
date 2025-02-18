// Get the home timeline from Mastodon

import { createRestAPIClient } from "masto";

export interface MinimizedTimelineEntry {
  account: { acct: string };
  content: string;
}

export type MinimizedTimeline = MinimizedTimelineEntry[];

async function minimizeTimeline(
  timeline: ReturnType<
    ReturnType<typeof createRestAPIClient>["v1"]["timelines"]["home"]["list"]
  >,
): Promise<MinimizedTimeline> {
  return (await timeline)
    .values()
    .take(20)
    .map(({ account, content, reblog }) =>
      reblog
        ? {
            account: { acct: reblog.account.acct },
            content: reblog.content,
          }
        : {
            account: { acct: account.acct },
            content,
          },
    )
    .filter(({ content }) => content.length > 0)
    .toArray();
}

export default {
  createClient: (options: Parameters<typeof createRestAPIClient>[0]) => {
    const client = createRestAPIClient(options);
    const getHomeTimeline = () => {
      return client.v1.timelines.home.list({
        limit: 20,
      });
    };
    const getMinimizedHomeTimeline = async () => {
      return minimizeTimeline(getHomeTimeline());
    };
    return {
      getHomeTimeline,
      minimizeTimeline,
      getMinimizedHomeTimeline,
    };
  },
};
