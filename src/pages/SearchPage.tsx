import { NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  Layout,
  SingleColumnVideo,
} from "~/Components/Components";
import { ErrorMessage, LoadingMessage } from "~/Components/ErrorMessage";

import { api } from "~/utils/api";

const SearchPage: NextPage = () => {
  const router = useRouter();
  const searchQuery = router.query.q;

  const { data, isLoading, error } = api.video.getVideoBySearch.useQuery(
    searchQuery as string,
  );

  const Error = () => {
    if (isLoading) {
      return <LoadingMessage />;
    } else if (error || !data) {
      return (
        <ErrorMessage
          icon="GreenPlay"
          message="No Videos"
          description="Sorry try another search result"
        />
      );
    } else {
      return <></>;
    }
  };

  return (
    <>
      <Head>
        <title>Streamify</title>
        <meta
          name="description"
          content="Enjoy the videos and music you love."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Layout>
        {!data || error ? (
          <Error />
        ) : (
          <>
            <SingleColumnVideo
              videos={data.videos.map((video) => {
                return {
                  id: video?.id || "",
                  title: video?.title || "",
                  thumbnailUrl: video?.thumbnailUrl || "",
                  createdAt: video?.createdAt || new Date(),
                  views: video?.views || 0,
                };
              })}
              users={data.users.map((user) => {
                return {
                  image: user?.image || "",
                  name: user?.name || "",
                };
              })}
            />
          </>
        )}
      </Layout>
    </>
  );
};

export default SearchPage;
