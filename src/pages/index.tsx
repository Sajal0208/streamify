import { NextPage } from "next";
import Head from "next/head";
import { Layout, MultiColumnVideo } from "~/Components/Components";
import { ErrorMessage, LoadingMessage } from "~/Components/ErrorMessage";


import { api } from "~/utils/api";

const Home: NextPage = () => {
  const {data, isLoading, error} = api.video.getRandomVideos.useQuery(20);

  const Error = () => {
    if(isLoading) {
      return <LoadingMessage />
    } else if (error || !data) {
      return (
        <ErrorMessage 
          icon = "GreenPlay"
          message="No Videos"
          description="Sorry there are no videos at this time"
        />
      )
    } else {
      return <></>
    }
  }

  return (
    <>
      <Head>
        <title>Streamify</title>
        <meta name="description" content="Enjoy the videos and music you love." />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Layout>
        {
          !data || error ? (
            <Error />
          ) : (
            <>
              <MultiColumnVideo 
                videos = {data.videos.map((video) => {
                  return {
                    id: video?.id || "",
                    title: video?.title || "" ,
                    thumbnailUrl: video?.thumbnailUrl || "",
                    createdAt: video?.createdAt || new Date(),
                    views: video?.views || 0,
                  }
                })}
                users = {data.users.map((user) => {
                  return {
                    image: user?.image || "",
                    name: user?.name || "",
                  }
                } )}

              />
            </>
          )
        }
      </Layout>
    </>
  );
}

export default Home;