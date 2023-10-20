import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { z } from "zod";
import { EngagementType } from "@prisma/client";

export const announcementRouter = createTRPCRouter({
  getAnnoucementsByUserId: publicProcedure
    .input(
      z.object({
        id: z.string(),
        viewerId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const announcementWithUser = await ctx.prisma.announcement.findMany({
        where: {
          userId: input.id,
        },
        include: {
          user: true,
        },
      });

      const announcement = announcementWithUser.map(
        ({ user, ...announcement }) => announcement,
      );
      const user = announcementWithUser.map(
        ({ user, ...announcement }) => user,
      );

      const announcementWithEngagement = await Promise.all(
        announcement.map(async (announcement) => {
          const likes = await ctx.prisma.announcementEngagement.count({
            where: {
              announcementId: announcement.id,
              engagementType: EngagementType.LIKE,
            },
          });

          const dislikes = await ctx.prisma.announcementEngagement.count({
            where: {
              announcementId: announcement.id,
              engagementType: EngagementType.DISLIKE,
            },
          });

          let viewerHasLiked = false;
          let viewerHasDisliked = false;
          if (input.viewerId && input.viewerId !== "") {
            viewerHasLiked =
              !!(await ctx.prisma.announcementEngagement.findFirst({
                where: {
                  announcementId: announcement.id,
                  userId: input.viewerId,
                  engagementType: EngagementType.LIKE,
                },
              }));

            viewerHasDisliked =
              !!(await ctx.prisma.announcementEngagement.findFirst({
                where: {
                  announcementId: announcement.id,
                  userId: input.viewerId,
                  engagementType: EngagementType.DISLIKE,
                },
              }));
          }

          const viewer = {
            hasLiked: viewerHasLiked,
            hasDisliked: viewerHasDisliked,
          };

          return {
            ...announcement,
            likes,
            dislikes,
            viewer,
          };
        }),
      );

      return {
        user,
        announcements: announcementWithEngagement,
      };
    }),

  addLikeAnnouncement: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existingLike = await ctx.prisma.announcementEngagement.findMany({
        where: {
          announcementId: input.id,
          userId: input.userId,
          engagementType: EngagementType.LIKE,
        },
      });

      const existingDislike = await ctx.prisma.announcementEngagement.findMany({
        where: {
          announcementId: input.id,
          userId: input.userId,
          engagementType: EngagementType.DISLIKE,
        },
      });

      if (existingDislike.length > 0) {
        await ctx.prisma.announcementEngagement.deleteMany({
          where: {
            announcementId: input.id,
            userId: input.userId,
            engagementType: EngagementType.DISLIKE,
          },
        });
      }

      if (existingLike.length > 0) {
        await ctx.prisma.announcementEngagement.deleteMany({
          where: {
            announcementId: input.id,
            userId: input.userId,
            engagementType: EngagementType.LIKE,
          },
        });
      } else {
        const like = await ctx.prisma.announcementEngagement.create({
          data: {
            announcementId: input.id,
            userId: input.userId,
            engagementType: EngagementType.LIKE,
          },
        });

        return like;
      }
    }),

  addDislikeAnnouncement: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existingLike = await ctx.prisma.announcementEngagement.findMany({
        where: {
          announcementId: input.id,
          userId: input.userId,
          engagementType: EngagementType.LIKE,
        },
      });

      const existingDislike = await ctx.prisma.announcementEngagement.findMany({
        where: {
          announcementId: input.id,
          userId: input.userId,
          engagementType: EngagementType.DISLIKE,
        },
      });

      if (existingLike.length > 0) {
        await ctx.prisma.announcementEngagement.deleteMany({
          where: {
            announcementId: input.id,
            userId: input.userId,
            engagementType: EngagementType.LIKE,
          },
        });
      }

      if (existingDislike.length > 0) {
        const deleteDislike =
          await ctx.prisma.announcementEngagement.deleteMany({
            where: {
              announcementId: input.id,
              userId: input.userId,
              engagementType: EngagementType.DISLIKE,
            },
          });
        return deleteDislike;
      } else {
        const dislike = await ctx.prisma.announcementEngagement.create({
          data: {
            announcementId: input.id,
            userId: input.userId,
            engagementType: EngagementType.DISLIKE,
          },
        });

        return dislike;
      }
    }),

  addAnnouncement: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        message: z.string().max(200).min(5),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const announcement = await ctx.prisma.announcement.create({
        data: {
          message: input.message,
          userId: input.userId,
        },
      });

      return announcement;
    }),
});
