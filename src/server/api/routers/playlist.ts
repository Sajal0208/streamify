import { createTRPCRouter, protectedProcedure } from "../trpc";
import {z} from 'zod'
import { EngagementType } from "@prisma/client";

export const playlistRouter = createTRPCRouter({
    getSavePlaylistData: protectedProcedure.input(z.string()).query(async ({ctx, input}) => {
        const playlists = await ctx.prisma.playlist.findMany({
            where: {
                userId: input,
                NOT: [
                    {title: 'Liked Videos'}, 
                    {title: 'History'}
                ]
            },
            include: {
                videos: {
                    include: {
                        video: {
                            select: {
                                id: true
                            }
                        }
                    }
                }
            }
        })
        return playlists;
    }),

    addPlaylist: protectedProcedure.input(z.object({
        title: z.string(),
        userId: z.string(),
        description: z.string().min(5).max(50).optional()
    })).mutation(async ({ ctx, input }) => {
        const playlist = await ctx.prisma.playlist.create({
            data: {
                title: input.title,
                description: input.description,
                userId: input.userId
            }
        });
        return playlist;
    })
})