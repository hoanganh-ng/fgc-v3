export const syntheticDuplicatePostsPayload = {
  data: {
    feed: {
      edges: [
        {
          node: {
            __typename: "GroupPost",
            post_id: "duplicate-post",
            url: "https://www.facebook.com/groups/group-1/posts/duplicate-post/",
            message: {
              text: "Short duplicate body.",
            },
            feedback: {
              reaction_count: {
                count: 1,
              },
              comment_count: {
                count: 0,
              },
            },
          },
        },
        {
          node: {
            __typename: "GroupPost",
            post_id: "duplicate-post",
            url: "https://www.facebook.com/groups/group-1/posts/duplicate-post/",
            message: {
              text: "Richer duplicate body with newer engagement metadata.",
            },
            actors: [
              {
                id: "duplicate-author",
                name: "Synthetic Duplicate Author",
              },
            ],
            creation_time: "2026-02-04T08:00:00.000Z",
            feedback: {
              reaction_count: {
                count: 20,
              },
              comment_count: {
                count: 1,
              },
            },
            comments: {
              edges: [
                {
                  node: {
                    __typename: "Comment",
                    comment_id: "duplicate-comment",
                    body: {
                      text: "The richer duplicate keeps this comment.",
                    },
                    feedback: {
                      reaction_count: {
                        count: 4,
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    },
  },
} as const;
