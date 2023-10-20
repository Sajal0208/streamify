import { EngagementType } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const userRouter = createTRPCRouter({
  getChannelById: publicProcedure
    .input(
      z.object({
        id: z.string(),
        viewerId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: {
          id: input.id,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const followers = await ctx.prisma.followEngagement.count({
        where: {
          followingId: user.id,
        },
      });

      const following = await ctx.prisma.followEngagement.count({
        where: {
          followerId: user.id,
        },
      });

      let viewerHasFollowed = false;
      const userWithEngagements = {
        ...user,
        followers,
        following,
      };

      if (input.viewerId && input.viewerId !== "") {
        viewerHasFollowed = !!(await ctx.prisma.followEngagement.findFirst({
          where: {
            followingId: user.id,
            followerId: input.viewerId,
          },
        }));
      }

      const viewer = {
        hasFollowed: viewerHasFollowed,
      };

      return {
        user: userWithEngagements,
        viewer,
      };
    }),

  addFollow: protectedProcedure
    .input(
      z.object({
        followerId: z.string(),
        followingId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existingFollow = await ctx.prisma.followEngagement.findMany({
        where: {
          engagementType: EngagementType.FOLLOW,
          followerId: input.followerId,
          followingId: input.followingId,
        },
      });
      if (existingFollow.length > 0) {
        const deleteFollow = await ctx.prisma.followEngagement.deleteMany({
          where: {
            engagementType: EngagementType.FOLLOW,
            followerId: input.followerId,
            followingId: input.followingId,
          },
        });

        return deleteFollow;
      } else {
        const follow = await ctx.prisma.followEngagement.create({
          data: {
            followingId: input.followingId,
            followerId: input.followerId,
            engagementType: EngagementType.FOLLOW,
          },
        });
        return follow;
      }
    }),

  getUserFollowings: publicProcedure
    .input(
      z.object({
        id: z.string(),
        viewerId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: {
          id: input.id,
        },
        include: {
          followings: {
            include: {
              following: {
                include: {
                  followings: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }
      const followings = user.followings;
      const followingsWithViewerFollowedStatus = await Promise.all(
        followings.map(async (following) => {
          let viewerHasFollowed = false;
          if (input.viewerId && input.viewerId !== "") {
            viewerHasFollowed = !!(await ctx.prisma.followEngagement.findFirst({
              where: {
                followingId: following.following.id,
                followerId: input.viewerId,
              },
            }));
          }

          return { ...following, viewerHasFollowed };
        }),
      );

      return {
        ...user,
        followings: followingsWithViewerFollowedStatus,
      };
    }),

  getDashboardData: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: {
          id: input,
        },
        include: {
          videos: true,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const videosWithCounts = await Promise.all(
        user.videos.map(async (video) => {
          const likes = await ctx.prisma.videoEngagement.count({
            where: {
              videoId: video.id,
              engagementType: EngagementType.LIKE,
            },
          });

          const views = await ctx.prisma.videoEngagement.count({
            where: {
              videoId: video.id,
              engagementType: EngagementType.VIEW,
            },
          });

          const dislikes = await ctx.prisma.videoEngagement.count({
            where: {
              videoId: video.id,
              engagementType: EngagementType.DISLIKE,
            },
          });

          return {
            ...video,
            likes,
            dislikes,
            views,
          };
        }),
      );

      const totalLikes = videosWithCounts.reduce(
        (total, video) => total + video.likes,
        0,
      );

      const totalViews = videosWithCounts.reduce(
        (total, video) => total + video.views,
        0,
      );

      const totalFollowers = await ctx.prisma.followEngagement.count({
        where: {
          followingId: user.id,
        },
      });

      return {
        user,
        totalFollowers,
        totalLikes,
        totalViews,
        videos: videosWithCounts,
      };
    }),

  updateUser: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        email: z.string().optional(),
        image: z.string().optional(),
        backgroundImage: z.string().optional(),
        handle: z.string().optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: {
          id: input.id,
        },
      });
      if (!user || user.id !== input.id) {
        throw new Error("User not found or you're not authorized to delete it");
      }
      const updatedUser = await ctx.prisma.user.update({
        where: {
          id: input.id,
        },
        data: {
          name: input.name ?? user.name,
          email: input.email ?? user.email,
          image: input.image ?? user.image,
          backgroundImage: input.backgroundImage ?? user.backgroundImage,
          handle: input.handle ?? user.handle,
          description: input.description ?? user.description,
        },
      });
      return updatedUser;
    }),
});
