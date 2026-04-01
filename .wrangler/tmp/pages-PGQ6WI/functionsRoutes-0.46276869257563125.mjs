import { onRequestGet as __api_stars_ts_onRequestGet } from "/Users/sahil/Projects/bhatti.sh/functions/api/stars.ts"

export const routes = [
    {
      routePath: "/api/stars",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_stars_ts_onRequestGet],
    },
  ]