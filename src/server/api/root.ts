import { videoRouter } from "~/server/api/routers/video";
import { createTRPCRouter } from "~/server/api/trpc";
import { videoEngagementRouter } from "./routers/videoEngagement";
import { userRouter } from "./routers/user";
import { commentRouter } from "./routers/comment";
import { playlistRouter } from "./routers/playlist";
import { announcementRouter } from "./routers/announcement";

export const appRouter = createTRPCRouter({
  video: videoRouter,
  videoEngagement: videoEngagementRouter,
  user: userRouter,
  comment: commentRouter,
  playlist: playlistRouter,
  announcement: announcementRouter
});

// export type definition of API
export type AppRouter = typeof appRouter;
