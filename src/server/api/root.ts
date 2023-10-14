import { videoRouter } from "~/server/api/routers/video";
import { createTRPCRouter } from "~/server/api/trpc";
import { videoEngagementRouter } from "./routers/videoEngagement";
import { userRouter } from "./routers/user";

export const appRouter = createTRPCRouter({
  video: videoRouter,
  videoEngagement: videoEngagementRouter,
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
