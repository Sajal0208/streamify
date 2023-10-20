import { EngagementType, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

type Context = {
  prisma: PrismaClient;
};

const checkVideoOwnership = async (
  ctx: Context,
  id: string,
  userId: string,
) => {
  const video = await ctx.prisma.video.findUnique({
    where: {
      id,
    },
  });

  if (!video || video.userId !== userId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Video not found",
    });
  }

  return video;
};

export const videoRouter = createTRPCRouter({
  getVideoById: publicProcedure
    .input(
      z.object({
        id: z.string(),
        viewerId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rawVideo = await ctx.prisma.video.findUnique({
        where: {
          id: input.id,
        },
        include: {
          user: true,
          comments: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!rawVideo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Video not found",
        });
      }

      const { user, comments, ...video } = rawVideo;

      const followers = await ctx.prisma.followEngagement.count({
        where: {
          followerId: video.userId,
        },
      });

      const likes = await ctx.prisma.videoEngagement.count({
        where: {
          videoId: video.id,
          engagementType: EngagementType.LIKE,
        },
      });

      const dislikes = await ctx.prisma.videoEngagement.count({
        where: {
          videoId: video.id,
          engagementType: EngagementType.DISLIKE,
        },
      });

      const views = await ctx.prisma.videoEngagement.count({
        where: {
          videoId: video.id,
          engagementType: EngagementType.VIEW,
        },
      });

      const userWithFollowers = { ...user, followers };
      const videoWithLikesDislikesViews = {
        ...video,
        likes,
        dislikes,
        views,
      };
      const commentsWithUsers = comments.map(({ user, ...comment }) => ({
        user,
        comment,
      }));

      let viewerHasFollowed = false;
      let viewerHasLiked = false;
      let viewerHasDisliked = false;

      if (input.viewerId && input.viewerId !== "") {
        viewerHasLiked = !!(await ctx.prisma.videoEngagement.findFirst({
          where: {
            videoId: video.id,
            engagementType: EngagementType.LIKE,
            userId: input.viewerId,
          },
        }));

        viewerHasDisliked = !!(await ctx.prisma.videoEngagement.findFirst({
          where: {
            videoId: video.id,
            engagementType: EngagementType.DISLIKE,
            userId: input.viewerId,
          },
        }));

        viewerHasFollowed = !!(await ctx.prisma.followEngagement.findFirst({
          where: {
            followingId: video.userId,
            followerId: input.viewerId,
          },
        }));
      } else {
        viewerHasFollowed = false;
        viewerHasLiked = false;
        viewerHasDisliked = false;
      }

      const viewer = {
        hasFollowed: viewerHasFollowed,
        hasLiked: viewerHasLiked,
        hasDisliked: viewerHasDisliked,
      };

      return {
        video: videoWithLikesDislikesViews,
        user: userWithFollowers,
        comments: commentsWithUsers,
        viewer,
      };
    }),

  getRandomVideos: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      const videoWithUser = await ctx.prisma.video.findMany({
        where: {
          publish: true,
        },
        include: {
          user: true,
        },
      });

      const videos = videoWithUser.map(({ user, ...video }) => video);
      const users = videoWithUser.map(({ user }) => user);

      const videosWithCounts = await Promise.all(
        videos.map(async (video) => {
          const views = await ctx.prisma.videoEngagement.count({
            where: {
              videoId: video.id,
              engagementType: EngagementType.VIEW,
            },
          });
          return {
            ...video,
            views,
          };
        }),
      );

      // Generate an array of indices
      const indices = Array.from(
        { length: videosWithCounts.length },
        (_, i) => i,
      );

      // Shuffle the indices
      // The Fisher–Yates shuffle is an algorithm for shuffling a finite sequence.
      // It generates a random permutation of the sequence, and this is often easier than generating the nth permutation directly.
      for (let i = indices.length - 1; i > 0; i--) {
        if (indices[i] !== undefined) {
          const j = Math.floor(Math.random() * (i + 1));
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
      }

      const shuffleVideoWithCounts = indices.map((i) => videosWithCounts[i]);
      const shuffleUsers = indices.map((i) => users[i]);

      const randomVideos = shuffleVideoWithCounts.slice(0, input);
      const randomUsers = shuffleUsers.slice(0, input);

      return {
        videos: randomVideos,
        users: randomUsers,
      };
    }),

  getVideoBySearch: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const videoWithUser = await ctx.prisma.video.findMany({
        where: {
          publish: true,
          title: {
            contains: input,
          },
        },
        take: 10,
        include: {
          user: true,
        },
      });

      const videos = videoWithUser.map(({ user, ...video }) => video);
      const users = videoWithUser.map(({ user }) => user);

      const videosWithCounts = await Promise.all(
        videos.map(async (video) => {
          const views = await ctx.prisma.videoEngagement.count({
            where: {
              videoId: video.id,
              engagementType: EngagementType.VIEW,
            },
          });
          return {
            ...video,
            views,
          };
        }),
      );

      return {
        videos: videosWithCounts,
        users: users,
      };
    }),

  addVideoToPlaylist: protectedProcedure
    .input(
      z.object({
        playlistId: z.string(),
        videoId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const playlistAlreadyHasVideo =
        await ctx.prisma.playlistHasVideo.findMany({
          where: {
            playlistId: input.playlistId,
            videoId: input.videoId,
          },
        });

      if (playlistAlreadyHasVideo.length > 0) {
        const deleteVideo = await ctx.prisma.playlistHasVideo.deleteMany({
          where: {
            playlistId: input.playlistId,
            videoId: input.videoId,
          },
        });
        return deleteVideo;
      } else {
        const addVideo = await ctx.prisma.playlistHasVideo.create({
          data: {
            playlistId: input.playlistId,
            videoId: input.videoId,
          },
        });
        return addVideo;
      }
    }),

  getVideosByUserId: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const videoWithUser = await ctx.prisma.video.findMany({
        where: {
          userId: input,
          publish: true,
        },
        include: {
          user: true,
        },
      });

      const videos = videoWithUser.map(({ user, ...video }) => video);
      const users = videoWithUser.map(({ user }) => user);

      const videosWithCounts = await Promise.all(
        videos.map(async (video) => {
          const views = await ctx.prisma.videoEngagement.count({
            where: {
              videoId: video.id,
              engagementType: EngagementType.VIEW,
            },
          });
          return {
            ...video,
            views,
          };
        }),
      );

      return {
        videos: videosWithCounts,
        users: users,
      };
    }),

  publishVideo: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const video = await checkVideoOwnership(ctx, input.id, input.userId);
      const publishVideo = await ctx.prisma.video.update({
        where: {
          id: input.id,
        },
        data: {
          publish: !video.publish,
        },
      });

      return publishVideo;
    }),

  deleteVideo: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const video = await checkVideoOwnership(ctx, input.id, input.userId);
      const deleteVideo = await ctx.prisma.video.delete({
        where: {
          id: input.id,
        },
      });

      return deleteVideo;
    }),

  updateVideo: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        userId: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        thumbnailUrl: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const video = await checkVideoOwnership(ctx, input.id, input.userId);

      const updatedVideo = await ctx.prisma.video.update({
        where: {
          id: video.id,
        },
        data: {
          title: input.title ?? video.title,
          description: input.description ?? video.description,
          thumbnailUrl: input.thumbnailUrl ?? video.thumbnailUrl,
        },
      });

      return updatedVideo;
    }),

  createVideo: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        videoUrl: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const video = await ctx.prisma.video.create({
        data: {
          userId: input.userId,
          videoUrl: input.videoUrl,
          publish: false,
        },
      });

      return video;
    }),
});
