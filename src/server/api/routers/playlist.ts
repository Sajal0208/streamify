import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { z } from "zod";
import { EngagementType } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export const playlistRouter = createTRPCRouter({
  getSavePlaylistData: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const playlists = await ctx.prisma.playlist.findMany({
        where: {
          userId: input,
          NOT: [{ title: "Liked Videos" }, { title: "History" }],
        },
        include: {
          videos: {
            include: {
              video: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });
      return playlists;
    }),

  addPlaylist: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        userId: z.string(),
        description: z.string().min(5).max(50).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.prisma.playlist.create({
        data: {
          title: input.title,
          description: input.description,
          userId: input.userId,
        },
      });
      return playlist;
    }),

  getPlaylistsByUserId: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const rawPlaylist = await ctx.prisma.playlist.findMany({
        where: {
          userId: input,
        },
        include: {
          user: true,
          videos: {
            include: {
              video: true,
            },
          },
        },
      });

      const playlists = await Promise.all(
        rawPlaylist.map(async (playlist) => {
          const videoCount = await ctx.prisma.playlistHasVideo.count({
            where: {
              playlistId: playlist.id,
            },
          });

          const firstVideoInPlaylist =
            await ctx.prisma.playlistHasVideo.findFirst({
              where: {
                playlistId: playlist.id,
              },
              include: {
                video: {
                  select: {
                    thumbnailUrl: true,
                  },
                },
              },
            });

          return {
            ...playlist,
            videoCount,
            firstVideoInPlaylist,
          };
        }),
      );
      return playlists;
    }),

  getPlaylistById: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const rawPlaylist = await ctx.prisma.playlist.findUnique({
        where: {
          id: input,
        },
        include: {
          user: true,
          videos: {
            include: {
              video: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      });

      if (!rawPlaylist) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found",
        });
      }

      const followers = await ctx.prisma.followEngagement.count({
        where: {
          followingId: rawPlaylist.userId,
        },
      });

      const userWithFollowers = {
        ...rawPlaylist.user,
        followers,
      };

      const videoWithUser = rawPlaylist.videos.map(({ video }) => ({
        ...video,
        author: video?.user,
      }));

      const videos = videoWithUser.map(({ author, ...video }) => video);
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

      const { user, videos: rawVideos, ...playlistInfo } = rawPlaylist;

      return {
        user: userWithFollowers,
        playlist: playlistInfo,
        authors: users,
        videos: videosWithCounts,
      };
    }),
});
