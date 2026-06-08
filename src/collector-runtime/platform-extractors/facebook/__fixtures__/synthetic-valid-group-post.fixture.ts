export const syntheticValidGroupPostPayload = {
  data: {
    group_feed: {
      edges: [
        {
          node: {
            __typename: "CometGroupDiscussionPost",
            post_id: "post-123",
            url: "https://www.facebook.com/groups/group-1/posts/post-123/",
            title: {
              text: "Useful automation note",
            },
            message: {
              __typename: "TextWithEntities",
              text: "  A practical idea for organizing collected knowledge posts.\n",
            },
            actors: [
              {
                id: "author-123",
                name: "Synthetic Author",
              },
            ],
            creation_time: "2026-02-03T10:15:00.000Z",
            feedback: {
              reaction_count: {
                count: 42,
              },
              comment_count: {
                total_count: 5,
              },
              share_count: {
                count: 2,
              },
            },
            comments: {
              edges: [
                {
                  node: {
                    __typename: "Comment",
                    comment_id: "comment-1",
                    body: {
                      text: "This is immediately useful.",
                    },
                    author: {
                      id: "comment-author-1",
                      name: "Synthetic Commenter One",
                    },
                    feedback: {
                      reaction_count: {
                        count: 9,
                      },
                    },
                    reply_count: 1,
                    created_time: "2026-02-03T10:20:00.000Z",
                  },
                },
                {
                  node: {
                    __typename: "Comment",
                    comment_id: "comment-2",
                    body: {
                      fragments: [
                        {
                          text: "I would try this",
                        },
                        {
                          text: "with a short checklist.",
                        },
                      ],
                    },
                    author: {
                      id: "comment-author-2",
                      name: "Synthetic Commenter Two",
                    },
                    feedback: {
                      reaction_count: {
                        count: 3,
                      },
                    },
                    reply_count: 0,
                    created_time: 1770114300,
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
