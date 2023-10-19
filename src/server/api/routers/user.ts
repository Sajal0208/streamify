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
});
