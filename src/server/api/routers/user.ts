import { EngagementType } from "@prisma/client";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const userRouter = createTRPCRouter({
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
